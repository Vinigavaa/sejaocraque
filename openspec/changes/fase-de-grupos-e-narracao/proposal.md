## Why

A change anterior deu partidas de seleção com nome de competição, mas a competição em si continua sendo uma ficção: uma Copa do Mundo de 32 seleções entra direto em eliminação simples, e quem cai na primeira rodada "não se classificou" depois de um único jogo. Copa do Mundo e Eurocopa têm fase de grupos, e é ali que mora metade da campanha — três jogos garantidos, a chance de se classificar em segundo, a de cair invicto no saldo.

E o minuto a minuto existe para exatamente um jogo por temporada, o decisivo. Todas as outras partidas — inclusive uma final de Copa América — são uma linha de placar.

## What Changes

**Fase de grupos**

- Torneios de seleção passam a ser disputados em grupos de quatro com dois classificados, e só depois em mata-mata. Copa do Mundo: 8 grupos → oitavas. Eurocopa: 4 grupos → quartas. Copa América, Copa Africana, Copa Asiática e Copa Ouro: 2 grupos → semifinal.
- Cada partida de grupo é registrada com o grupo e a rodada, ex.: `Grupo C · 2ª rodada`.
- Quem não passa da fase de grupos tem isso registrado como a fase alcançada, em vez de aparecer como quem não se classificou para o torneio.
- As competições continentais de clube (Champions League, Libertadores, Concachampions, AFC) passam pelo mesmo formato — é o formato real delas.
- Copa nacional (Copa do Brasil, FA Cup e afins) continua em eliminação direta, que é o formato real dessas.

**Narração minuto a minuto**

- Toda partida de seleção passa a ter narração minuto a minuto, gerada sob demanda a partir da semente da carreira — a mesma partida narra igual toda vez que for aberta.
- A narração fica atrás de um toque: abrir o jogo na lista mostra os lances. Nada passa a ser obrigatório de assistir; avançar a temporada continua sendo um clique.
- A narração continua sem simular nada: ela distribui ao longo dos 90 minutos os gols que a partida já tem, e os gols do jogador são recorte do que ele já produziu naquele jogo.

## Capabilities

### New Capabilities

- `group-stage`: como um torneio com fase de grupos é montado e disputado, o que fica registrado de cada partida de grupo e como a classificação para o mata-mata é decidida.

### Modified Capabilities

- `national-calendar`: as partidas de torneio deixam de vir de uma chave de eliminação direta e passam a vir do formato com grupos; cada partida ganha narração própria.

## Impact

- `lib/sim/tournament.ts` (novo) — a montagem com grupos, produzindo o mesmo `KnockoutResult` que o mata-mata já produz, para o resto do motor não precisar saber a diferença.
- `lib/sim/competitions.ts` — `simulateKnockout` fica só com a eliminação direta; os torneios que têm grupos passam a chamar o módulo novo.
- `lib/sim/national.ts` — o ano de torneio passa pelo formato com grupos.
- `lib/sim/career.ts` — as competições continentais de clube passam pelo formato com grupos.
- `lib/sim/liveMatch.ts` — `buildTimeline` deixa de depender de `DecisiveMatch` e passa a aceitar qualquer partida narrável.
- `components/NationalMatches.tsx` — a partida vira expansível e mostra a narração.

**Fora de escopo**

- Narração minuto a minuto dos jogos de clube da liga. São ~38 por temporada por carreira e o pedido é sobre a seleção.
- Repescagem, terceiro colocado de melhor campanha, critérios de desempate por confronto direto.
