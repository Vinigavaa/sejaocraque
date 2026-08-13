import type { CareerState, CompetitionRun, SeasonRecord } from '@/lib/sim/career'
import { AWARD_LABEL, type Award } from '@/lib/sim/awards'
import { clubById, leagueOf } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
import type { MatchdayLog } from '@/lib/sim/matchday'
import { nationById } from '@/lib/sim/data/nations'
import { reputationLabel } from '@/lib/sim/morale'
import { formatSalary, type ContractTerms } from '@/lib/sim/contracts'
import { clamp } from '@/lib/sim/positions'
import { jitter, pick, type Rng } from '@/lib/sim/rng'
import type { Position } from '@/lib/sim/types'
import { streaksOf, type NewsContext, type NewsReach } from './news'

/**
 * A rede social da carreira.
 *
 * Onde `news.ts` escreve a manchete que a imprensa daria, este modulo escreve
 * o mesmo acontecimento como a internet reagiria a ele: jornalista, torcedor,
 * pagina de mercado e o proprio clube, cada um com a voz que tem de verdade.
 * Por isso nao reimplementa deteccao de acontecimento nenhuma — recebe o
 * mesmo material que `news.ts` (o log da partida, o registro da temporada, as
 * propostas do mercado) e so escolhe como contar. Nenhum post aqui pode
 * existir sem um fato correspondente no estado da carreira.
 */

export type SocialAuthorKind = 'jornalista' | 'pagina' | 'torcedor' | 'mercado' | 'oficial'

export type SocialPost = {
  id: string
  kind: SocialAuthorKind
  name: string
  handle: string
  verified: boolean
  tag: string
  text: string
  reach: NewsReach
  likes: number
  reposts: number
  comments: number
  /** Rotulo da temporada a que o post pertence — a timeline so mostra a atual. */
  season: string
  round: number | null
}

const JOURNALISTS = [
  { name: 'Rodrigo Falcão', handle: '@FalcaoNoticias' },
  { name: 'Marina Duarte', handle: '@MarinaDuarteFC' },
  { name: 'Central do Mercado', handle: '@CentralMercado' },
  { name: 'Bruno Andrade', handle: '@BrunoAndradeCB' },
  { name: 'Fabi Ferreira', handle: '@FabiFerreiraFC' },
]

const PAGES = [
  { name: 'ge Notícias', handle: '@geNoticias' },
  { name: 'Footy News', handle: '@FootyNewsBR' },
  { name: 'Bola na Rede', handle: '@BolaNaRedeOf' },
  { name: 'Transfer Watch', handle: '@TransferWatch' },
  { name: 'Mundo da Bola', handle: '@MundoDaBolaBR' },
]

const FANS = [
  { name: 'torcedor raiz', handle: '@torcedorraiz' },
  { name: 'Beira de Campo', handle: '@beiradecampo' },
  { name: 'arquibancada', handle: '@arquibancadafc' },
  { name: 'só futebol', handle: '@sofutebolbr' },
  { name: 'Nação', handle: '@nacaonasarq' },
]

const MARKET = [
  { name: 'Mercado da Bola', handle: '@MercadoDaBolaOf' },
  { name: 'Radar de Transferências', handle: '@RadarTransfers' },
  { name: 'Olho no Mercado', handle: '@OlhoNoMercado' },
]

function author(rng: Rng, kind: SocialAuthorKind): { name: string; handle: string; verified: boolean } {
  switch (kind) {
    case 'jornalista':
      return { ...pick(rng, JOURNALISTS), verified: true }
    case 'pagina':
      return { ...pick(rng, PAGES), verified: true }
    case 'mercado':
      return { ...pick(rng, MARKET), verified: true }
    case 'oficial':
      return { name: '', handle: '', verified: true }
    case 'torcedor':
      return { ...pick(rng, FANS), verified: false }
  }
}

/** Engajamento cresce com o alcance — um post local nao tem os mesmos números de um mundial. */
const ENGAGEMENT_BASE: Record<NewsReach, { likes: number; reposts: number; comments: number }> = {
  local: { likes: 40, reposts: 4, comments: 6 },
  nacional: { likes: 900, reposts: 120, comments: 90 },
  continental: { likes: 12000, reposts: 2200, comments: 800 },
  mundial: { likes: 140000, reposts: 32000, comments: 9000 },
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')}mil`
  return `${value}`
}

type PostInput = {
  kind: SocialAuthorKind
  tag: string
  text: string
  reach: NewsReach
  /** Um clube oficial posta com o nome dele, e nao com um perfil sorteado. */
  officialName?: string
}

function makePost(
  context: { season: string; round: number | null },
  rng: Rng,
  input: PostInput,
): SocialPost {
  const who =
    input.kind === 'oficial' && input.officialName
      ? { name: input.officialName, handle: `@${slugTag(input.officialName)}`, verified: true }
      : author(rng, input.kind)

  const base = ENGAGEMENT_BASE[input.reach]

  return {
    id: `${context.season}-${context.round ?? 'temporada'}-${Math.floor(rng() * 1e9).toString(36)}`,
    kind: input.kind,
    name: who.name,
    handle: who.handle,
    verified: who.verified,
    tag: input.tag,
    text: input.text,
    reach: input.reach,
    likes: Math.round(base.likes * jitter(rng, 0.5)),
    reposts: Math.round(base.reposts * jitter(rng, 0.5)),
    comments: Math.round(base.comments * jitter(rng, 0.5)),
    season: context.season,
    round: context.round,
  }
}

/** Um degrau abaixo — acontecimento pequeno de jogador grande nao vira post mundial. */
function lower(reach: NewsReach): NewsReach {
  const order: NewsReach[] = ['local', 'nacional', 'continental', 'mundial']
  return order[Math.max(0, order.indexOf(reach) - 1)]
}

function isAttacker(position: Position): boolean {
  return position === 'ATA' || position === 'SA' || position === 'PON'
}

const EU_COUNTRIES = new Set(['EN', 'ES', 'IT', 'DE', 'FR', 'PT', 'NL'])

// ————————————————————————————————————————————————————————————————
// Partida a partida
// ————————————————————————————————————————————————————————————————

/**
 * Os posts que uma rodada rende.
 *
 * `everPlayed` diz se o jogador ja tinha entrado em campo profissionalmente
 * antes deste jogo — e o que separa a estreia de qualquer outro jogo de
 * temporada, e so quem chama sabe disso (o numero de temporadas fechadas mais
 * o que ja rolou nesta).
 */
export function socialFromMatch(
  context: NewsContext,
  log: MatchdayLog[],
  everPlayedBefore: boolean,
  rng: Rng,
): SocialPost[] {
  const entry = log[log.length - 1]
  if (!entry) return []

  const reach = reachOfSocial(context)
  const out: SocialPost[] = []
  const { player } = entry
  const club = context.clubName
  const ctx = { season: context.season, round: entry.round }

  const won = entry.teamGoals > entry.opponentGoals
  const lost = entry.teamGoals < entry.opponentGoals

  if (player.played && !everPlayedBefore) {
    out.push(
      makePost(ctx, rng, {
        kind: 'pagina',
        tag: 'ESTREIA',
        reach,
        text: pick(rng, [
          `⚽ ESTREIA PROFISSIONAL\n\n${context.playerName}, ${context.age} anos, fez sua primeira partida como profissional hoje, pelo ${club}. 🌱\n\nComeça aqui.\n\n#Estreia #${slugTag(club)}`,
          `Aconteceu agora: ${context.playerName} estreou pelo ${club} hoje. 🎽\n\nMais um nome novo em campo.\n\n#Estreia #Futebol`,
        ]),
      }),
    )
  }

  if (player.played && player.goals >= 3) {
    out.push(
      makePost(ctx, rng, {
        kind: 'jornalista',
        tag: 'HAT-TRICK',
        reach,
        text: pick(rng, [
          `🎩 HAT-TRICK!\n\n${context.playerName} marcou TRÊS VEZES na vitória do ${club} por ${entry.teamGoals} a ${entry.opponentGoals}! 🔥⚽⚽⚽\n\nQue atuação.\n\n#HatTrick #${slugTag(club)}`,
          `Três gols. Um jogador só. ${context.playerName} destruiu a defesa adversária hoje pelo ${club}. 🎩🔥\n\n#HatTrick #Futebol`,
        ]),
      }),
      makePost(ctx, rng, {
        kind: 'torcedor',
        tag: 'HAT-TRICK',
        reach: lower(reach),
        text: pick(rng, [
          `NÃO ACREDITO NO QUE ACABEI DE VER 😭🔥 HAT-TRICK DO ${context.playerName.toUpperCase()}!!! GENIAL`,
          `${context.playerName} é diferente de todo mundo, gente. Três gols hoje. Levem esse nome a sério. ⚽⚽⚽`,
        ]),
      }),
    )
  } else if (player.played && player.goals === 2) {
    out.push(
      makePost(ctx, rng, {
        kind: 'pagina',
        tag: 'DOIS GOLS',
        reach: lower(reach),
        text: pick(rng, [
          `⚽⚽ Dois gols de ${context.playerName} hoje! ${club} ${won ? 'venceu' : lost ? 'perdeu' : 'empatou'} por ${entry.teamGoals} a ${entry.opponentGoals}.\n\n#${slugTag(club)}`,
          `Duas bolas na rede pra ${context.playerName} nesta rodada. Sequência boa. 📈\n\n#Futebol`,
        ]),
      }),
    )
  } else if (player.played && player.goals === 1 && player.rating >= 7.5) {
    out.push(
      makePost(ctx, rng, {
        kind: 'torcedor',
        tag: 'DECISIVO',
        reach: lower(reach),
        text: pick(rng, [
          `${context.playerName} decidiu o jogo hoje. Nota ${player.rating.toFixed(1)}, melhor em campo. 🙌`,
          `Que golaço do ${context.playerName}! ${club} ${won ? 'venceu' : 'buscou o resultado'} graças a ele hoje. ⚽`,
        ]),
      }),
    )
  }

  if (player.played && player.assists >= 2) {
    out.push(
      makePost(ctx, rng, {
        kind: 'pagina',
        tag: 'ASSISTÊNCIAS',
        reach: lower(reach),
        text: pick(rng, [
          `🅰️🅰️ ${context.playerName} deu DUAS assistências hoje pelo ${club}. Quem joga do lado dele agradece.\n\n#${slugTag(club)}`,
          `Craque de passe: ${context.playerName} construiu dois gols do ${club} nesta rodada. 🅰️`,
        ]),
      }),
    )
  }

  if (player.injured) {
    out.push(
      makePost(ctx, rng, {
        kind: 'jornalista',
        tag: 'LESÃO',
        reach: lower(reach),
        text: pick(rng, [
          `🩹 ${context.playerName} deixou o campo sentindo dores hoje e será avaliado pelo departamento médico do ${club}.\n\nSem prazo de retorno estimado.`,
          `Susto no ${club}: ${context.playerName} saiu machucado no jogo de hoje. Acompanhamos a evolução. 🩹`,
        ]),
      }),
    )
  }

  if (player.red) {
    out.push(
      makePost(ctx, rng, {
        kind: 'torcedor',
        tag: 'EXPULSÃO',
        reach: lower(reach),
        text: pick(rng, [
          `${context.playerName} tomou vermelho hoje e deixou o ${club} com um a menos. Dia difícil. 🟥`,
          `Cartão vermelho pra ${context.playerName}. O time sentiu a falta dele em campo. 🟥`,
        ]),
      }),
    )
  }

  if (player.played && player.rating <= 4.5) {
    out.push(
      makePost(ctx, rng, {
        kind: 'torcedor',
        tag: 'CRÍTICA',
        reach: lower(reach),
        text: pick(rng, [
          `${context.playerName} teve uma tarde pra esquecer hoje. Nota ${player.rating.toFixed(1)} e vaias no fim. 😡`,
          `Precisa melhorar. ${context.playerName} não teve o jogo de sempre hoje pelo ${club}. 📉`,
        ]),
      }),
    )
  }

  if (out.length === 0) {
    const streak = streaksOf(log)

    if (streak.scoring >= 3) {
      out.push(
        makePost(ctx, rng, {
          kind: 'jornalista',
          tag: 'SEQUÊNCIA',
          reach,
          text: pick(rng, [
            `🔥 ${context.playerName} balançou a rede pelo ${ordinal(streak.scoring)} jogo seguido. Sequência que chama atenção.\n\n#${slugTag(club)}`,
            `${streak.scoring} jogos seguidos marcando. ${context.playerName} está em outro nível agora. 🔥⚽`,
          ]),
        }),
      )
    } else if (streak.goalless >= 6 && isAttacker(context.position)) {
      out.push(
        makePost(ctx, rng, {
          kind: 'torcedor',
          tag: 'SECA',
          reach: lower(reach),
          text: pick(rng, [
            `${streak.goalless} jogos sem marcar. A cobrança já começou a aparecer nas redes. 📉 #${slugTag(club)}`,
            `Precisamos falar sobre a seca do ${context.playerName}... ${streak.goalless} jogos sem gol. 😕`,
          ]),
        }),
      )
    } else if (streak.benched >= 4) {
      out.push(
        makePost(ctx, rng, {
          kind: 'jornalista',
          tag: 'BANCO',
          reach: lower(reach),
          text: `${context.playerName} soma ${streak.benched} jogos seguidos sem entrar em campo pelo ${club}. Bastidores apontam conversa do empresário com a diretoria. 🪑`,
        }),
      )
    }
  }

  return out.slice(0, 2)
}

// ————————————————————————————————————————————————————————————————
// Fim de temporada
// ————————————————————————————————————————————————————————————————

export function socialFromSeason(
  context: NewsContext,
  career: CareerState,
  record: SeasonRecord,
  previous: SeasonRecord | null,
  rng: Rng,
): SocialPost[] {
  const reach = reachOfSocial(context)
  const out: SocialPost[] = []
  const ctx = { season: context.season, round: null }
  const club = context.clubName

  for (const award of record.awards) {
    out.push(...awardPosts(ctx, context, award, rng))
  }

  const national = record.national
  if (national?.tournament?.won) {
    out.push(
      makePost(ctx, rng, {
        kind: 'oficial',
        officialName: nationById(national.nationId)?.name ?? 'Seleção',
        tag: 'CAMPEÃO',
        reach: 'mundial',
        text: `🏆 CAMPEÕES! ${context.playerName} é campeão da ${national.tournament.name} pela seleção! 🇧🇷\n\nHistória sendo escrita.\n\n#Campeões`,
      }),
    )
  }

  if (record.champion) {
    const league = leagueById(record.leagueId)
    out.push(
      makePost(ctx, rng, {
        kind: 'pagina',
        tag: 'TÍTULO',
        reach,
        text: pick(rng, [
          `🏆 CAMPEÃO! ${club} conquista o ${league?.name ?? 'campeonato'} com ${context.playerName} em campo!\n\n#Campeão #${slugTag(club)}`,
          `É CAMPEÃO! O ${club} levanta a taça do ${league?.name ?? 'campeonato'} nesta temporada. 🏆🎉\n\n#${slugTag(club)}`,
        ]),
      }),
    )
  }

  for (const run of record.cups) {
    if (run.won) out.push(...cupPost(ctx, context, run, rng))
  }

  if (record.promoted) {
    out.push(
      makePost(ctx, rng, {
        kind: 'pagina',
        tag: 'ACESSO',
        reach,
        text: `📈 ACESSO GARANTIDO! O ${club} sobe de divisão, e ${context.playerName} foi peça importante na campanha.\n\n#Acesso #${slugTag(club)}`,
      }),
    )
  }

  if (record.relegated) {
    out.push(
      makePost(ctx, rng, {
        kind: 'torcedor',
        tag: 'REBAIXAMENTO',
        reach: lower(reach),
        text: `Temporada pra esquecer. O ${club} caiu de divisão. Momento de reconstruir. 😔`,
      }),
    )
  }

  // — convocação para a seleção
  if (national && !national.tournament) {
    const previouslyCalled = !!previous?.national
    out.push(
      makePost(ctx, rng, {
        kind: 'jornalista',
        tag: 'SELEÇÃO',
        reach,
        text: previouslyCalled
          ? `${context.playerName} segue no radar da seleção e volta a ser convocado nesta temporada. 🌍`
          : pick(rng, [
              `🌍 CONVOCADO! ${context.playerName} recebe sua primeira convocação para a seleção. Um sonho realizado.\n\n#Seleção`,
              `Novidade na lista: ${context.playerName} é chamado pela primeira vez para defender a seleção. 🇧🇷🌍`,
            ]),
      }),
    )
  }

  // — evolução / crescimento
  if (record.growth.length > 0) {
    out.push(
      makePost(ctx, rng, {
        kind: 'pagina',
        tag: 'EVOLUÇÃO',
        reach: lower(reach),
        text: `📈 Temporada de evolução: ${context.playerName} termina o ano mais forte do que começou. Trabalho aparecendo.\n\n#${slugTag(club)}`,
      }),
    )
  }

  // — crescimento de reputação, quando cruza uma faixa (Regional -> Nacional etc)
  const prevReach = previous ? reputationLabel(previous.morale.reputation) : 'Desconhecido'
  const nowReach = reputationLabel(record.morale.reputation)
  if (prevReach !== nowReach) {
    out.push(
      makePost(ctx, rng, {
        kind: 'jornalista',
        tag: 'EM ALTA',
        reach,
        text: `⭐ O nome de ${context.playerName} está crescendo. De um ano pro outro, o alcance mudou — hoje ${nowReach === 'Mundial' ? 'é conhecido no mundo inteiro' : `sua reputação já é ${nowReach.toLowerCase()}`}.`,
      }),
    )
  }

  // — pressão da torcida por renovação (último ano de contrato, boa fase)
  if (career.contract.seasonsLeft <= 1 && record.stats.rating >= 6.8) {
    out.push(
      makePost(ctx, rng, {
        kind: 'torcedor',
        tag: 'RENOVAÇÃO',
        reach: lower(reach),
        text: pick(rng, [
          `Precisamos falar sobre a renovação do ${context.playerName} JÁ. Contrato acabando e a diretoria enrolando. ❤️`,
          `${club} não pode deixar o contrato do ${context.playerName} vencer sem renovar. Ele é peça importante demais. ❤️`,
        ]),
      }),
    )
  }

  // — rumor de saída (último ano, sem boa fase)
  if (career.contract.seasonsLeft <= 1 && record.stats.rating < 6.2 && !career.renewal) {
    out.push(
      makePost(ctx, rng, {
        kind: 'jornalista',
        tag: 'BASTIDORES',
        reach: lower(reach),
        text: `📰 Bastidores: o vínculo de ${context.playerName} com o ${club} está perto do fim, e o clube ainda não sinalizou renovação.`,
      }),
    )
  }

  // — recorde/meta pessoal: numeros redondos de gols na temporada
  if ([10, 15, 20, 25, 30].includes(record.stats.goals)) {
    out.push(
      makePost(ctx, rng, {
        kind: 'pagina',
        tag: 'MARCA',
        reach,
        text: `🎯 ${context.playerName} chega aos ${record.stats.goals} gols na temporada pelo ${club}. Marca alcançada. #${slugTag(club)}`,
      }),
    )
  }

  // — comparação com grandes, so junto de Bola de Ouro ou reputacao mundial
  if (record.awards.includes('bola-de-ouro')) {
    out.push(
      makePost(ctx, rng, {
        kind: 'torcedor',
        tag: 'GOAT?',
        reach: 'mundial',
        text: pick(rng, [
          `Com essa temporada, ${context.playerName} já entra na conversa dos maiores da atualidade. 🐐👑`,
          `Bola de Ouro no bolso. ${context.playerName} está escrevendo história. 🐐🥇`,
        ]),
      }),
    )
  } else if (nowReach === 'Mundial') {
    out.push(
      makePost(ctx, rng, {
        kind: 'jornalista',
        tag: 'DESTAQUE',
        reach: 'mundial',
        text: `👑 ${context.playerName} entra de vez na conversa sobre os melhores do mundo na posição. O nome já circula fora das fronteiras. 🇺🇳`,
      }),
    )
  }

  // — fecho: fim de temporada, sempre entra por ultimo
  out.push(
    makePost(ctx, rng, {
      kind: 'pagina',
      tag: 'TEMPORADA',
      reach: lower(reach),
      text: `📅 Fim de temporada pelo ${club}: ${record.stats.matches} jogos, ${record.stats.goals} gols e ${record.stats.assists} assistências. Próximo capítulo já começa.`,
    }),
  )

  return out.slice(0, budgetFor(record.morale.reputation))
}

function awardPosts(
  ctx: { season: string; round: number | null },
  context: NewsContext,
  award: Award,
  rng: Rng,
): SocialPost[] {
  if (award === 'bola-de-ouro') {
    return [
      makePost(ctx, rng, {
        kind: 'oficial',
        officialName: 'Bola de Ouro',
        tag: 'BOLA DE OURO',
        reach: 'mundial',
        text: `🥇 ${context.playerName.toUpperCase()} É O VENCEDOR DA BOLA DE OURO! 🏆✨\n\nO reconhecimento de melhor jogador do mundo na temporada.\n\n#BolaDeOuro`,
      }),
      makePost(ctx, rng, {
        kind: 'torcedor',
        tag: 'BOLA DE OURO',
        reach: 'mundial',
        text: `MERECIDÍSSIMO!!! ${context.playerName} Bola de Ouro, minha gente!! Que temporada, que carreira 🥇😭🔥`,
      }),
    ]
  }

  return [
    makePost(ctx, rng, {
      kind: 'pagina',
      tag: AWARD_LABEL[award].toUpperCase(),
      reach: reachOfSocial(context),
      text: `🥇 ${context.playerName} conquista a ${AWARD_LABEL[award]} da temporada! Artilheiro de respeito.\n\n#${slugTag(AWARD_LABEL[award])}`,
    }),
  ]
}

function cupPost(
  ctx: { season: string; round: number | null },
  context: NewsContext,
  run: CompetitionRun,
  rng: Rng,
): SocialPost[] {
  const club = context.clubName
  const reach = reachOfSocial(context)

  return [
    makePost(ctx, rng, {
      kind: 'pagina',
      tag: 'TÍTULO',
      reach,
      text: pick(rng, [
        `🏆 O ${club} é CAMPEÃO da ${run.name}! ${context.playerName} levanta mais uma taça. 🎉\n\n#${slugTag(club)}`,
        `TETRA? PENTA? Não importa o número — o ${club} conquista a ${run.name} nesta temporada! 🏆\n\n#${slugTag(club)}`,
      ]),
    }),
  ]
}

// ————————————————————————————————————————————————————————————————
// Mercado
// ————————————————————————————————————————————————————————————————

/** Um post por proposta real na mesa — nunca um clube incompatível com o nível do jogador. */
export function socialFromOffer(
  context: NewsContext,
  clubId: string,
  terms: ContractTerms,
  rng: Rng,
): SocialPost[] {
  const club = clubById(clubId)
  if (!club) return []

  const league = leagueOf(club)
  const reach = reachOfSocial(context)
  const ctx = { season: context.season, round: null }

  if (league.country === 'SA') {
    return [
      makePost(ctx, rng, {
        kind: 'mercado',
        tag: 'MERCADO DA BOLA',
        reach,
        text: `🚨 MERCADO DA BOLA 🚨\n\nO ${club.name} prepara uma proposta pelo ${context.playerName}! 🇸🇦\n\nO clube árabe estaria disposto a oferecer salário de ${formatSalary(terms.salary)} por temporada para convencer o jogador.\n\n💰 Negociação promete esquentar.\n\n#MercadoDaBola #ArábiaSaudita`,
      }),
    ]
  }

  if (league.country === 'TR') {
    return [
      makePost(ctx, rng, {
        kind: 'mercado',
        tag: 'MERCADO DA BOLA',
        reach,
        text: `🚨 O ${club.name} entrou em contato pelo ${context.playerName}! 🇹🇷\n\nProposta de ${terms.years} temporada${terms.years > 1 ? 's' : ''} sobre a mesa.\n\n#MercadoDaBola #SüperLig`,
      }),
    ]
  }

  if (EU_COUNTRIES.has(league.country)) {
    return [
      makePost(ctx, rng, {
        kind: 'jornalista',
        tag: 'BASTIDORES DO FUTEBOL',
        reach,
        text: pick(rng, [
          `🚨 BASTIDORES DO FUTEBOL\n\nO ${club.name} entrou em contato com o empresário de ${context.playerName}.\n\nO jogador vem sendo observado e pode receber proposta oficial ainda nesta janela. 👀\n\nMais informações em breve.\n\n#Futebol #MercadoDaBola`,
          `👀 Olheiros do ${club.name} estiveram de olho em ${context.playerName} nesta temporada. O interesse é real.\n\n#MercadoDaBola`,
        ]),
      }),
    ]
  }

  return [
    makePost(ctx, rng, {
      kind: 'pagina',
      tag: 'PROPOSTA',
      reach: lower(reach),
      text: `📝 O ${club.name} apresentou proposta oficial pelo ${context.playerName}. Empresário já avalia os termos.\n\n#MercadoDaBola`,
    }),
  ]
}

/** O anuncio da transferencia — so quando ela de fato acontece. */
export function socialFromTransfer(
  context: NewsContext,
  clubName: string,
  rng: Rng,
): SocialPost[] {
  const reach = reachOfSocial(context)
  const ctx = { season: context.season, round: null }

  return [
    makePost(ctx, rng, {
      kind: 'oficial',
      officialName: clubName,
      tag: 'É OFICIAL',
      reach,
      text: `✈️ BEM-VINDO! ${context.playerName} é o novo reforço do ${clubName}. Contrato assinado. 🖊️\n\n#${slugTag(clubName)}`,
    }),
    makePost(ctx, rng, {
      kind: 'jornalista',
      tag: 'TRANSFERÊNCIA',
      reach,
      text: `🔄 Confirmado: ${context.playerName} deixa o ${context.clubName} rumo ao ${clubName}. Mudança de ares numa carreira que segue em ascensão.`,
    }),
  ]
}

export function socialFromFarewell(context: NewsContext, rng: Rng): SocialPost[] {
  const ctx = { season: context.season, round: null }

  return [
    makePost(ctx, rng, {
      kind: 'oficial',
      officialName: context.clubName,
      tag: 'DESPEDIDA',
      reach: lower(reachOfSocial(context)),
      text: `👋 Obrigado por tudo, ${context.playerName}. O ${context.clubName} deseja sucesso na nova etapa da carreira.`,
    }),
  ]
}

/** Renovacao assinada. */
export function socialFromRenewal(context: NewsContext, rng: Rng): SocialPost[] {
  const ctx = { season: context.season, round: null }
  const reach = reachOfSocial(context)

  return [
    makePost(ctx, rng, {
      kind: 'oficial',
      officialName: context.clubName,
      tag: 'RENOVAÇÃO',
      reach: lower(reach),
      text: `📝 ${context.playerName} renovou contrato com o ${context.clubName}! Seguimos juntos. ✍️❤️\n\n#${slugTag(context.clubName)}`,
    }),
    makePost(ctx, rng, {
      kind: 'torcedor',
      tag: 'RENOVAÇÃO',
      reach: lower(reach),
      text: `RENOVOOOU! 😭❤️ Segue com a gente mais um pouco. Notícia que a torcida do ${context.clubName} queria.`,
    }),
  ]
}

// ————————————————————————————————————————————————————————————————
// Suporte
// ————————————————————————————————————————————————————————————————

/**
 * Ate onde o post chega — a mesma logica de `news.ts:reachOf`, replicada
 * aqui para nao criar um acoplamento circular entre os dois modulos, que
 * escrevem para publicos diferentes a partir do mesmo contexto.
 */
export function reachOfSocial(context: NewsContext): NewsReach {
  if (context.leagueTier >= 3) return 'local'
  if (context.leagueTier === 2) {
    return context.reputation >= 45 ? 'nacional' : 'local'
  }

  const standing = context.clubStrength + context.reputation * 0.5

  if (standing >= 115) return 'mundial'
  if (standing >= 92) return 'continental'
  if (standing >= 74) return 'nacional'
  return 'local'
}

/**
 * Quantos posts a temporada rende, no maximo.
 *
 * Jogador desconhecido nao enche o feed: poucas linhas, repercussao local. Um
 * astro mundial gera timeline cheia. E o pedido de que a intensidade da rede
 * cresca com a relevancia do jogador, e nao so o alcance de cada post
 * isolado.
 */
function budgetFor(reputation: number): number {
  const label = reputationLabel(reputation)
  switch (label) {
    case 'Mundial':
      return 14
    case 'Continental':
      return 10
    case 'Nacional':
      return 7
    case 'Regional':
      return 5
    default:
      return 3
  }
}

function slugTag(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
}

function ordinal(value: number): string {
  return `${clamp(value, 1, 99)}º`
}
