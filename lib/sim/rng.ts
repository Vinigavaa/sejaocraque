/**
 * PRNG deterministico. A mesma seed sempre produz a mesma carreira,
 * o que permite desafio do dia e replay compartilhavel.
 */

export type Rng = () => number

/** mulberry32 — rapido, distribuicao boa o bastante para simulacao de jogo. */
export function createRng(seed: string): Rng {
  let a = hashSeed(seed)

  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(seed: string): number {
  let h = 2166136261

  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  return h >>> 0
}

/** Seed curta e legivel, no formato usado na UI (ex: "i16gikj8"). */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick: lista vazia')
  }

  return items[Math.floor(rng() * items.length)]
}

/** Amostra sem reposicao. Retorna menos itens se a lista for menor que `count`. */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items]
  const out: T[] = []

  while (out.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length)
    out.push(pool.splice(index, 1)[0])
  }

  return out
}

/** Inteiro em [min, max], inclusivo nas duas pontas. */
export function range(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/**
 * Amostra de Poisson. Placar de futebol e Poisson na pratica: media baixa,
 * cauda curta, zero frequente. Usar isso em vez de sortear o vencedor direto
 * e o que produz 0x0 e 4x1 na proporcao certa.
 *
 * Duas implementacoes porque os dois usos tem escalas muito diferentes: o
 * placar de uma partida gira em torno de 1,2, e o total de gols de uma
 * temporada passa de 25. Knuth e exato mas custa O(lambda) e perde precisao
 * numerica quando lambda cresce; acima de 20 a aproximacao normal e
 * indistinguivel e nao trava.
 */
export function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0

  if (lambda < 20) {
    const limit = Math.exp(-lambda)
    let count = 0
    let product = rng()

    while (product > limit) {
      count++
      product *= rng()
    }

    return count
  }

  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gaussian(rng)))
}

/** Normal padrao por Box-Muller. */
function gaussian(rng: Rng): number {
  const u = Math.max(rng(), Number.EPSILON)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

/** Variacao suave em torno de 1, para nao deixar duas temporadas identicas. */
export function jitter(rng: Rng, spread: number): number {
  return 1 + (rng() * 2 - 1) * spread
}
