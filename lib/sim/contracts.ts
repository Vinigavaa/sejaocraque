import type { League } from './data/leagues'
import { clamp } from './positions'
import type { Rng } from './rng'
import type { Club } from './types'

/**
 * Salarios, contratos e negociacao.
 *
 * Tudo aqui e em **milhoes de euros por temporada**, a mesma escala do valor
 * de mercado que a carreira ja registrava. Uma escala so evita que o jogador
 * tenha de converter numeros de cabeca no meio de uma decisao.
 *
 * O modelo tem tres camadas, e vale entender a separacao antes de mexer:
 *
 * 1. **Teto do clube** (`clubTopSalary`) — o que o clube paga ao seu maior
 *    salario. Depende da forca do elenco, da riqueza da liga e do poder
 *    financeiro do proprio clube, e nada mais.
 * 2. **Salario justo** (`fairSalary`) — a fatia desse teto que o jogador
 *    merece, pelo que ele e hoje: nivel diante do elenco, idade, potencial,
 *    reputacao e a temporada que acabou de fazer.
 * 3. **Negociacao** (`negotiation`) — quanto acima do justo o clube ainda
 *    aceita ir, e com que risco.
 *
 * A camada 1 e o que impede o absurdo: por melhor que o jogador negocie, o
 * teto do clube pequeno continua sendo o teto do clube pequeno.
 */

export type Contract = {
  clubId: string
  /** Salario por temporada, em milhoes de euros. */
  salary: number
  /** Duracao assinada, em temporadas. */
  years: number
  /** Temporadas ainda por cumprir, contando a que vai ser jogada. */
  seasonsLeft: number
}

/** Todo jogador comeca a carreira com quatro anos assinados. */
export const START_CONTRACT_YEARS = 4

export const MIN_YEARS = 1
export const MAX_YEARS = 5

/** Ninguem assina de graca, nem na Serie C. */
const MIN_SALARY = 0.02

/** Termos de um contrato em negociacao — o que o clube poe na mesa. */
export type ContractTerms = {
  salary: number
  years: number
}

/**
 * O jogador visto pelo departamento financeiro do clube.
 *
 * `form` e a temporada que acabou; e `null` no primeiro contrato da carreira,
 * quando ainda nao ha desempenho profissional para olhar.
 */
export type ContractInput = {
  overall: number
  potential: number
  age: number
  /** Titulos, premios e convocacoes acumulados, na mesma escala do mercado. */
  reputation: number
  club: Club
  /**
   * A divisao que o clube esta disputando **hoje**, que nem sempre e a dos
   * dados: um clube que subiu paga o salario da divisao nova.
   */
  league: League
  form: { matches: number; rating: number } | null
}

/**
 * O maior salario que o clube consegue pagar.
 *
 * Cresce exponencialmente com a forca do elenco porque o dinheiro do futebol
 * se comporta assim: a distancia financeira entre o 12o e o 2o de um pais e
 * muito maior que a distancia esportiva entre eles.
 *
 * A riqueza da liga entra multiplicando, e nao somando, para que ela nunca
 * inverta a ordem dentro do proprio pais — o segundo clube da Premier League
 * paga mais que o terceiro, e nao mais que o primeiro.
 *
 * O poder financeiro do clube (`money`) entra por fora dos dois, e e o unico
 * fator que **pode** inverter a ordem entre paises: e exatamente isso que faz
 * um clube saudita cobrir a proposta de um europeu maior que ele. Ver
 * `FINANCIAL_POWER`, em `data/clubs.ts`.
 */
export function clubTopSalary(club: Club, league: League): number {
  return 0.06 * Math.exp((club.strength - 50) * 0.135) * league.wealth * club.money
}

/** Onde o jogador se encaixa no elenco. Vira salario e vira texto na tela. */
export type SquadRole = 'estrela' | 'titular' | 'rotacao' | 'reserva'

export const ROLE_LABEL: Record<SquadRole, string> = {
  estrela: 'Estrela do elenco',
  titular: 'Titular',
  rotacao: 'Rodízio',
  reserva: 'Reserva',
}

export function squadRole(overall: number, club: Club): SquadRole {
  const gap = overall - club.strength

  if (gap >= 4) return 'estrela'
  if (gap >= -1) return 'titular'
  if (gap >= -6) return 'rotacao'
  return 'reserva'
}

/**
 * O que o clube considera justo pagar a este jogador.
 *
 * A fatia do teto vem da importancia dele no elenco — e o fator que manda,
 * porque e o que o clube de fato compra. Os demais ajustam para os lados:
 * promessa e reputacao puxam para cima, idade avancada e temporada apagada
 * puxam para baixo.
 */
export function fairSalary(input: ContractInput): number {
  const { overall, potential, age, reputation, club } = input

  const top = clubTopSalary(club, input.league)

  // Importancia: quanto o jogador rende acima do que o elenco pede.
  const share = clamp(0.12 + (overall - club.strength + 5) / 16, 0.08, 1)

  // O que ainda promete. Vale para quem tem tempo de virar aquele nivel.
  const upside = unit((potential - overall) / 12) * unit((28 - age) / 10)

  // Nome construido nao entra em negociacao salarial como detalhe.
  const fame = unit(reputation / 12)

  // Temporada recente. Sem historico (primeiro contrato), fica neutra.
  const form = input.form
    ? unit((input.form.rating - 6.2) / 1.6) * unit(input.form.matches / 25)
    : 0.5

  // Idade so subtrai, e so depois dos 30.
  const wear = unit((age - 30) / 6)

  const modifier = (1 + upside * 0.12) * (1 + fame * 0.3) * (0.9 + form * 0.2) * (1 - wear * 0.25)

  // Nunca acima do teto: por definicao ele e o maior salario da folha, e um
  // craque num clube pequeno esbarra nele — e por isso que ele sai de la.
  return round(clamp(top * share * modifier, MIN_SALARY, top))
}

/**
 * Quantas temporadas o clube quer assinar.
 *
 * Contrato longo e aposta: faz sentido com quem ainda vai valorizar, e vira
 * risco com quem esta perto de parar.
 */
export function desiredYears(age: number): number {
  if (age <= 26) return 4
  if (age <= 29) return 3
  if (age <= 32) return 2
  return 1
}

/**
 * A margem de negociacao do jogador, de 0 a 1.
 *
 * E o que ele tem de trunfo na mesa: render acima do elenco, ser conhecido e
 * — principalmente — ter outra proposta na mao. Sem trunfo nenhum, o clube
 * quase nao sai do que ofereceu.
 */
function leverage(input: ContractInput, hasRival: boolean): number {
  const importance = unit((input.overall - input.club.strength + 4) / 10)
  const fame = unit(input.reputation / 12)
  const wear = unit((input.age - 31) / 5)

  return unit(importance * 0.45 + fame * 0.3 + (hasRival ? 0.2 : 0) - wear * 0.25)
}

/**
 * A mesa de negociacao de uma proposta especifica.
 *
 * `offer` e o que esta na mesa, `ceiling` e o ponto em que o clube levanta e
 * vai embora. Entre os dois existe uma faixa real de barganha — e ela e maior
 * para quem tem com o que barganhar.
 */
export type Negotiation = {
  /** O que o clube ofereceu de saida. */
  offer: ContractTerms
  /** Salario em que a recusa ja e certa. Abaixo dele existe barganha. */
  ceiling: number
  /** Duracao que o clube prefere. Pedir mais que isso custa chance. */
  preferredYears: number
}

export function negotiation(
  input: ContractInput,
  offer: ContractTerms,
  hasRival: boolean,
): Negotiation {
  const fair = fairSalary(input)
  const room = leverage(input, hasRival)

  // O teto de negociacao e sempre relativo ao justo, mas nunca ultrapassa o
  // que o clube paga ao seu maior salario com alguma folga. E esta linha que
  // impede um craque de arrancar valor de Premier League de um clube da
  // Serie B.
  const ceiling = Math.min(
    fair * (1.15 + room * 0.5),
    clubTopSalary(input.club, input.league) * 1.1,
  )

  return {
    offer,
    // Uma folga minima sempre existe, mesmo no clube que ja ofereceu o proprio
    // teto: sem ela a negociacao viraria um botao que nunca funciona, e o
    // jogador aprenderia a nunca tentar.
    ceiling: round(Math.max(ceiling, offer.salary * 1.12)),
    preferredYears: desiredYears(input.age),
  }
}

/**
 * A chance de o clube aceitar a exigencia, de 0 a 1.
 *
 * Pura de proposito: a barra que o jogador ve enquanto arrasta o salario e
 * exatamente este numero, sem sorteio no meio. O sorteio so acontece quando
 * ele envia.
 *
 * Pedir menos do que foi oferecido e aceito na hora. Pedir acima do teto e
 * recusa certa — o limite precisa ser visivel, senao o jogador nao aprende
 * onde ele esta.
 */
export function successChance(mesa: Negotiation, ask: ContractTerms): number {
  if (ask.salary > mesa.ceiling) return 0

  const span = mesa.ceiling - mesa.offer.salary
  const over = ask.salary - mesa.offer.salary

  // Faixa de barganha inexistente (clube ja no proprio teto): so aceita o que
  // ofereceu.
  const salaryOdds = span <= 0 ? (over <= 0 ? 1 : 0) : 1 - Math.pow(Math.max(0, over) / span, 1.25)

  // Anos a mais que o clube queria: cada um custa uma fatia da chance. Pedir
  // menos tempo nao custa nada — para o clube e menos risco.
  const extraYears = Math.max(0, ask.years - mesa.preferredYears)

  return unit(salaryOdds - extraYears * 0.14)
}

/** Como a chance e apresentada. A cor e o texto saem daqui, nao da tela. */
export type ChanceBand = 'aceita' | 'provavel' | 'limite' | 'arriscada' | 'recusa'

/**
 * A partir de quanto o clube e anunciado como pagador acima do mercado.
 *
 * A tela precisa de um corte, e ele fica alto de proposito: marcar todo mundo
 * que paga 10% a mais transformaria o aviso em decoracao.
 */
const RICH_CLUB = 1.3

/** Se o clube paga claramente acima do que o nivel esportivo dele sugere. */
export function paysAboveMarket(club: Club): boolean {
  return club.money >= RICH_CLUB
}

export function chanceBand(chance: number): ChanceBand {
  if (chance >= 0.95) return 'aceita'
  if (chance >= 0.7) return 'provavel'
  if (chance >= 0.4) return 'limite'
  if (chance > 0) return 'arriscada'
  return 'recusa'
}

export const BAND_LABEL: Record<ChanceBand, string> = {
  aceita: 'O clube aceita na hora',
  provavel: 'Bem recebida — o clube deve topar',
  limite: 'No limite do que eles consideram justo',
  arriscada: 'Eles podem levantar da mesa',
  recusa: 'Acima do teto do clube — recusa certa',
}

/** Resolve a exigencia. Uma so por proposta: falhou, o clube desiste. */
export function attemptNegotiation(
  mesa: Negotiation,
  ask: ContractTerms,
  rng: Rng,
): boolean {
  return rng() < successChance(mesa, ask)
}

/**
 * Se o clube quer manter o jogador quando o contrato acaba.
 *
 * Nao e caridade: um reserva de 35 anos nao ganha renovacao so por estar na
 * casa. Nivel diante do elenco manda, e a idade encurta a margem.
 */
export function wantsToRenew(input: ContractInput): boolean {
  const gap = input.overall - input.club.strength
  const tolerance = input.age >= 34 ? -1 : input.age >= 31 ? -4 : -8

  return gap >= tolerance
}

/** Arredonda para dois decimais — a precisao que a tela mostra. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}

function unit(value: number): number {
  return clamp(value, 0, 1)
}

/**
 * Salario em texto. Abaixo de um milhao a leitura em "M" perde a diferenca
 * entre 0,08 e 0,3 — que e justamente a diferenca entre a Serie C e a Serie B.
 */
export function formatSalary(salary: number): string {
  if (salary >= 1) return `€${salary.toFixed(1).replace('.', ',')}M`
  return `€${Math.round(salary * 1000)} mil`
}
