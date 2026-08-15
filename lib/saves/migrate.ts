import type { CareerSnapshot } from './types'
import type { CareerState, SeasonRecord } from '@/lib/sim/career'
import { CLUBS } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
import { NATIONAL_TOURNAMENTS } from '@/lib/sim/competitions'
import { WORLD_CUP_ID, WORLD_CUP_NAME } from '@/lib/sim/national'
import { startWorld, type WorldState } from '@/lib/sim/world'
import type { MatchdayLog, MatchdaySeason, SeasonDate } from '@/lib/sim/matchday'

/**
 * Traz um save antigo para o formato de hoje.
 *
 * O jogo recusava o que nao reconhecia: quem tinha uma carreira de doze anos
 * salva perdia a carreira quando o motor ganhava um campo. Nao ha desculpa
 * para isso — todas as versoes do formato ate aqui **acrescentaram** campos,
 * nenhuma mudou o significado de um campo existente, entao dar valor ao que
 * falta e suficiente para carregar qualquer save que ja existiu.
 *
 * Por isso a migracao olha para a **presenca do campo**, e nao para o numero
 * da versao. Um save gravado no meio de duas versoes carrega igual, e uma
 * versao nova so precisa de uma linha nova aqui quando acrescentar campo.
 *
 * O que nao da para inventar fica explicito no lugar em que e preenchido:
 * o mundo de uma carreira antiga nao tem historico de acesso e rebaixamento
 * para recuperar, e uma temporada em curso nunca teve copa nem selecao no
 * calendario.
 */
export function migrateSnapshot(snapshot: CareerSnapshot): CareerSnapshot {
  const career = migrateCareer(snapshot.career)

  return {
    ...snapshot,
    version: snapshot.version,
    career,
    matchday: snapshot.matchday ? migrateMatchday(snapshot.matchday, career) : null,
    news: snapshot.news ?? [],
    social: snapshot.social ?? [],
    seasonLog: (snapshot.seasonLog ?? []).map((entry) => migrateLog(entry, career)),
  }
}

function migrateCareer(career: CareerState): CareerState {
  return {
    ...career,
    world: career.world ?? worldFor(career),
    seasons: (career.seasons ?? []).map(migrateSeason),
  }
}

/**
 * O mundo de uma carreira que comecou antes de ele existir.
 *
 * O historico de acesso e rebaixamento das outras dezenove ligas nunca foi
 * gravado e nao da para deduzir — elas voltam ao retrato dos dados. O que da
 * para preservar e a divisao do clube do jogador, que a carreira ja guardava
 * em `leagueId`; ela e aplicada trocando o clube com o mais fraco da divisao
 * de destino, para o campeonato nao mudar de tamanho.
 */
function worldFor(career: CareerState): WorldState {
  const world = startWorld()
  const clubId = career.clubId
  const leagueId = career.leagueId

  if (!clubId || !leagueId || world.divisions[clubId] === leagueId) return world

  const divisions = { ...world.divisions }
  const native = divisions[clubId]

  const weakest = CLUBS.filter((club) => divisions[club.id] === leagueId).reduce<
    (typeof CLUBS)[number] | null
  >((worst, club) => (!worst || club.strength < worst.strength ? club : worst), null)

  divisions[clubId] = leagueId
  if (weakest && native) divisions[weakest.id] = native

  return { ...world, divisions }
}

/** O torneio de selecao passou a guardar o id, que e por onde a taca e achada. */
function migrateSeason(season: SeasonRecord): SeasonRecord {
  const tournament = season.national?.tournament
  if (!season.national || !tournament || tournament.id) return season

  return {
    ...season,
    national: {
      ...season.national,
      tournament: { ...tournament, id: tournamentIdOf(tournament.name) },
    },
  }
}

function tournamentIdOf(name: string): string {
  if (name === WORLD_CUP_NAME) return WORLD_CUP_ID

  return NATIONAL_TOURNAMENTS.find((item) => item.name === name)?.id ?? name
}

/**
 * A temporada em curso.
 *
 * Ela e a unica parte do save que nao da para completar de verdade: um
 * calendario antigo so tinha a liga, e as copas daquele ano nunca foram
 * sorteadas. Reconstruir uma chave no meio da temporada seria inventar
 * campanhas que o jogador nao disputou — e como cada rodada de liga ja
 * aconteceu, o certo e o ano terminar como comecou, so com a liga. Da
 * temporada seguinte em diante o calendario nasce completo.
 */
function migrateMatchday(season: MatchdaySeason, career: CareerState): MatchdaySeason {
  const rounds = season.rounds ?? []

  return {
    ...season,
    leagueName: season.leagueName ?? leagueById(season.leagueId)?.name ?? season.leagueId,
    campaigns: season.campaigns ?? [],
    national: season.national ?? null,
    dates: season.dates ?? rounds.map((): SeasonDate => ({ kind: 'liga' })),
    dateIndex: season.dateIndex ?? season.roundIndex ?? 0,
    log: (season.log ?? []).map((entry) => migrateLog(entry, career)),
  }
}

/** Antes do calendario unico, toda partida do registro era de liga. */
function migrateLog(entry: MatchdayLog, career: CareerState): MatchdayLog {
  if (entry.competitionId) return entry

  const leagueId = career.leagueId

  return {
    ...entry,
    competitionId: leagueId,
    competitionName: leagueById(leagueId)?.name ?? leagueId,
    stage: entry.stage ?? null,
  }
}
