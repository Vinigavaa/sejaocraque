/**
 * Regua do jogador.
 *
 * A media ponderada crua dos oito atributos roubados nasce inflada: o pool so
 * tem craques, entao qualquer atributo e alto, e o jogador ainda escolhe a
 * melhor entre oito posicoes — o maximo de oito amostras correlacionadas sobe
 * sozinho. Um draft feito ao acaso dava mediana 83, perto do teto da escada.
 *
 * A curva abaixo move so a regua do jogador. As notas das lendas continuam
 * como foram escritas — Messi precisa continuar 94.
 *
 * E convexa de proposito: cada ponto no topo custa mais que o anterior, entao
 * jogar bem paga de forma crescente e OVR 90+ vira conquista, nao rotina.
 */
const ANCHORS: [raw: number, curved: number][] = [
  [50, 30],
  [70, 52],
  [80, 66],
  [86, 76],
  [92, 86],
  [99, 99],
]

export function applyCurve(raw: number): number {
  if (raw <= ANCHORS[0][0]) {
    return ANCHORS[0][1]
  }

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [rawLow, curvedLow] = ANCHORS[i]
    const [rawHigh, curvedHigh] = ANCHORS[i + 1]

    if (raw <= rawHigh) {
      const progress = (raw - rawLow) / (rawHigh - rawLow)
      return Math.round(curvedLow + progress * (curvedHigh - curvedLow))
    }
  }

  return ANCHORS[ANCHORS.length - 1][1]
}
