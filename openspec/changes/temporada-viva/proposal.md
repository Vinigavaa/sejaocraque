## Why

Hoje a temporada inteira acontece num único clique. O jogador aperta `AVANÇAR TEMPORADA`,
os números da tela trocam de uma vez e nada marca o que aconteceu no ano — nem quantos
jogos ele fez somando liga, copa e seleção, nem em que atributo o treino rendeu, nem até
onde o clube foi em cada competição. O ano mais importante da carreira tem exatamente o
mesmo peso visual do ano em que ele foi reserva.

Falta também o momento. Um simulador de carreira vive do jogo que decide a temporada, e
aqui a final da Champions é resolvida dentro de um `Map` e resumida em uma badge dourada.

## What Changes

- **Micro-interações e transição entre telas.** Todo elemento clicável responde ao toque,
  e a troca de tela deixa de ser um corte seco. Tudo respeitando `prefers-reduced-motion`.
- **Resumo de fim de temporada.** Nova tela, mostrada depois de cada temporada jogada, com:
  jogos, gols e assistências **somando liga, copas e seleção** (com o detalhamento por
  competição); atributos que evoluíram no ano e a variação do OVR; e todas as competições
  disputadas com a fase alcançada e o título quando houver.
- **Jogo decisivo minuto a minuto.** Quando o clube chega a uma final (copa nacional,
  continental ou Copa do Mundo), essa final é narrada minuto a minuto. Sem final, o jogo
  narrado é a partida do clube na última rodada da liga.
- **Calendário de liga em rodadas.** `simulateLeague` passa a organizar os confrontos em
  rodadas (método do círculo) em vez de um laço de todos-contra-todos sem ordem. É o que
  faz existir uma "última rodada" de verdade. **BREAKING**: muda a ordem de consumo do RNG,
  então uma seed antiga não reproduz mais a mesma carreira.
- **Ordem dos momentos pós-temporada.** O pênalti passa a ser resolvido antes do resumo
  (senão o resumo mostra um gol a menos), e prêmio e proposta de transferência vêm depois.

Explicitamente fora do escopo: o jogo minuto a minuto é **narração de um resultado já
decidido**, não uma partida jogável. O jogador assiste; não há decisão dentro dela.

## Capabilities

### New Capabilities
- `interface-motion`: resposta ao clique, transição entre telas e entrada de overlay, com
  respeito a movimento reduzido.
- `season-review`: apuração e apresentação do fechamento de temporada — totais
  consolidados, evolução de atributos e campanha em cada competição.
- `live-match`: escolha do jogo decisivo da temporada, geração determinística da linha do
  tempo de lances e reprodução minuto a minuto.

### Modified Capabilities
<!-- Nenhuma: openspec/specs/ ainda está vazio; este é o primeiro change do projeto. -->

## Impact

Motor (`lib/sim/`):
- `season.ts`: calendário em rodadas; `LeagueOutcome` ganha os confrontos da última rodada.
- `competitions.ts`: `KnockoutResult` ganha o placar e os participantes da final.
- `career.ts`: `SeasonRecord` ganha a evolução de atributos e o descritor do jogo decisivo;
  novo helper de totais consolidados.
- `liveMatch.ts` (novo): linha do tempo de lances.

Interface:
- `lib/game/useGame.ts`: `advance()` deixa de ser um passo só e vira um fluxo com etapas.
- `components/screens/LiveMatch.tsx` e `SeasonReview.tsx` (novos).
- `components/motion.tsx` (novo) e `app/globals.css`: keyframes e feedback de clique.
- `app/page.tsx`: duas telas novas no roteamento.

Sem impacto em backend, dados ou dependências — nenhum pacote novo.
