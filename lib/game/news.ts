import type { SeasonRecord } from '@/lib/sim/career'
import type { MatchdayLog } from '@/lib/sim/matchday'
import { clamp } from '@/lib/sim/positions'
import { pick, type Rng } from '@/lib/sim/rng'
import type { Position } from '@/lib/sim/types'
import { headlinesFor } from './headlines'

/**
 * A imprensa da carreira.
 *
 * O problema que este modulo resolve nao e escrever manchete — e escrever a
 * manchete **do tamanho certo**. Um garoto na terceira divisao que fez um gol
 * merece uma nota no jornal da cidade; o mesmo gol, feito por um camisa 10 de
 * clube grande numa final, e chamada de capa. A versao ingenua disso sai
 * ridicula em uma das duas pontas, e o pedido do modo Jogo a Jogo era
 * justamente evitar noticia exagerada ou fora de contexto.
 *
 * Por isso tudo aqui passa por `reachOf`: o alcance e decidido primeiro, e so
 * entao o texto e escolhido entre os que existem para aquele alcance. Nenhum
 * template de repercussao mundial pode ser sorteado por quem nao chegou la.
 *
 * Camada de apresentacao, como `headlines.ts`: le o que a simulacao produziu e
 * escreve em portugues. Nao inventa fato nenhum.
 */

export type NewsReach = 'local' | 'nacional' | 'continental' | 'mundial'

export type NewsItem = {
  id: string
  headline: string
  /** Uma linha de desenvolvimento. Vazia quando a manchete se basta. */
  body: string
  reach: NewsReach
  outlet: string
  /** Rotulo da temporada, ex: "2026-27". */
  season: string
  /** Rodada, quando a noticia veio de uma partida. */
  round: number | null
}

export type NewsContext = {
  playerName: string
  clubName: string
  leagueName: string
  /** 1 = primeira divisao. */
  leagueTier: number
  clubStrength: number
  /** `morale.reputation`, 0..100. */
  reputation: number
  age: number
  overall: number
  position: Position
  season: string
}

const OUTLETS: Record<NewsReach, readonly string[]> = {
  local: ['Rádio da Cidade', 'Diário Regional', 'Blog da Torcida'],
  nacional: ['Portal Esportivo', 'Canal Nacional', 'Caderno de Esportes'],
  continental: ['Revista Continental', 'Boletim Europeu', 'Panorama do Continente'],
  mundial: ['Agência Internacional', 'Imprensa Mundial'],
}

/**
 * Ate onde a noticia chega.
 *
 * Tres sinais, e todos precisam acompanhar: a divisao define o piso — nao
 * existe repercussao mundial na terceira divisao, por melhor que o jogador
 * seja; a forca do clube e o palco; a reputacao e o nome que ele ja construiu.
 */
export function reachOf(context: NewsContext): NewsReach {
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

/** Um degrau abaixo. Feito para acontecimento pequeno de jogador grande. */
function lower(reach: NewsReach): NewsReach {
  const order: NewsReach[] = ['local', 'nacional', 'continental', 'mundial']
  return order[Math.max(0, order.indexOf(reach) - 1)]
}

/**
 * As noticias que uma partida rende.
 *
 * Recebe o diario inteiro da temporada, e nao so o ultimo jogo, porque quase
 * tudo o que a imprensa comenta e sequencia: "quarto jogo sem marcar" e
 * "terceira partida seguida no banco" nao existem para quem so viu hoje.
 */
export function newsFromMatch(
  context: NewsContext,
  log: MatchdayLog[],
  rng: Rng,
): NewsItem[] {
  const entry = log[log.length - 1]
  if (!entry) return []

  const reach = reachOf(context)
  const out: NewsItem[] = []
  const { player } = entry

  const won = entry.teamGoals > entry.opponentGoals
  const lost = entry.teamGoals < entry.opponentGoals

  if (player.played && player.goals >= 3) {
    out.push(
      item(context, reach, entry.round, rng, {
        headline: `${context.playerName} marca três vezes pelo ${context.clubName}`,
        body: `Atuação de ${player.rating.toFixed(1)} na vitória em ${entry.teamGoals} a ${entry.opponentGoals}. É o tipo de tarde que muda o ano de um ${context.age <= 21 ? 'garoto' : 'jogador'}.`,
      }),
    )
  } else if (player.played && player.goals === 2) {
    out.push(
      item(context, reach, entry.round, rng, {
        headline: `Dois gols de ${context.playerName} no ${context.leagueName}`,
        body: `${context.clubName} ${won ? 'venceu' : lost ? 'perdeu' : 'empatou'} por ${entry.teamGoals} a ${entry.opponentGoals}.`,
      }),
    )
  } else if (player.played && player.goals === 1 && player.rating >= 7.5) {
    out.push(
      item(context, lower(reach), entry.round, rng, {
        headline: `${context.playerName} decide e ${context.clubName} ${won ? 'vence' : 'escapa'}`,
        body: `Nota ${player.rating.toFixed(1)}, o melhor em campo pelo lado ${won ? 'vencedor' : 'visitante'}.`,
      }),
    )
  }

  if (player.played && player.assists >= 2) {
    out.push(
      item(context, lower(reach), entry.round, rng, {
        headline: `${context.playerName} dá duas assistências`,
        body: `Quem joga com ele tem feito gols com mais facilidade.`,
      }),
    )
  }

  if (player.red) {
    out.push(
      item(context, reach, entry.round, rng, {
        headline: `${context.playerName} é expulso e deixa o ${context.clubName} com um a menos`,
        body: pick(rng, [
          'O clube deve ouvir o jogador antes de qualquer declaração pública.',
          'A comissão técnica preferiu não comentar o lance no vestiário.',
        ]),
      }),
    )
  }

  if (player.injured) {
    out.push(
      item(context, lower(reach), entry.round, rng, {
        // Variação no texto porque lesão é o acontecimento que mais se repete
        // ao longo de uma carreira: com uma frase só, o feed de uma temporada
        // vira a mesma manchete impressa quatro vezes.
        headline: pick(rng, [
          `${context.playerName} deixa o campo sentindo dores`,
          `${context.playerName} sai machucado no ${entry.round}º jogo`,
          `Susto com ${context.playerName} no ${context.clubName}`,
        ]),
        body: pick(rng, [
          'O departamento médico vai avaliar nos próximos dias.',
          'O clube não estimou prazo de retorno.',
          'A comissão técnica evitou falar em gravidade.',
        ]),
      }),
    )
  }

  if (player.played && player.rating <= 4.5) {
    out.push(
      item(context, lower(reach), entry.round, rng, {
        headline: `Noite para esquecer de ${context.playerName}`,
        body: `Nota ${player.rating.toFixed(1)} e vaias no fim. ${context.clubName} precisa reagir.`,
      }),
    )
  }

  // — sequências: só entram quando não houve notícia maior no mesmo jogo.
  if (out.length === 0) {
    const streak = streaksOf(log)

    if (streak.scoring >= 3) {
      out.push(
        item(context, reach, entry.round, rng, {
          headline: `${context.playerName} marca pelo ${ordinal(streak.scoring)} jogo seguido`,
          body: goalStreakBody(context, streak.scoring),
        }),
      )
    } else if (streak.goalless >= 6 && isAttacker(context.position)) {
      out.push(
        item(context, lower(reach), entry.round, rng, {
          headline: `${streak.goalless} jogos sem gol: a seca de ${context.playerName}`,
          body: 'A cobrança começa a aparecer nas arquibancadas.',
        }),
      )
    } else if (streak.benched >= 4) {
      out.push(
        item(context, lower(reach), entry.round, rng, {
          headline: `${context.playerName} soma ${streak.benched} jogos sem entrar`,
          body: 'O empresário do jogador já teria pedido uma conversa com a diretoria.',
        }),
      )
    }
  }

  // Duas notícias por rodada é o teto: acima disso o feed vira ruído e o
  // jogador para de ler.
  return out.slice(0, 2)
}

function goalStreakBody(context: NewsContext, games: number): string {
  if (context.age <= 20) {
    return `Aos ${context.age} anos, é a sequência que costuma antecipar uma convocação de base.`
  }

  return `São ${games} partidas seguidas balançando a rede pelo ${context.clubName}.`
}

/**
 * As noticias do fim de temporada.
 *
 * Reaproveita `headlinesFor`, que ja sabe transformar um registro de temporada
 * em frase — o que este modulo acrescenta e o alcance e o veiculo. Reescrever
 * as mesmas frases aqui daria duas versoes da mesma verdade, e elas
 * divergiriam na primeira competicao nova que entrasse no jogo.
 */
export function newsFromSeason(
  context: NewsContext,
  record: SeasonRecord,
  rng: Rng,
): NewsItem[] {
  const reach = reachOf(context)

  return headlinesFor(record, context.playerName).map((headline) =>
    item(context, reach, null, rng, { headline, body: '' }),
  )
}

/** Noticia de mercado. Proposta e interesse repercutem mais que jogo. */
export function transferNews(
  context: NewsContext,
  clubName: string,
  rng: Rng,
): NewsItem {
  return item(context, reachOf(context), null, rng, {
    headline: `${context.playerName} está a caminho do ${clubName}`,
    body: `Aos ${context.age} anos, deixa o ${context.clubName} depois da temporada.`,
  })
}

function item(
  context: NewsContext,
  reach: NewsReach,
  round: number | null,
  rng: Rng,
  content: { headline: string; body: string },
): NewsItem {
  return {
    // A rodada e o alcance nao bastam para identificar: duas noticias podem
    // sair da mesma partida. O sorteio fecha a chave sem depender do texto.
    id: `${context.season}-${round ?? 'temporada'}-${Math.floor(rng() * 1e9).toString(36)}`,
    headline: content.headline,
    body: content.body,
    reach,
    outlet: pick(rng, OUTLETS[reach]),
    season: context.season,
    round,
  }
}

/** Sequencias do jogador ate a partida mais recente. */
export function streaksOf(log: MatchdayLog[]): {
  scoring: number
  goalless: number
  benched: number
} {
  let scoring = 0
  let goalless = 0
  let benched = 0

  for (let index = log.length - 1; index >= 0; index--) {
    const { player } = log[index]

    if (!player.played) {
      if (goalless === 0 && scoring === 0) benched++
      else break
      continue
    }

    if (benched > 0) break

    if (player.goals > 0) {
      if (goalless > 0) break
      scoring++
    } else {
      if (scoring > 0) break
      goalless++
    }
  }

  return { scoring, goalless, benched }
}

function isAttacker(position: Position): boolean {
  return position === 'ATA' || position === 'SA' || position === 'PON'
}

function ordinal(value: number): string {
  return `${clamp(value, 1, 99)}º`
}
