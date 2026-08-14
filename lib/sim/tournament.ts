/**
 * Torneio com fase de grupos.
 *
 * Copa do Mundo, Eurocopa e as competicoes continentais de clube nao entram
 * direto em eliminacao direta — antes disso todo mundo tem tres jogos
 * garantidos, e cair na fase de grupos e diferente de nao se classificar.
 *
 * O resultado e o mesmo `KnockoutResult` que o mata-mata puro produz. Isso e
 * de proposito: para quem consome — `matchesIn`, `finalIn`, `toRun`, a lista de
 * partidas — a fase de grupos e so mais partida no caminho, e nenhum deles
 * precisa aprender a distinguir dois formatos.
 */

import {
  simulateKnockout,
  type Contender,
  type KnockoutMatch,
  type KnockoutResult,
} from './competitions'
import { jitter, sample, type Rng } from './rng'
import { boostedStrength, simulateMatch, type ClubBoost } from './season'

export const GROUP_SIZE = 4

/** Quantos avancam de cada grupo. Dois, para a contagem cair em potencia de dois. */
export const QUALIFIERS_PER_GROUP = 2

export const GROUP_STAGE = 'Fase de grupos'

export function simulateGroupTournament<T extends Contender>(
  entrants: T[],
  rng: Rng,
  boost?: ClubBoost,
): KnockoutResult {
  const eliminatedIn = new Map<string, string>()
  const paths = new Map<string, KnockoutMatch[]>(entrants.map((one) => [one.id, []]))

  const groups = drawGroups(entrants, rng)

  // Sem um grupo completo sequer nao ha torneio: cai no mata-mata puro, que ja
  // sabe lidar com qualquer numero de participantes.
  if (groups.length === 0) {
    return simulateKnockout(entrants, rng, boost)
  }

  const qualified: T[] = []

  groups.forEach((group, index) => {
    const table = playGroup(group, groupName(index), rng, boost, paths)

    table.forEach((row, position) => {
      if (position < QUALIFIERS_PER_GROUP) {
        qualified.push(row.contender)
        return
      }

      eliminatedIn.set(row.contender.id, GROUP_STAGE)
    })
  })

  const knockout = simulateKnockout(qualified, rng, boost)

  for (const [id, matches] of knockout.paths) {
    paths.get(id)?.push(...matches)
  }

  for (const [id, stage] of knockout.eliminatedIn) {
    eliminatedIn.set(id, stage)
  }

  return { winnerId: knockout.winnerId, eliminatedIn, paths }
}

/**
 * Os grupos. Quem sobra de um grupo incompleto fica de fora com caminho vazio
 * — o mesmo tratamento que a chave de potencia de dois ja da hoje.
 */
function drawGroups<T extends Contender>(entrants: T[], rng: Rng): T[][] {
  const drawn = sample(rng, entrants, entrants.length)
  const complete = Math.floor(drawn.length / GROUP_SIZE) * GROUP_SIZE
  const groups: T[][] = []

  for (let i = 0; i < complete; i += GROUP_SIZE) {
    groups.push(drawn.slice(i, i + GROUP_SIZE))
  }

  return groups
}

type GroupRow<T> = {
  contender: T
  points: number
  goalsFor: number
  goalsAgainst: number
}

/**
 * Todos contra todos dentro do grupo: tres rodadas, cada um joga uma vez com
 * cada. Aqui o empate existe — `playTie` do mata-mata nao serve, porque ele
 * forca um vencedor.
 */
function playGroup<T extends Contender>(
  group: T[],
  name: string,
  rng: Rng,
  boost: ClubBoost | undefined,
  paths: Map<string, KnockoutMatch[]>,
): GroupRow<T>[] {
  const table = new Map<string, GroupRow<T>>(
    group.map((one) => [one.id, { contender: one, points: 0, goalsFor: 0, goalsAgainst: 0 }]),
  )

  GROUP_ROUNDS.forEach((round, index) => {
    const stage = `Grupo ${name} · ${index + 1}ª rodada`

    for (const [homeIndex, awayIndex] of round) {
      const home = group[homeIndex]
      const away = group[awayIndex]

      const [homeGoals, awayGoals] = simulateMatch(
        boostedStrength(home, boost) * jitter(rng, 0.09),
        boostedStrength(away, boost) * jitter(rng, 0.09),
        rng,
      )

      record(table.get(home.id), homeGoals, awayGoals)
      record(table.get(away.id), awayGoals, homeGoals)

      paths.get(home.id)?.push({
        stage,
        opponentId: away.id,
        forGoals: homeGoals,
        againstGoals: awayGoals,
        onPenalties: false,
        won: homeGoals > awayGoals,
      })
      paths.get(away.id)?.push({
        stage,
        opponentId: home.id,
        forGoals: awayGoals,
        againstGoals: homeGoals,
        onPenalties: false,
        won: awayGoals > homeGoals,
      })
    }
  })

  return [...table.values()].sort(compareRows)
}

/** As tres rodadas de um grupo de quatro, por indice. */
export const GROUP_ROUNDS: [number, number][][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [3, 1],
  ],
  [
    [0, 3],
    [1, 2],
  ],
]

function record<T>(row: GroupRow<T> | undefined, scored: number, conceded: number): void {
  if (!row) return

  row.goalsFor += scored
  row.goalsAgainst += conceded

  if (scored > conceded) row.points += 3
  else if (scored === conceded) row.points += 1
}

function compareRows<T>(a: GroupRow<T>, b: GroupRow<T>): number {
  if (b.points !== a.points) return b.points - a.points

  const diff = b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst)
  if (diff !== 0) return diff

  return b.goalsFor - a.goalsFor
}

export function groupName(index: number): string {
  return String.fromCharCode(65 + index)
}
