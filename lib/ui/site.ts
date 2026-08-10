/**
 * A identidade do site em texto — o que aparece na aba, na busca do Google e
 * no cartao que o WhatsApp, o X e o Discord montam quando alguem cola o link.
 *
 * Fica num arquivo so porque o mesmo texto e usado em tres lugares que nao se
 * enxergam: o `metadata` do layout, a imagem do cartao (`opengraph-image`) e o
 * `sitemap`. Duplicar significaria descobrir a divergencia por um cartao
 * errado ja publicado.
 */
export const SITE = {
  name: 'CRAQUE',
  title: 'CRAQUE — Simulador de carreira no futebol',
  shortTitle: 'CRAQUE',
  tagline: 'Roube um atributo de cada lenda',
  description:
    'Roube um atributo de cada lenda, monte seu jogador e viva uma carreira inteira: divisões, títulos, seleção e mercado. Descubra onde você fica entre os maiores.',
  locale: 'pt_BR',
} as const

/**
 * A URL publica do site, usada para transformar caminhos em absolutos — o
 * cartao de link so funciona com URL absoluta, e nenhuma rede busca a imagem
 * a partir de um caminho relativo.
 *
 * A ordem e proposital: `NEXT_PUBLIC_SITE_URL` permite apontar um preview ou
 * um dominio novo sem tocar no codigo; em desenvolvimento a URL e a local, se
 * nao o cartao aberto no `localhost` buscaria a imagem de producao; e o padrao
 * e o dominio de verdade, que e o que vale no link publicado.
 */
export const SITE_URL = 'https://sejaocraque.com'

export function siteUrl(): URL {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : SITE_URL)

  return new URL(configured)
}
