import { toSvg } from 'html-to-image'

/**
 * O card virando arquivo.
 *
 * O compartilhamento sempre foi por print — o que funciona no celular e e
 * constrangedor no desktop. Aqui o proprio jogo gera o PNG do card e entrega
 * ao sistema: no celular abre a folha de compartilhamento nativa (Instagram,
 * WhatsApp, o que o aparelho tiver); onde ela nao existe, baixa o arquivo.
 *
 * O desenho nao e refeito em canvas a mao: `html-to-image` serializa o proprio
 * no que ja esta na tela. Assim o card exibido e o card compartilhado sao a
 * mesma peca, e mudar o layout nao exige manter um segundo desenho em sincronia.
 */
export type ShareImageResult = 'shared' | 'downloaded' | 'cancelled' | 'failed'

/** Dobra a resolucao: o card e pequeno na tela e grande no feed. */
const PIXEL_RATIO = 2

/** Teto para o desenho da imagem. Passou disso, algo travou. */
const RENDER_TIMEOUT_MS = 20_000

export async function shareCardImage(
  node: HTMLElement,
  fileName: string,
  background: string,
): Promise<ShareImageResult> {
  let blob: Blob | null

  try {
    blob = await renderPng(node, background)
  } catch (error) {
    console.error('shareCardImage: falha ao gerar o PNG do card', error)
    return 'failed'
  }

  if (!blob) {
    console.error('shareCardImage: o gerador devolveu um arquivo vazio')
    return 'failed'
  }

  const file = new File([blob], fileName, { type: 'image/png' })

  // `canShare` com arquivo e a unica checagem confiavel: ha navegador com
  // `share` de texto e sem suporte a arquivo, e la o share estouraria.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (error) {
      // Fechar a folha de compartilhamento nao e erro — e a resposta do
      // jogador. Cair no download depois disso baixaria um arquivo que ele
      // acabou de recusar.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'

      console.error('shareCardImage: falha ao compartilhar o arquivo', error)
      return 'failed'
    }
  }

  return download(file)
}

/**
 * O no vira PNG em tres passos: SVG, imagem, canvas.
 *
 * O `toPng` do proprio `html-to-image` faz os tres, mas leva dezenas de
 * segundos com este card — sao meia duzia de escudos embutidos em base64, e
 * ele refaz a serializacao a cada etapa. Aqui a serializacao acontece uma vez
 * so, e o desenho e nosso: o mesmo resultado sai em cerca de um segundo.
 *
 * O SVG e carregado por `data:` URL de proposito. Trocar por `blob:` parece
 * equivalente e nao e: o Chrome marca o canvas como contaminado e recusa o
 * `toBlob` no fim, com `SecurityError`.
 */
async function renderPng(node: HTMLElement, background: string): Promise<Blob | null> {
  const image = await loadImage(await toSvg(node))
  const canvas = document.createElement('canvas')

  canvas.width = Math.ceil(node.offsetWidth * PIXEL_RATIO)
  canvas.height = Math.ceil(node.offsetHeight * PIXEL_RATIO)

  const context = canvas.getContext('2d')
  if (!context) return null

  // O card tem cantos arredondados e o PNG nao: sem o fundo, o que sobra nas
  // quatro pontas e transparencia, que vira branco em quase todo aplicativo.
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timer = setTimeout(
      () => reject(new Error('tempo esgotado ao carregar o SVG do card')),
      RENDER_TIMEOUT_MS,
    )

    image.onload = () => {
      clearTimeout(timer)
      resolve(image)
    }
    image.onerror = () => {
      clearTimeout(timer)
      reject(new Error('o navegador não conseguiu desenhar o SVG do card'))
    }

    image.src = url
  })
}

function download(file: File): ShareImageResult {
  const url = URL.createObjectURL(file)

  try {
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    return 'downloaded'
  } catch (error) {
    console.error('shareCardImage: falha ao baixar o arquivo', error)
    return 'failed'
  } finally {
    URL.revokeObjectURL(url)
  }
}
