## 1. Fase de grupos

- [x] 1.1 Criar `lib/sim/tournament.ts` com `simulateGroupTournament`, devolvendo `KnockoutResult`
- [x] 1.2 Montar os grupos de quatro por sorteio, descartando o resto que não completa um grupo
- [x] 1.3 Disputar todos contra todos dentro do grupo com `simulateMatch`, aceitando empate
- [x] 1.4 Registrar cada partida de grupo no caminho dos dois lados, com `Grupo X · Nª rodada`
- [x] 1.5 Ordenar o grupo por pontos, saldo e gols marcados, e classificar os dois primeiros
- [x] 1.6 Marcar `Fase de grupos` como fase alcançada de quem não avança
- [x] 1.7 Rodar `simulateKnockout` sobre os classificados e concatenar caminhos e eliminações

## 2. Ligar o formato às competições

- [x] 2.1 `national.ts` passa a montar os torneios de seleção com `simulateGroupTournament`
- [x] 2.2 `career.ts` passa a montar as competições continentais de clube com o mesmo formato
- [x] 2.3 Manter a copa nacional em eliminação direta
- [x] 2.4 `npx tsc --noEmit` limpo

## 3. Narração genérica

- [x] 3.1 Criar `NarratableMatch` em `liveMatch.ts` e trocar o parâmetro de `buildTimeline`
- [x] 3.2 Fazer o texto dos pênaltis depender de `stage`: título só na final
- [x] 3.3 Confirmar que a chamada de `useGame` com `DecisiveMatch` continua compilando sem adaptador
- [x] 3.4 Adicionar em `national.ts` a conversão de `NationalMatch` para `NarratableMatch`

## 4. Narração na lista de partidas

- [x] 4.1 `NationalMatches` recebe a semente da carreira e o rótulo da temporada
- [x] 4.2 A linha da partida vira expansível, abrindo uma de cada vez
- [x] 4.3 Renderizar os lances com minuto, texto e destaque para o que é do jogador
- [x] 4.4 Passar as props novas em `SeasonReview.tsx` e em `History.tsx`

## 5. Verificação

- [x] 5.1 Conferir Copa do Mundo: 8 grupos, 3 jogos de grupo por seleção, 16 classificados, final
- [x] 5.2 Conferir Eurocopa (16) e Copa América (8) chegando a quartas e semifinal respectivamente
- [x] 5.3 Conferir que existe empate na fase de grupos e nenhum na fase de mata-mata
- [x] 5.4 Conferir que quem cai no grupo registra `Fase de grupos`
- [x] 5.5 Conferir a ordenação do grupo por saldo em caso de empate em pontos
- [x] 5.6 Medir o efeito nas campanhas de Champions e nos totais de temporada
- [x] 5.7 Abrir a narração de uma partida, fechar e reabrir, conferindo que é idêntica
- [x] 5.8 Conferir que a soma dos gols narrados bate com o placar da partida
- [x] 5.9 Percorrer histórico e resumo de temporada em 390px e 1440px
- [x] 5.10 `npm run lint` e `npm run build` limpos
