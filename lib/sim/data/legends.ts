import type { Legend } from '../types'

/**
 * Pool de lendas do draft.
 *
 * As notas sao autorais — julgamento proprio sobre o auge de cada jogador,
 * nao reproducao de base de dados de terceiro. Nomes aparecem apenas como
 * identificacao; o projeto nao tem afiliacao com liga, clube ou atleta.
 *
 * Ordem das colunas:
 * [id, nome, vel, fin, pas, dri, def, fis, fintas(1-5), pernaRuim(1-5)]
 */
type Row = [string, string, number, number, number, number, number, number, number, number]

const ROWS: Row[] = [
  // — Atacantes historicos
  ['pele', 'Pelé', 93, 96, 89, 95, 55, 88, 5, 5],
  ['r-ronaldo', 'R. Ronaldo', 97, 95, 78, 96, 42, 88, 5, 4],
  ['romario', 'Romário', 88, 95, 76, 92, 35, 72, 5, 3],
  ['van-basten', 'Van Basten', 82, 94, 82, 87, 45, 89, 4, 4],
  ['muller-g', 'G. Müller', 79, 95, 70, 80, 40, 84, 3, 4],
  ['eusebio', 'Eusébio', 93, 93, 76, 88, 44, 85, 4, 3],
  ['batistuta', 'Batistuta', 82, 94, 72, 79, 40, 90, 3, 4],
  ['inzaghi', 'Inzaghi', 84, 88, 68, 74, 35, 74, 2, 4],
  ['shearer', 'Shearer', 79, 92, 72, 76, 45, 90, 3, 4],
  ['drogba', 'Drogba', 84, 91, 74, 80, 48, 94, 3, 4],
  ['ibrahimovic', 'Ibrahimović', 78, 92, 82, 88, 45, 92, 5, 4],
  ['lewandowski', 'Lewandowski', 80, 94, 78, 84, 46, 87, 4, 4],
  ['benzema', 'Benzema', 79, 91, 84, 88, 42, 82, 4, 4],
  ['suarez', 'Suárez', 80, 92, 82, 87, 45, 84, 4, 4],
  ['aguero', 'Agüero', 87, 92, 78, 89, 35, 78, 4, 3],
  ['haaland', 'Haaland', 89, 94, 68, 78, 45, 93, 3, 3],
  ['mbappe', 'Mbappé', 97, 92, 80, 92, 38, 80, 5, 4],
  ['osimhen', 'V. Osimhen', 92, 87, 62, 80, 42, 85, 3, 3],
  ['kane', 'Kane', 70, 93, 85, 81, 47, 84, 3, 4],
  ['isak', 'A. Isak', 89, 85, 72, 84, 38, 76, 4, 4],

  // — Pontas e segundos atacantes
  ['garrincha', 'Garrincha', 93, 78, 76, 97, 35, 74, 5, 2],
  ['best', 'G. Best', 90, 85, 80, 94, 40, 76, 5, 4],
  ['c-ronaldo', 'C. Ronaldo', 92, 94, 82, 90, 42, 90, 5, 5],
  ['ronaldinho', 'Ronaldinho', 87, 86, 92, 96, 38, 80, 5, 4],
  ['rivaldo', 'Rivaldo', 82, 90, 88, 90, 42, 80, 4, 5],
  ['robinho', 'Robinho', 91, 78, 78, 93, 32, 66, 5, 3],
  ['neymar', 'Neymar', 90, 85, 86, 95, 35, 68, 5, 4],
  ['salah', 'M. Salah', 92, 88, 79, 89, 40, 76, 4, 3],
  ['mane', 'Mané', 92, 85, 76, 87, 45, 82, 4, 4],
  ['robben', 'Robben', 91, 87, 79, 90, 36, 72, 4, 2],
  ['giggs', 'Giggs', 88, 78, 85, 87, 48, 74, 4, 3],
  ['overmars', 'Overmars', 95, 80, 76, 87, 38, 70, 4, 3],
  ['figo', 'Figo', 82, 82, 89, 91, 42, 76, 5, 3],
  ['di-maria', 'Di María', 88, 82, 88, 89, 42, 68, 4, 3],
  ['saka', 'B. Saka', 85, 82, 82, 88, 48, 74, 4, 4],
  ['vinicius', 'Vinícius Jr.', 95, 84, 78, 92, 32, 72, 5, 3],
  ['garnacho', 'A. Garnacho', 86, 77, 72, 80, 37, 58, 4, 3],
  ['bale', 'Bale', 94, 88, 82, 85, 48, 88, 4, 4],
  ['dybala', 'Dybala', 78, 87, 85, 89, 34, 66, 4, 3],
  ['sanchez', 'A. Sánchez', 86, 84, 80, 88, 45, 78, 4, 4],

  // — Meias armadores
  ['maradona', 'Maradona', 88, 88, 93, 97, 38, 76, 5, 3],
  ['zidane', 'Zidane', 76, 84, 94, 95, 52, 88, 5, 4],
  ['platini', 'Platini', 74, 88, 93, 88, 45, 76, 4, 3],
  ['cruyff', 'Cruyff', 89, 88, 92, 94, 50, 76, 5, 4],
  ['messi', 'Messi', 88, 93, 94, 97, 34, 68, 5, 3],
  ['riquelme', 'Riquelme', 62, 80, 94, 91, 38, 72, 5, 3],
  ['totti', 'Totti', 76, 88, 91, 89, 40, 80, 5, 4],
  ['bergkamp', 'Bergkamp', 74, 89, 91, 90, 42, 78, 5, 4],
  ['kaka', 'Kaká', 90, 85, 87, 89, 42, 80, 4, 4],
  ['de-bruyne', 'De Bruyne', 76, 87, 95, 86, 55, 82, 4, 5],
  ['ozil', 'Özil', 72, 78, 92, 89, 34, 62, 5, 4],
  ['rui-costa', 'Rui Costa', 72, 80, 91, 88, 40, 72, 4, 3],
  ['zico', 'Zico', 78, 90, 93, 90, 40, 72, 4, 3],
  ['socrates', 'Sócrates', 70, 84, 91, 85, 48, 80, 4, 3],
  ['baggio', 'R. Baggio', 78, 90, 89, 92, 34, 72, 5, 3],
  ['bellingham', 'Bellingham', 82, 84, 86, 85, 68, 86, 4, 4],
  ['odegaard', 'Ødegaard', 72, 80, 89, 87, 45, 62, 4, 3],
  ['lo-celso', 'Lo Celso', 74, 78, 84, 84, 52, 68, 4, 3],

  // — Meio-campistas
  ['xavi', 'Xavi', 66, 74, 96, 88, 62, 66, 4, 3],
  ['iniesta', 'Iniesta', 74, 78, 92, 94, 58, 66, 5, 3],
  ['scholes', 'Scholes', 62, 86, 92, 82, 62, 74, 3, 4],
  ['pirlo', 'Pirlo', 58, 82, 95, 84, 58, 68, 4, 3],
  ['gerrard', 'Gerrard', 78, 88, 90, 82, 74, 88, 3, 4],
  ['lampard', 'Lampard', 72, 89, 87, 80, 68, 84, 3, 4],
  ['modric', 'Modrić', 76, 78, 92, 91, 64, 66, 5, 4],
  ['kroos', 'Kroos', 58, 78, 94, 82, 62, 72, 3, 4],
  ['keane', 'R. Keane', 74, 76, 84, 76, 84, 88, 3, 3],
  ['vieira', 'P. Vieira', 76, 74, 84, 80, 86, 92, 3, 3],
  ['seedorf', 'Seedorf', 76, 84, 88, 85, 62, 82, 4, 4],
  ['kimmich', 'J. Kimmich', 72, 74, 90, 79, 78, 76, 3, 4],
  ['banega', 'Banega', 66, 76, 88, 85, 55, 68, 4, 3],
  ['enzo-perez', 'Enzo Pérez', 74, 70, 80, 76, 72, 80, 3, 3],
  ['tonali', 'S. Tonali', 74, 74, 84, 78, 78, 80, 3, 3],

  // — Volantes
  ['makelele', 'Makélélé', 74, 52, 78, 72, 90, 84, 2, 3],
  ['gattuso', 'Gattuso', 72, 55, 74, 68, 88, 90, 2, 3],
  ['dunga', 'Dunga', 66, 62, 82, 72, 86, 86, 2, 3],
  ['mascherano', 'Mascherano', 70, 50, 78, 70, 89, 84, 2, 3],
  ['busquets', 'Busquets', 56, 60, 90, 80, 84, 76, 3, 4],
  ['casemiro', 'Casemiro', 66, 70, 78, 70, 89, 90, 2, 3],
  ['kante', 'Kanté', 88, 58, 78, 80, 91, 82, 3, 3],
  ['davids', 'E. Davids', 86, 66, 80, 82, 86, 84, 3, 3],
  ['biglia', 'Biglia', 62, 62, 82, 72, 78, 74, 2, 3],
  ['rodri', 'Rodri', 60, 72, 88, 76, 88, 88, 2, 4],

  // — Defensores
  ['beckenbauer', 'Beckenbauer', 78, 70, 90, 82, 92, 86, 3, 4],
  ['baresi', 'Baresi', 78, 45, 82, 74, 95, 84, 2, 3],
  ['maldini', 'Maldini', 84, 50, 84, 78, 95, 88, 3, 4],
  ['cannavaro', 'Cannavaro', 84, 40, 74, 72, 94, 82, 2, 3],
  ['nesta', 'Nesta', 82, 40, 76, 74, 94, 86, 2, 3],
  ['puyol', 'Puyol', 80, 46, 70, 66, 92, 90, 2, 3],
  ['ramos', 'S. Ramos', 82, 70, 78, 74, 91, 90, 3, 4],
  ['thiago-silva', 'Thiago Silva', 78, 45, 80, 76, 93, 84, 2, 3],
  ['van-dijk', 'Van Dijk', 80, 62, 80, 72, 93, 94, 2, 4],
  ['otamendi', 'Otamendi', 72, 50, 72, 66, 86, 88, 2, 3],
  ['fazio', 'Fazio', 58, 45, 68, 58, 82, 88, 2, 2],
  ['rojo', 'Rojo', 70, 52, 72, 66, 82, 84, 2, 4],

  // — Laterais e alas
  ['cafu', 'Cafu', 92, 66, 82, 82, 84, 88, 3, 3],
  ['r-carlos', 'R. Carlos', 95, 82, 82, 82, 82, 92, 3, 2],
  ['zanetti', 'J. Zanetti', 88, 62, 82, 78, 86, 86, 3, 4],
  ['maicon', 'Maicon', 90, 70, 78, 78, 84, 92, 3, 3],
  ['dani-alves', 'Dani Alves', 88, 68, 88, 86, 80, 78, 4, 3],
  ['lahm', 'Lahm', 84, 60, 86, 82, 88, 76, 3, 4],
  ['marcelo', 'Marcelo', 86, 68, 84, 90, 74, 74, 5, 3],
  ['carlos-alberto', 'C. Alberto', 82, 70, 84, 78, 86, 84, 3, 3],
  ['tagliafico', 'Tagliafico', 80, 55, 74, 72, 82, 80, 2, 3],
  ['mercado', 'Mercado', 72, 50, 70, 66, 80, 82, 2, 3],
  ['ansaldi', 'Ansaldi', 78, 62, 76, 74, 76, 76, 3, 4],
]

export const LEGENDS: Legend[] = ROWS.map(
  ([id, name, vel, fin, pas, dri, def, fis, fintas, pernaRuim]) => ({
    id,
    name,
    vel,
    fin,
    pas,
    dri,
    def,
    fis,
    fintas,
    pernaRuim,
  }),
)

export function legendById(id: string): Legend | undefined {
  return LEGENDS.find((legend) => legend.id === id)
}
