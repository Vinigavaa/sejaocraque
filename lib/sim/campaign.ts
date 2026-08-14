import {
  FINAL_STAGE,
  largestPowerOfTwo,
  roundName,
  type Contender,
  type KnockoutMatch,
} from './competitions'
import { jitter, sample, type Rng } from './rng'
import { simulateMatch } from './season'
import {
  GROUP_ROUNDS,
  GROUP_SIZE,
  GROUP_STAGE,
  groupName,
  QUALIFIERS_PER_GROUP,
} from './tournament'

/**
 * Uma copa ou competicao continental disputada **rodada a rodada**.
 *
 * `simulateKnockout` e `simulateGroupTournament` resolvem a competicao inteira
 * numa chamada: entram os participantes, sai o campeao. Isso basta para o modo
 * Classico e para o resto do mundo, mas nao serve para o modo Jogo a Jogo —
 * ali a partida do clube do jogador nao pode ser sorteada, ela precisa ser
 * jogada, e para isso a competicao tem que parar antes de cada confronto dele.
 *
 * `Campaign` e essa mesma competicao com pausa: ela sabe qual e o proximo
 * confronto do clube do jogador, recebe o placar de fora e resolve sozinha
 * tudo o que aconteceu em volta. Quando o clube cai, ela continua ate o fim
 * mesmo assim — o mundo precisa saber quem foi o campeao.
 *
 * O estado e so dado, sem funcao nem `Map`, porque ele entra no save junto com
 * a temporada em curso.
 */
export type Campaign = {
  id: string
  name: string
  /** O clube do jogador — o unico que pausa a competicao. */
  clubId: string
  /** Grupos da primeira fase. Vazio nas competicoes de mata-mata puro. */
  groups: Contender[][]
  /** Quantas rodadas de grupo ja foram disputadas, de 0 a 3. */
  groupRound: number
  /** A tabela do grupo do jogador. Vazia sem fase de grupos. */
  groupTable: GroupRow[]
  /** A rodada em disputa. `null` quando a competicao acabou. */
  round: CampaignRound
  /** O caminho do clube do jogador, na ordem das fases. */
  path: KnockoutMatch[]
  /** Fase em que o clube do jogador caiu. `null` enquanto ele segue vivo. */
  eliminatedIn: string | null
  /** Campeao da competicao. `null` enquanto ela nao terminou. */
  winnerId: string | null
  /** Quantas datas do calendario a campanha ocupa na temporada. */
  dates: number
}

export type GroupRow = {
  clubId: string
  points: number
  goalsFor: number
  goalsAgainst: number
}

export type CampaignRound =
  | { kind: 'grupo'; index: number }
  | { kind: 'mata-mata'; stage: string; ties: [Contender, Contender][] }
  | null

/** O confronto do clube do jogador na rodada em disputa. */
export type CampaignFixture = {
  opponentId: string
  atHome: boolean
  stage: string
}

export function startCampaign(
  input: {
    id: string
    name: string
    /** Todos os inscritos, na ordem que vier. */
    entrants: Contender[]
    clubId: string
    /**
     * Se a competicao tem fase de grupos. As continentais tem; a copa nacional
     * e mata-mata do primeiro jogo, como no futebol de verdade.
     */
    withGroups: boolean
  },
  rng: Rng,
): Campaign {
  const { id, name, clubId, withGroups } = input

  const base: Omit<Campaign, 'groups' | 'round' | 'dates'> = {
    id,
    name,
    clubId,
    groupRound: 0,
    groupTable: [],
    path: [],
    eliminatedIn: null,
    winnerId: null,
  }

  if (withGroups) {
    const groups = drawGroups(input.entrants, clubId, rng)

    if (groups.length > 0) {
      const pool = groups.length * QUALIFIERS_PER_GROUP

      return {
        ...base,
        groups,
        groupTable: groups[0].map(emptyRow),
        round: { kind: 'grupo', index: 0 },
        dates: GROUP_ROUNDS.length + knockoutRounds(pool),
      }
    }
  }

  const alive = draw(input.entrants, clubId, largestPowerOfTwo(input.entrants.length), rng)

  return {
    ...base,
    groups: [],
    round: drawRound(alive, rng),
    dates: knockoutRounds(alive.length),
  }
}

/** Se o clube do jogador ainda esta na competicao. */
function isAlive(campaign: Campaign): boolean {
  return campaign.eliminatedIn === null && campaign.winnerId === null
}

/**
 * O proximo confronto do clube do jogador, ou `null` quando ele nao tem jogo
 * nesta data — porque caiu, porque a competicao acabou, ou porque ele nem
 * entrou na chave.
 */
export function campaignFixture(campaign: Campaign): CampaignFixture | null {
  const { round } = campaign
  if (!round || !isAlive(campaign)) return null

  if (round.kind === 'grupo') {
    const group = campaign.groups[0]
    const pairing = GROUP_ROUNDS[round.index].find(
      ([home, away]) => group[home].id === campaign.clubId || group[away].id === campaign.clubId,
    )
    if (!pairing) return null

    const atHome = group[pairing[0]].id === campaign.clubId
    return {
      opponentId: atHome ? group[pairing[1]].id : group[pairing[0]].id,
      atHome,
      stage: `Grupo ${groupName(0)} · ${round.index + 1}ª rodada`,
    }
  }

  const tie = round.ties.find(
    ([home, away]) => home.id === campaign.clubId || away.id === campaign.clubId,
  )
  if (!tie) return null

  const atHome = tie[0].id === campaign.clubId
  return {
    opponentId: atHome ? tie[1].id : tie[0].id,
    atHome,
    stage: round.stage,
  }
}

/**
 * Resolve a rodada em disputa e devolve a campanha na rodada seguinte.
 *
 * `played` e o placar da partida do clube do jogador, pelo lado dele. Vem
 * `null` quando ele nao tinha jogo — e entao a rodada corre inteira pela
 * simulacao, que e exatamente o que acontece no modo Classico.
 */
export function advanceCampaign(
  campaign: Campaign,
  played: { forGoals: number; againstGoals: number } | null,
  rng: Rng,
): Campaign {
  const { round } = campaign
  if (!round) return campaign

  return round.kind === 'grupo'
    ? advanceGroupRound(campaign, round.index, played, rng)
    : advanceKnockoutRound(campaign, round.stage, round.ties, played, rng)
}

// ── Fase de grupos ───────────────────────────────────────────────────

function advanceGroupRound(
  campaign: Campaign,
  index: number,
  played: { forGoals: number; againstGoals: number } | null,
  rng: Rng,
): Campaign {
  const group = campaign.groups[0]
  const table = campaign.groupTable.map((row) => ({ ...row }))
  const rowOf = (clubId: string) => table.find((row) => row.clubId === clubId)
  const path = [...campaign.path]
  const stage = `Grupo ${groupName(0)} · ${index + 1}ª rodada`

  for (const [homeIndex, awayIndex] of GROUP_ROUNDS[index]) {
    const home = group[homeIndex]
    const away = group[awayIndex]
    const isPlayerMatch = home.id === campaign.clubId || away.id === campaign.clubId

    let homeGoals: number
    let awayGoals: number

    if (isPlayerMatch && played) {
      const atHome = home.id === campaign.clubId
      homeGoals = atHome ? played.forGoals : played.againstGoals
      awayGoals = atHome ? played.againstGoals : played.forGoals
    } else {
      ;[homeGoals, awayGoals] = playMatch(home, away, rng)
    }

    record(rowOf(home.id), homeGoals, awayGoals)
    record(rowOf(away.id), awayGoals, homeGoals)

    if (isPlayerMatch) {
      const atHome = home.id === campaign.clubId
      path.push({
        stage,
        opponentId: atHome ? away.id : home.id,
        forGoals: atHome ? homeGoals : awayGoals,
        againstGoals: atHome ? awayGoals : homeGoals,
        onPenalties: false,
        won: atHome ? homeGoals > awayGoals : awayGoals > homeGoals,
      })
    }
  }

  const groupRound = index + 1

  if (groupRound < GROUP_ROUNDS.length) {
    return {
      ...campaign,
      groupTable: table,
      groupRound,
      path,
      round: { kind: 'grupo', index: groupRound },
    }
  }

  return openKnockout({ ...campaign, groupTable: table, groupRound, path }, table, rng)
}

/**
 * Fecha a fase de grupos e abre o mata-mata.
 *
 * Os outros grupos sao resolvidos aqui, de uma vez: eles nao dependem do
 * jogador e nao ha nada a decidir neles. So o grupo dele foi disputado rodada
 * a rodada.
 */
function openKnockout(campaign: Campaign, table: GroupRow[], rng: Rng): Campaign {
  const group = campaign.groups[0]
  const ranked = [...table].sort(compareRows)
  const byId = (clubId: string) => group.find((side) => side.id === clubId)!

  const qualified: Contender[] = ranked
    .slice(0, QUALIFIERS_PER_GROUP)
    .map((row) => byId(row.clubId))

  const eliminated = ranked.slice(QUALIFIERS_PER_GROUP).map((row) => row.clubId)

  for (const other of campaign.groups.slice(1)) {
    qualified.push(...playWholeGroup(other, rng))
  }

  if (eliminated.includes(campaign.clubId)) {
    // O clube caiu na fase de grupos, mas a competicao segue: o mata-mata
    // ainda precisa ser corrido ate sair um campeao.
    const alive = draw(qualified, null, largestPowerOfTwo(qualified.length), rng)

    return {
      ...campaign,
      eliminatedIn: GROUP_STAGE,
      round: drawRound(alive, rng),
    }
  }

  const alive = draw(qualified, campaign.clubId, largestPowerOfTwo(qualified.length), rng)

  return { ...campaign, round: drawRound(alive, rng) }
}

/** Um grupo inteiro de uma vez. Devolve os classificados. */
function playWholeGroup(group: Contender[], rng: Rng): Contender[] {
  const table = group.map(emptyRow)
  const rowOf = (clubId: string) => table.find((row) => row.clubId === clubId)

  for (const round of GROUP_ROUNDS) {
    for (const [homeIndex, awayIndex] of round) {
      const [homeGoals, awayGoals] = playMatch(group[homeIndex], group[awayIndex], rng)

      record(rowOf(group[homeIndex].id), homeGoals, awayGoals)
      record(rowOf(group[awayIndex].id), awayGoals, homeGoals)
    }
  }

  return [...table]
    .sort(compareRows)
    .slice(0, QUALIFIERS_PER_GROUP)
    .map((row) => group.find((side) => side.id === row.clubId)!)
}

// ── Mata-mata ────────────────────────────────────────────────────────

function advanceKnockoutRound(
  campaign: Campaign,
  stage: string,
  ties: [Contender, Contender][],
  played: { forGoals: number; againstGoals: number } | null,
  rng: Rng,
): Campaign {
  const survivors: Contender[] = []
  const path = [...campaign.path]
  let eliminatedIn = campaign.eliminatedIn

  for (const [home, away] of ties) {
    const isPlayerMatch = home.id === campaign.clubId || away.id === campaign.clubId
    const atHome = home.id === campaign.clubId

    const tie =
      isPlayerMatch && played
        ? decideTie(home, away, atHome ? played.forGoals : played.againstGoals,
            atHome ? played.againstGoals : played.forGoals, rng)
        : playTie(home, away, rng)

    survivors.push(tie.winner)

    if (!isPlayerMatch) continue

    const won = tie.winner.id === campaign.clubId
    path.push({
      stage,
      opponentId: won ? tie.loser.id : tie.winner.id,
      forGoals: won ? tie.winnerGoals : tie.loserGoals,
      againstGoals: won ? tie.loserGoals : tie.winnerGoals,
      onPenalties: tie.onPenalties,
      won,
    })

    if (!won) eliminatedIn = stage
  }

  if (survivors.length === 1) {
    return {
      ...campaign,
      path,
      eliminatedIn,
      winnerId: survivors[0].id,
      round: null,
    }
  }

  return { ...campaign, path, eliminatedIn, round: drawRound(survivors, rng) }
}

/**
 * O sorteio da fase seguinte. Aceita numero impar de sobreviventes sem
 * quebrar: o excedente entra classificado, que e o equivalente pratico de um
 * bye — a mesma regra que `simulateKnockout` ja aplica.
 */
function drawRound(alive: Contender[], rng: Rng): CampaignRound {
  if (alive.length < 2) return null

  const drawn = sample(rng, alive, alive.length)
  const stage = roundName(drawn.length)
  const ties: [Contender, Contender][] = []

  for (let index = 0; index + 1 < drawn.length; index += 2) {
    ties.push([drawn[index], drawn[index + 1]])
  }

  return { kind: 'mata-mata', stage, ties }
}

/**
 * Mata-mata nao aceita empate. Com o placar decidido de fora — a partida do
 * jogador —, o empate vai para um desempate ponderado pela forca, que e o
 * efeito liquido de prorrogacao e penaltis. E a mesma regra de
 * `competitions.playTie`.
 */
function decideTie(
  home: Contender,
  away: Contender,
  homeGoals: number,
  awayGoals: number,
  rng: Rng,
) {
  const homeWon =
    homeGoals !== awayGoals
      ? homeGoals > awayGoals
      : rng() < home.strength / (home.strength + away.strength)

  return {
    winner: homeWon ? home : away,
    loser: homeWon ? away : home,
    winnerGoals: homeWon ? homeGoals : awayGoals,
    loserGoals: homeWon ? awayGoals : homeGoals,
    onPenalties: homeGoals === awayGoals,
  }
}

function playTie(home: Contender, away: Contender, rng: Rng) {
  const [homeGoals, awayGoals] = playMatch(home, away, rng)
  return decideTie(home, away, homeGoals, awayGoals, rng)
}

function playMatch(home: Contender, away: Contender, rng: Rng): [number, number] {
  return simulateMatch(
    home.strength * jitter(rng, 0.09),
    away.strength * jitter(rng, 0.09),
    rng,
  )
}

// ── Sorteios e utilitarios ───────────────────────────────────────────

/**
 * A chave, com o clube do jogador garantido.
 *
 * Sortear os participantes sem garantia deixava o clube do jogador de fora da
 * propria copa em boa parte das temporadas — o resumo mostrava "nao entrou na
 * chave" e nao havia o que fazer a respeito. Na Copa do Brasil todo clube
 * entra; o corte para potencia de dois e uma limitacao do formato da
 * simulacao, e ela nao pode recair justamente sobre quem esta jogando.
 */
function draw(
  entrants: Contender[],
  clubId: string | null,
  size: number,
  rng: Rng,
): Contender[] {
  const drawn = sample(rng, entrants, size)

  if (!clubId || drawn.some((side) => side.id === clubId)) return drawn

  const player = entrants.find((side) => side.id === clubId)
  if (!player) return drawn

  return [player, ...drawn.slice(0, size - 1)]
}

/** Os grupos, com o do jogador sempre no indice zero. */
function drawGroups(entrants: Contender[], clubId: string, rng: Rng): Contender[][] {
  const size = Math.floor(entrants.length / GROUP_SIZE) * GROUP_SIZE
  if (size < GROUP_SIZE) return []

  const drawn = draw(entrants, clubId, size, rng)
  const groups: Contender[][] = []

  for (let index = 0; index < size; index += GROUP_SIZE) {
    groups.push(drawn.slice(index, index + GROUP_SIZE))
  }

  const playerGroup = groups.findIndex((group) =>
    group.some((side) => side.id === clubId),
  )

  if (playerGroup > 0) {
    ;[groups[0], groups[playerGroup]] = [groups[playerGroup], groups[0]]
  }

  return groups
}

/** Quantas fases um mata-mata com esse numero de participantes tem. */
function knockoutRounds(entrants: number): number {
  return entrants < 2 ? 0 : Math.log2(largestPowerOfTwo(entrants))
}

function emptyRow(side: Contender): GroupRow {
  return { clubId: side.id, points: 0, goalsFor: 0, goalsAgainst: 0 }
}

function record(row: GroupRow | undefined, scored: number, conceded: number): void {
  if (!row) return

  row.goalsFor += scored
  row.goalsAgainst += conceded

  if (scored > conceded) row.points += 3
  else if (scored === conceded) row.points += 1
}

function compareRows(a: GroupRow, b: GroupRow): number {
  if (b.points !== a.points) return b.points - a.points

  const diff = b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst)
  if (diff !== 0) return diff

  return b.goalsFor - a.goalsFor
}

/** Quem nem entrou na chave da competicao. */
export const NOT_ENTERED = 'Não entrou na chave'

/** A fase que o clube do jogador alcancou, no texto do resumo. */
export function reachedIn(campaign: Campaign): string {
  if (campaign.winnerId === campaign.clubId) return 'Campeão'
  return campaign.eliminatedIn ?? NOT_ENTERED
}

/** A final pelo lado do clube do jogador, ou `null` para quem nao chegou la. */
export function finalOf(campaign: Campaign): KnockoutMatch | null {
  return campaign.path.find((match) => match.stage === FINAL_STAGE) ?? null
}

/**
 * Onde a campanha esta **agora**, em uma linha.
 *
 * Fica no motor, e nao na tela, porque le o estado interno da competicao — a
 * fase em disputa, a rodada do grupo, quem caiu. A tela so imprime.
 */
export function campaignStatus(campaign: Campaign): string {
  if (campaign.winnerId === campaign.clubId) return 'Campeão'
  if (campaign.eliminatedIn) return `Eliminado · ${campaign.eliminatedIn}`

  const { round } = campaign
  if (!round) return reachedIn(campaign)

  return round.kind === 'grupo'
    ? `Fase de grupos · ${round.index + 1}ª de ${GROUP_ROUNDS.length}`
    : round.stage
}
