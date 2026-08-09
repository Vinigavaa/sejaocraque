/**
 * Ligas cobertas pelo jogo.
 *
 * Recorte deliberado: apenas competicoes onde a carreira de fato acontece e
 * cujos elencos sao conhecidos com precisao. Nao ha liga preenchida "por
 * cobertura" — uma cauda de divisoes que o jogador nunca visita custa
 * curadoria e nao entrega nada.
 *
 * `tier` alimenta acesso e rebaixamento: subir e mover para o tier menor do
 * mesmo pais, cair e mover para o maior.
 */
export type League = {
  id: string
  name: string
  country: string
  /** 1 = primeira divisao, 2 = segunda, 3 = terceira. */
  tier: number
  /** Quantos sobem para a divisao acima. Zero na primeira divisao. */
  promotionSpots: number
  /**
   * Quantos caem para a divisao abaixo. Zero quando o jogo nao modela a
   * divisao inferior — a queda so existe se houver para onde cair.
   */
  relegationSpots: number
}

export const LEAGUES: League[] = [
  // Brasil
  { id: 'br-1', name: 'Brasileirão Série A', country: 'BR', tier: 1, promotionSpots: 0, relegationSpots: 4 },
  { id: 'br-2', name: 'Brasileirão Série B', country: 'BR', tier: 2, promotionSpots: 4, relegationSpots: 4 },
  { id: 'br-3', name: 'Brasileirão Série C', country: 'BR', tier: 3, promotionSpots: 4, relegationSpots: 0 },

  // Inglaterra
  { id: 'en-1', name: 'Premier League', country: 'EN', tier: 1, promotionSpots: 0, relegationSpots: 3 },
  { id: 'en-2', name: 'EFL Championship', country: 'EN', tier: 2, promotionSpots: 3, relegationSpots: 0 },

  // Espanha
  { id: 'es-1', name: 'La Liga', country: 'ES', tier: 1, promotionSpots: 0, relegationSpots: 3 },
  { id: 'es-2', name: 'Segunda División', country: 'ES', tier: 2, promotionSpots: 3, relegationSpots: 0 },

  // Itália
  { id: 'it-1', name: 'Serie A', country: 'IT', tier: 1, promotionSpots: 0, relegationSpots: 3 },
  { id: 'it-2', name: 'Serie B', country: 'IT', tier: 2, promotionSpots: 3, relegationSpots: 0 },

  // Alemanha
  { id: 'de-1', name: 'Bundesliga', country: 'DE', tier: 1, promotionSpots: 0, relegationSpots: 2 },
  { id: 'de-2', name: '2. Bundesliga', country: 'DE', tier: 2, promotionSpots: 2, relegationSpots: 0 },

  // França
  { id: 'fr-1', name: 'Ligue 1', country: 'FR', tier: 1, promotionSpots: 0, relegationSpots: 2 },
  { id: 'fr-2', name: 'Ligue 2', country: 'FR', tier: 2, promotionSpots: 2, relegationSpots: 0 },

  // Portugal e Holanda
  { id: 'pt-1', name: 'Primeira Liga', country: 'PT', tier: 1, promotionSpots: 0, relegationSpots: 0 },
  { id: 'nl-1', name: 'Eredivisie', country: 'NL', tier: 1, promotionSpots: 0, relegationSpots: 0 },

  // Américas
  { id: 'ar-1', name: 'Primera División', country: 'AR', tier: 1, promotionSpots: 0, relegationSpots: 0 },
  { id: 'mx-1', name: 'Liga MX', country: 'MX', tier: 1, promotionSpots: 0, relegationSpots: 0 },
  { id: 'us-1', name: 'MLS', country: 'US', tier: 1, promotionSpots: 0, relegationSpots: 0 },

  // Outros mercados
  { id: 'tr-1', name: 'Süper Lig', country: 'TR', tier: 1, promotionSpots: 0, relegationSpots: 0 },
  { id: 'sa-1', name: 'Saudi Pro League', country: 'SA', tier: 1, promotionSpots: 0, relegationSpots: 0 },
]

export const COUNTRY_LABEL: Record<string, { name: string; flag: string }> = {
  BR: { name: 'Brasil', flag: '🇧🇷' },
  EN: { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  ES: { name: 'Espanha', flag: '🇪🇸' },
  IT: { name: 'Itália', flag: '🇮🇹' },
  DE: { name: 'Alemanha', flag: '🇩🇪' },
  FR: { name: 'França', flag: '🇫🇷' },
  PT: { name: 'Portugal', flag: '🇵🇹' },
  NL: { name: 'Holanda', flag: '🇳🇱' },
  AR: { name: 'Argentina', flag: '🇦🇷' },
  MX: { name: 'México', flag: '🇲🇽' },
  US: { name: 'Estados Unidos', flag: '🇺🇸' },
  TR: { name: 'Turquia', flag: '🇹🇷' },
  SA: { name: 'Arábia Saudita', flag: '🇸🇦' },
}

export function leagueById(id: string): League | undefined {
  return LEAGUES.find((league) => league.id === id)
}

/** Liga do mesmo pais um degrau acima. Undefined se ja for a primeira divisao. */
export function leagueAbove(league: League): League | undefined {
  return LEAGUES.find(
    (other) => other.country === league.country && other.tier === league.tier - 1,
  )
}

/** Liga do mesmo pais um degrau abaixo. Undefined se nao houver divisao inferior mapeada. */
export function leagueBelow(league: League): League | undefined {
  return LEAGUES.find(
    (other) => other.country === league.country && other.tier === league.tier + 1,
  )
}
