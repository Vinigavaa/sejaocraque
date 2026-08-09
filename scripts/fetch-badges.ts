/**
 * Baixa escudos de clubes e logos de competicoes do TheSportsDB.
 *
 *   npx tsx scripts/fetch-badges.ts          # baixa o que falta
 *   npx tsx scripts/fetch-badges.ts --force    # rebaixa tudo
 *   npx tsx scripts/fetch-badges.ts --preview  # imagens reduzidas (~65% menores)
 *
 * As imagens vao para `public/badges/` e sao commitadas junto com o codigo.
 * Nada e buscado em runtime: o jogo continua funcionando offline e o dataset
 * de escudos so muda quando alguem roda este script de novo.
 *
 * No fim, gera `lib/sim/data/badges.ts` com o mapa id -> caminho. Quem nao
 * tiver escudo simplesmente nao aparece no mapa, e a UI cai no fallback.
 *
 * A chave "3" e a de teste publica do TheSportsDB. Ela e agressivamente
 * limitada pelo Cloudflare (erro 1015), por isso o throttle e o retry abaixo
 * nao sao opcionais. As respostas ficam em cache para que rodar de novo
 * custe quase nada.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { CLUBS } from '../lib/sim/data/clubs'
import { LEAGUES } from '../lib/sim/data/leagues'

const API = 'https://www.thesportsdb.com/api/v1/json/3'
const ROOT = join(import.meta.dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public', 'badges')
const CACHE_DIR = join(ROOT, 'scripts', '.cache')
const MANIFEST = join(ROOT, 'lib', 'sim', 'data', 'badges.ts')

const FORCE = process.argv.includes('--force')
/**
 * Baixa a versao reduzida das imagens (~65% menores).
 *
 * O escudo em tela tem algumas dezenas de pixels, entao o original de 95 KB e
 * desperdicio — mas o padrao continua sendo o original, porque trocar a
 * qualidade do que ja esta commitado e decisao de quem mantem o projeto.
 * Para migrar: `npx tsx scripts/fetch-badges.ts --preview --force`.
 */
const PREVIEW = process.argv.includes('--preview')

/** Pausa entre chamadas da API. Abaixo disso o Cloudflare corta. */
const API_DELAY_MS = 2500
/** Downloads vao para o CDN (r2), que e bem mais tolerante. */
const IMAGE_DELAY_MS = 120
const MAX_RETRIES = 5
/** Base do backoff exponencial: 30s, 60s, 120s... O 1015 e teimoso. */
const RETRY_DELAY_MS = 30_000

// ── Nome da liga no TheSportsDB ──────────────────────────────────────
//
// O nome deles nem sempre e obvio ("Mexican Primera League" para a Liga MX),
// e muda de tempos em tempos. Por isso cada liga tem uma lista de candidatos:
// o script tenta em ordem e fica com o primeiro que retornar times.

const LEAGUE_SOURCES: Record<string, string[]> = {
  'br-1': ['Brazilian Serie A'],
  'br-2': ['Brazilian Serie B'],
  'br-3': ['Brazilian Serie C'],
  'en-1': ['English Premier League'],
  'en-2': ['English League Championship'],
  'es-1': ['Spanish La Liga'],
  'es-2': ['Spanish La Liga 2', 'Spanish Segunda Division', 'Spanish LaLiga Hypermotion'],
  'it-1': ['Italian Serie A'],
  'it-2': ['Italian Serie B'],
  'de-1': ['German Bundesliga'],
  'de-2': ['German 2. Bundesliga'],
  'fr-1': ['French Ligue 1'],
  'fr-2': ['French Ligue 2'],
  'pt-1': ['Portuguese Primeira Liga'],
  'nl-1': ['Dutch Eredivisie'],
  'ar-1': ['Argentinian Primera Division'],
  'mx-1': ['Mexican Primera League', 'Mexican Liga MX'],
  'us-1': ['American Major League Soccer', 'American MLS'],
  'tr-1': ['Turkish Super Lig', 'Turkish Superlig'],
  'sa-1': ['Saudi-Arabian Pro League'],
}

// ── Competicoes sem liga propria ─────────────────────────────────────
//
// Copas nacionais, continentais e torneios de selecoes. A chave e o id usado
// no arquivo salvo; o valor sao os candidatos de nome na API.

const COMPETITION_SOURCES: Record<string, string[]> = {
  // Copas nacionais — id espelha o codigo do pais usado no jogo.
  'cup-BR': ['Copa do Brasil'],
  'cup-EN': ['FA Cup'],
  'cup-ES': ['Copa del Rey'],
  'cup-IT': ['Coppa Italia'],
  'cup-DE': ['DFB-Pokal'],
  'cup-FR': ['Coupe de France'],
  'cup-PT': ['Taca de Portugal'],
  'cup-NL': ['Dutch KNVB Cup'],
  'cup-AR': ['Copa Argentina'],
  'cup-MX': ['Copa MX', 'Leagues Cup'],
  'cup-US': ['US Open Cup'],
  'cup-TR': ['Turkish Cup'],
  'cup-SA': ['Saudi King Cup'],

  // Continentais.
  ucl: ['UEFA Champions League'],
  uel: ['UEFA Europa League'],
  uecl: ['UEFA Europa Conference League', 'UEFA Conference League'],
  libertadores: ['Copa Libertadores'],
  sudamericana: ['Copa Sudamericana'],
  concachampions: ['CONCACAF Champions Cup'],
  afc: ['AFC Champions League Elite', 'AFC Champions League'],

  // Selecoes.
  euro: ['UEFA European Championship', 'European Championship'],
  'copa-america': ['Copa America'],
  can: ['African Cup of Nations'],
  'asian-cup': ['AFC Asian Cup'],
  'gold-cup': ['CONCACAF Gold Cup'],
  'world-cup': ['FIFA World Cup'],
}

/**
 * Times consultados so para alimentar o indice de competicoes.
 *
 * A copa nacional so entra no indice se algum time que a disputa for
 * consultado, e o mesmo vale para os torneios de selecao. Um clube grande por
 * pais e uma selecao por confederacao cobrem a lista acima.
 */
const COMPETITION_SEEDS = [
  'Brazil',
  'Spain',
  'Nigeria',
  'Japan',
  'Mexico',
  'Juventus',
  'Ajax',
  'Benfica',
  'Club America',
  'LA Galaxy',
]

/**
 * Clubes cujo nome nao casa automaticamente com o da API.
 *
 * O valor e o `strTeam` exato retornado pelo TheSportsDB. Preencher aqui
 * conforme o relatorio final apontar os faltantes — e mais honesto do que
 * afrouxar o casamento por similaridade e arriscar colar o escudo errado.
 */
const CLUB_OVERRIDES: Record<string, string> = {
  // O jogo usa o nome em portugues; a API so conhece o original.
  inter: 'Inter Milan',
  bayern: 'Bayern Munich',
  marseille: 'Marseille',

  // O jogo usa a forma curta; a API exige o nome completo.
  leeds: 'Leeds United',
  ipswich: 'Ipswich Town',
  valladolid: 'Real Valladolid',
  reims: 'Stade de Reims',
  nacional: 'Nacional de Madeira',
  'operario-pr': 'Operário Ferroviário',

  newcastle: 'Newcastle United',
  'west-ham': 'West Ham United',
  tottenham: 'Tottenham Hotspur',
  wolves: 'Wolverhampton Wanderers',
  leicester: 'Leicester City',
  coventry: 'Coventry City',
  norwich: 'Norwich City',
  preston: 'Preston North End',
  zaragoza: 'Real Zaragoza',
  'sporting-gijon': 'Sporting de Gijón',
  estudiantes: 'Estudiantes de La Plata',
  gimnasia: 'Gimnasia y Esgrima de La Plata',
  'sao-jose-rs': 'São José',

  // A API usa o nome local, o jogo usa o aportuguesado.
  hamburgo: 'Hamburg',
  colonia: 'Köln',
  mainz: 'Mainz',
  gladbach: 'Borussia Mönchengladbach',

  // A API escreve o sufixo do estado por extenso.
  'atletico-mg': 'Atlético Mineiro',
  'athletico-pr': 'Athletico Paranaense',
  'saint-etienne': 'Saint-Étienne',
}

// ── Casamento de nomes ───────────────────────────────────────────────

/**
 * Reduz o nome ao nucleo comparavel: sem acento, sem pontuacao e sem os
 * sufixos/prefixos societarios que cada base escreve de um jeito
 * ("Atletico-MG" vs "Atletico Mineiro", "Sao Paulo" vs "Sao Paulo FC").
 */
const NOISE = /\b(fc|cf|sc|ac|ec|cd|ca|afc|sad|club|clube|futbol|football|calcio|de|do|da)\b/g

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type ApiTeam = {
  strTeam: string
  strTeamAlternate?: string | null
  strBadge?: string | null
  strSport?: string | null
  idLeague?: string | null
} & Record<string, string | null | undefined>

/** Todos os nomes pelos quais a API conhece o time. */
function aliases(team: ApiTeam): string[] {
  const alt = (team.strTeamAlternate ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return [team.strTeam, ...alt]
}

/**
 * Indice nome-de-competicao -> id na API, montado de graca.
 *
 * Cada time traz `strLeague2..7` com as copas que disputa (Copa do Brasil,
 * Libertadores, Mundial...). Aproveitar isso evita ter que descobrir os ids
 * das copas por conta propria — a listagem de ligas da chave gratuita e
 * truncada em 5 itens e nao serviria.
 */
const competitionIds = new Map<string, string>()

function indexCompetitions(team: ApiTeam): void {
  for (const suffix of ['', '2', '3', '4', '5', '6', '7']) {
    const name = team[`strLeague${suffix}`]
    const id = team[`idLeague${suffix}`]
    if (!name || !id) continue
    const key = normalize(name)
    if (key && !competitionIds.has(key)) competitionIds.set(key, id)
  }
}

// ── HTTP ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Chamada da API com cache em disco e retry no rate limit.
 *
 * O cache existe porque o limite do Cloudflare torna cada rerun caro: sem
 * ele, corrigir um unico override custaria a bateria inteira de requisicoes.
 */
async function api(path: string): Promise<Record<string, unknown> | null> {
  const cacheFile = join(CACHE_DIR, `${path.replace(/[^a-z0-9]+/gi, '_')}.json`)

  if (!FORCE && (await exists(cacheFile))) {
    return JSON.parse(await readFile(cacheFile, 'utf8'))
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await sleep(API_DELAY_MS)

    // 30s, 60s, 120s... Esperar pouco no 1015 so renova o bloqueio.
    const backoff = RETRY_DELAY_MS * 2 ** (attempt - 1)

    let body: string
    let status: number
    try {
      const response = await fetch(`${API}/${path}`)
      status = response.status
      body = await response.text()
    } catch (error) {
      console.warn(`  ! rede falhou em ${path} (tentativa ${attempt}): ${String(error)}`)
      await sleep(backoff)
      continue
    }

    try {
      const parsed = JSON.parse(body) as Record<string, unknown>
      await mkdir(CACHE_DIR, { recursive: true })
      await writeFile(cacheFile, JSON.stringify(parsed), 'utf8')
      return parsed
    } catch {
      // Qualquer coisa que nao seja JSON e o Cloudflare barrando: as vezes o
      // texto "error code: 1015", as vezes uma pagina HTML inteira.
      console.warn(
        `  ! bloqueado em ${path} (HTTP ${status}, tentativa ${attempt}), esperando ${backoff / 1000}s`,
      )
      await sleep(backoff)
    }
  }

  console.error(`  x desisti de ${path} apos ${MAX_RETRIES} tentativas`)
  return null
}

/** Baixa a imagem. Retorna o caminho publico, ou null se falhou. */
async function download(url: string, kind: string, id: string): Promise<string | null> {
  const extension = (url.match(/\.(png|jpg|jpeg|webp|svg)(?:\?|$)/i)?.[1] ?? 'png').toLowerCase()
  const relative = `/badges/${kind}/${id}.${extension}`
  const destination = join(PUBLIC_DIR, kind, `${id}.${extension}`)

  if (!FORCE && (await exists(destination))) return relative

  await sleep(IMAGE_DELAY_MS)
  try {
    const response = await fetch(PREVIEW ? `${url}/preview` : url)
    if (!response.ok) {
      console.warn(`  ! HTTP ${response.status} baixando ${id}`)
      return null
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0) {
      console.warn(`  ! arquivo vazio para ${id}`)
      return null
    }
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, bytes)
    return relative
  } catch (error) {
    console.warn(`  ! falha baixando ${id}: ${String(error)}`)
    return null
  }
}

// ── Coleta ───────────────────────────────────────────────────────────

const clubBadges: Record<string, string> = {}
const leagueBadges: Record<string, string> = {}
const competitionBadges: Record<string, string> = {}
const missingClubs: string[] = []
const missingLeagues: string[] = []
const missingCompetitions: string[] = []

/** Procura a liga por nome, tentando os candidatos em ordem. */
async function findLeagueTeams(
  candidates: string[],
): Promise<{ name: string; teams: ApiTeam[] } | null> {
  for (const candidate of candidates) {
    const data = await api(`search_all_teams.php?l=${encodeURIComponent(candidate)}`)
    const teams = data?.teams as ApiTeam[] | null | undefined
    if (teams?.length) return { name: candidate, teams }
  }
  return null
}

/**
 * Busca um clube pelo nome, um a um.
 *
 * Necessario porque a chave gratuita trunca a listagem por liga em 10 times —
 * metade de uma primeira divisao. A busca individual nao tem esse teto.
 *
 * `expectedLeagueId` desempata homonimos: "Santos" existe no Brasil e no
 * Mexico, e o time certo e o que joga na liga que estamos varrendo.
 */
async function searchClub(name: string, expectedLeagueId?: string): Promise<ApiTeam | null> {
  // O hifen zera o resultado da busca ("Al-Hilal" nao acha nada, "Al Hilal"
  // acha), entao a variante com espaco e uma segunda tentativa legitima.
  const spaced = name.replace(/-/g, ' ')
  const variants = spaced === name ? [name] : [name, spaced]

  const teams: ApiTeam[] = []
  for (const variant of variants) {
    const data = await api(`searchteams.php?t=${encodeURIComponent(variant)}`)
    const found = (data?.teams as ApiTeam[] | null | undefined)?.filter(
      (team) => team.strSport === 'Soccer',
    )
    if (found?.length) teams.push(...found)
  }
  if (!teams.length) return null

  for (const team of teams) indexCompetitions(team)

  // Nunca devolver "o primeiro que apareceu". A busca por nome curto traz
  // homonimos de outros paises — "Al-Hilal" casa com o Al Hilal Wau do Sudao,
  // "Estudiantes" com um time finlandes. Colar o escudo errado e pior do que
  // ficar sem escudo, entao so passa quem confirma nome E liga.
  const wanted = normalize(name)
  const byName = teams.filter((team) => aliases(team).some((a) => normalize(a) === wanted))

  // Melhor caso: nome e liga conferem. Depois, um dos dois sozinho — nome
  // exato ja e um sinal forte, e a liga cobre quem a API grafa diferente.
  const exact = byName.find((team) => team.idLeague === expectedLeagueId)
  if (exact) return exact

  const sameLeague = expectedLeagueId
    ? teams.find((team) => team.idLeague === expectedLeagueId)
    : undefined
  if (sameLeague) return sameLeague

  if (byName[0] && expectedLeagueId) {
    console.warn(`    ~ ${name}: nome bate mas liga difere (${byName[0].strLeague ?? '?'})`)
  }
  return byName[0] ?? null
}

async function collectClubsAndLeagues(): Promise<void> {
  for (const league of LEAGUES) {
    const clubs = CLUBS.filter((club) => club.leagueId === league.id)
    const candidates = LEAGUE_SOURCES[league.id] ?? []

    // Uma chamada resolve ate 10 clubes de uma vez; o resto cai na busca
    // individual. Se nem a liga resolver, todos caem — funciona igual, so
    // custa mais requisicoes.
    const found = candidates.length ? await findLeagueTeams(candidates) : null
    const byName = new Map<string, ApiTeam>()

    if (found) {
      for (const team of found.teams) {
        indexCompetitions(team)
        for (const alias of aliases(team)) {
          const key = normalize(alias)
          if (key && !byName.has(key)) byName.set(key, team)
        }
      }
      console.log(`\n${league.id} · ${found.name} · ${found.teams.length} times em lote`)
    } else {
      console.log(`\n${league.id} · sem lote, buscando clube a clube`)
    }

    const leagueApiId = found?.teams.find((team) => team.idLeague)?.idLeague ?? undefined

    for (const club of clubs) {
      const override = CLUB_OVERRIDES[club.id]
      const team = override
        ? await searchClub(override, leagueApiId)
        : (byName.get(normalize(club.name)) ?? (await searchClub(club.name, leagueApiId)))

      if (!team?.strBadge) {
        const reason = team ? 'time sem escudo na API' : 'nao encontrado'
        console.warn(`  ! ${club.name}: ${reason}`)
        missingClubs.push(`${club.id} (${club.name}) — ${reason}`)
        continue
      }

      const path = await download(team.strBadge, 'clubs', club.id)
      if (path) clubBadges[club.id] = path
      else missingClubs.push(`${club.id} (${club.name}) — download falhou`)
    }

    // O logo da liga sai do id que veio junto com os times.
    const apiId = leagueApiId ?? competitionIds.get(normalize(candidates[0] ?? ''))
    if (!apiId) {
      missingLeagues.push(league.id)
      continue
    }

    const badge = await leagueBadgeUrl(apiId)
    const path = badge ? await download(badge, 'leagues', league.id) : null
    if (path) leagueBadges[league.id] = path
    else missingLeagues.push(league.id)
  }
}

/** Escudo/logo de uma liga ou copa, pelo id da API. */
async function leagueBadgeUrl(apiId: string): Promise<string | null> {
  const detail = await api(`lookupleague.php?id=${apiId}`)
  const record = (detail?.leagues as Array<Record<string, string | null>> | undefined)?.[0]
  return record?.strBadge || record?.strLogo || null
}

async function collectCompetitions(): Promise<void> {
  console.log('\n── competicoes ──')

  for (const seed of COMPETITION_SEEDS) await searchClub(seed)

  for (const [id, candidates] of Object.entries(COMPETITION_SOURCES)) {
    const apiId = candidates.map((name) => competitionIds.get(normalize(name))).find(Boolean)
    if (!apiId) {
      missingCompetitions.push(`${id} (${candidates[0]}) — id nao encontrado`)
      continue
    }

    const badge = await leagueBadgeUrl(apiId)
    if (!badge) {
      missingCompetitions.push(`${id} (${candidates[0]}) — sem imagem na API`)
      continue
    }

    const path = await download(badge, 'competitions', id)
    if (path) competitionBadges[id] = path
    else missingCompetitions.push(`${id} — download falhou`)
  }
}

// ── Manifesto ────────────────────────────────────────────────────────

function serialize(name: string, entries: Record<string, string>): string {
  const lines = Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `  '${key}': '${value}',`)
    .join('\n')
  return `export const ${name}: Record<string, string> = {\n${lines}\n}\n`
}

async function writeManifest(): Promise<void> {
  const content = `/**
 * Gerado por \`npx tsx scripts/fetch-badges.ts\`. Nao editar a mao.
 *
 * Mapeia id -> caminho da imagem em \`public/\`. Quem nao esta aqui nao tem
 * escudo baixado, e a UI deve cair no fallback em vez de renderizar um 404.
 */

${serialize('CLUB_BADGES', clubBadges)}
${serialize('LEAGUE_BADGES', leagueBadges)}
${serialize('COMPETITION_BADGES', competitionBadges)}
export function clubBadge(id: string): string | null {
  return CLUB_BADGES[id] ?? null
}

export function leagueBadge(id: string): string | null {
  return LEAGUE_BADGES[id] ?? null
}

/** \`id\` e o da competicao continental/selecao, ou \`cup-\${pais}\` para copa nacional. */
export function competitionBadge(id: string): string | null {
  return COMPETITION_BADGES[id] ?? null
}
`
  await writeFile(MANIFEST, content, 'utf8')
}

// ── Execucao ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await collectClubsAndLeagues()
  await collectCompetitions()
  await writeManifest()

  console.log('\n── resultado ──')
  console.log(`clubes:      ${Object.keys(clubBadges).length}/${CLUBS.length}`)
  console.log(`ligas:       ${Object.keys(leagueBadges).length}/${LEAGUES.length}`)
  const totalCompetitions = Object.keys(COMPETITION_SOURCES).length
  console.log(`competicoes: ${Object.keys(competitionBadges).length}/${totalCompetitions}`)

  if (missingClubs.length) {
    console.log(`\nClubes sem escudo (${missingClubs.length}) — mapear em CLUB_OVERRIDES:`)
    for (const entry of missingClubs) console.log(`  ${entry}`)
  }
  if (missingLeagues.length) console.log(`\nLigas sem logo: ${missingLeagues.join(', ')}`)
  if (missingCompetitions.length) {
    console.log(`\nCompeticoes sem logo:\n  ${missingCompetitions.join('\n  ')}`)
  }

  console.log(`\nManifesto escrito em lib/sim/data/badges.ts`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
