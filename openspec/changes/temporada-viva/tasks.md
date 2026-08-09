## 1. Calendário de liga em rodadas

- [x] 1.1 Rodar `npx tsx scripts/smoke-titles.ts` antes de qualquer mudança e guardar a saída como linha de base
- [x] 1.2 Escrever `buildSchedule(clubs, twice)` em `lib/sim/season.ts` pelo método do círculo, com clube fantasma para número ímpar
- [x] 1.3 Trocar o laço `i × j` de `simulateLeague` pelo calendário, mantendo tabela, campeão, acessos e rebaixamentos
- [x] 1.4 Adicionar `LeagueFixture` e `lastRound: LeagueFixture[]` ao `LeagueOutcome`
- [x] 1.5 Checar em `scripts/check-data.ts` que toda liga gera calendário onde cada clube joga o mesmo número de partidas
- [x] 1.6 Rodar `smoke-titles.ts` de novo e comparar com a linha de base; se a distribuição de títulos mudar de forma relevante, o calendário introduziu viés e precisa ser corrigido

## 2. Placar da final de mata-mata

- [x] 2.1 Adicionar `final: { winnerId, loserId, winnerGoals, loserGoals, onPenalties }` ao `KnockoutResult`
- [x] 2.2 Preencher esse campo em `simulateKnockout` na última rodada da chave
- [x] 2.3 Verificar por script que o vencedor da final é sempre o `winnerId` e que `onPenalties` só aparece com placar empatado

## 3. Jogo decisivo e evolução no registro da temporada

- [x] 3.1 Criar o tipo `DecisiveMatch` (competição, adversário, placar, lado do jogador, se atuou, gols e assistências dele naquela competição) em `lib/sim/career.ts`
- [x] 3.2 Implementar `decisiveMatch(...)` com a precedência Copa do Mundo → continental → copa nacional → última rodada da liga
- [x] 3.3 Propagar o placar da final dos mata-matas até `playCups` e `playNationalTeam` para alimentar o descritor
- [x] 3.4 Adicionar `decisive: DecisiveMatch | null` ao `SeasonRecord`
- [x] 3.5 Adicionar `growth: { attr, from, to }[]` ao `SeasonRecord`, comparando os atributos antes e depois de `applyTraining` dentro de `playSeason`
- [x] 3.6 Implementar `seasonTotals(record)` devolvendo totais consolidados e uma linha por competição
- [x] 3.7 Escrever `scripts/smoke-season-review.ts` imprimindo, para uma carreira completa, os totais e a evolução de cada temporada, e conferir que os totais batem com a soma manual

## 4. Linha do tempo da partida

- [x] 4.1 Criar `lib/sim/liveMatch.ts` com `LiveEvent` e `buildTimeline(input, rng)`
- [x] 4.2 Sortear os minutos dos gols já decididos, em ordem crescente entre 1 e 90, e intercalar lances sem gol
- [x] 4.3 Atribuir gols ao jogador como recorte dos que ele já tem na competição, limitado pelos gols do time na partida
- [x] 4.4 Tratar o caso de jogador que não atuou: nenhum lance atribuído a ele
- [x] 4.5 Verificar por script que a linha do tempo termina exatamente no placar decidido e que a mesma seed produz a mesma narração

## 5. Fluxo da temporada na interface

- [x] 5.1 Adicionar as telas `'match'` e `'review'` ao tipo `Screen` e ao roteamento de `app/page.tsx`
- [x] 5.2 Guardar o resultado da temporada em `pendingSeason` dentro de `useGame`, em vez de aplicar tudo num passo
- [x] 5.3 Reordenar o fluxo para jogo decisivo → pênalti → resumo → prêmio → transferência
- [x] 5.4 Levar o resumo à tela de fim de carreira quando for a última temporada
- [x] 5.5 Garantir que `skipToEnd` não passa pelo jogo decisivo nem pelo resumo

## 6. Tela do jogo decisivo

- [x] 6.1 Criar `components/screens/LiveMatch.tsx` com cabeçalho da competição, os dois times e o placar corrente
- [x] 6.2 Implementar o relógio com `setInterval` e garantia do estado final por timeout
- [x] 6.3 Revelar cada lance no minuto correspondente, destacando os do jogador
- [x] 6.4 Adicionar o botão de pular, sempre visível, que revela tudo imediatamente
- [x] 6.5 Apresentar a partida já concluída quando `prefers-reduced-motion: reduce` estiver ativo
- [x] 6.6 Deixar explícito na tela que é a reprise do jogo, não uma partida jogável

## 7. Tela de resumo da temporada

- [x] 7.1 Criar `components/screens/SeasonReview.tsx` com o cabeçalho da temporada, clube e idade
- [x] 7.2 Mostrar os totais consolidados de jogos, gols e assistências
- [x] 7.3 Mostrar o detalhamento por competição
- [x] 7.4 Mostrar os atributos que evoluíram e a variação do OVR em relação à temporada anterior
- [x] 7.5 Mostrar a campanha em cada competição com a fase alcançada, destacando os títulos
- [x] 7.6 Adicionar o botão de continuar, que leva à carreira ou ao fim quando for a última temporada

## 8. Animações

- [x] 8.1 Adicionar em `globals.css` o feedback de clique para `button` e `[role="button"]`
- [x] 8.2 Adicionar os keyframes de entrada de tela e de overlay
- [x] 8.3 Envolver tudo em `@media (prefers-reduced-motion: no-preference)`
- [x] 8.4 Criar `components/motion.tsx` com o wrapper de transição, aplicado por tela em `app/page.tsx`
- [x] 8.5 Aplicar a entrada animada ao painel e ao fundo escurecido em `components/Overlays.tsx`

## 9. Verificação

- [x] 9.1 `npx tsc --noEmit` sem erros
- [x] 9.2 `npx eslint .` sem erros
- [x] 9.3 `npm run build` concluindo
- [x] 9.4 `npx tsx scripts/check-data.ts` sem erros
- [x] 9.5 Jogar uma carreira inteira no navegador: draft, temporada com final, temporada sem final, aposentadoria
- [x] 9.6 Conferir que o pênalti convertido já aparece somado no resumo daquela temporada
- [x] 9.7 Repetir o percurso com movimento reduzido ativado
