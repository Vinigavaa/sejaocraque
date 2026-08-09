## 1. Caminho no mata-mata

- [x] 1.1 Trocar `KnockoutResult.matchesPlayed` e `.final` por `paths: Map<string, KnockoutMatch[]>`, com o tipo `KnockoutMatch` (fase, adversário, gols a favor, gols contra, pênaltis, venceu)
- [x] 1.2 Preencher o caminho em `simulateKnockout` a cada rodada, para os dois lados do confronto
- [x] 1.3 Remover o tipo `KnockoutFinal`, agora derivado do caminho
- [x] 1.4 Adaptar `toRun` e `playCups` em `career.ts`: contagem de jogos vem do tamanho do caminho
- [x] 1.5 Reescrever `finalScoreFor` para ler a entrada de fase `Final` no caminho
- [x] 1.6 `npx tsc --noEmit` limpo

## 2. Confederações e torneios de seleção

- [x] 2.1 Adicionar `confederation` a `Nation` e preencher as 48 seleções existentes
- [x] 2.2 Incluir Costa Rica, Panamá, Jamaica e Honduras para que a CONCACAF forme uma chave
- [x] 2.3 Criar a tabela de torneios continentais de seleção (nome, confederação, vagas) em `competitions.ts`
- [x] 2.4 Adicionar `nationalTournamentFor(nation)`, devolvendo `undefined` quando a confederação tem menos de quatro seleções
- [x] 2.5 Adicionar `nationalTournamentEntrants(tournament, guaranteed)`, no mesmo molde de `worldCupEntrants`
- [x] 2.6 Adicionar `isContinentalSeason(seasonIndex)` para os índices `% 4 === 1`

## 3. Calendário da seleção

- [x] 3.1 Trocar `NationalSeason` pela nova forma (`matches`, `tournament`) e criar `NationalMatch`
- [x] 3.2 Adicionar `nationalTotals(national)` derivando jogos, gols e assistências das partidas
- [x] 3.3 Escrever a decisão de presença por partida a partir da folga de OVR contra a força da seleção
- [x] 3.4 Gerar o ano de preparação: partidas de Eliminatórias contra a própria confederação e amistosos contra qualquer seleção
- [x] 3.5 Gerar o ano de torneio continental a partir do caminho da seleção no mata-mata, com amistosos de preparação
- [x] 3.6 Gerar o ano de Copa do Mundo pelo mesmo caminho, mantendo o comportamento de quem não se classificou
- [x] 3.7 Reescrever `playNationalTeam` sobre essas peças, mantendo `isCalledUp` como portão do ano

## 4. Consumidores dos totais da seleção

- [x] 4.1 `seasonTotals` monta a linha da seleção com `nationalTotals` e o nome do torneio do ano
- [x] 4.2 `careerTotals` soma jogos, gols e assistências pela seleção via `nationalTotals`, e conta Copa do Mundo pelo torneio vencido
- [x] 4.3 `decisiveMatch` procura a final do torneio de seleção nas partidas do ano, com precedência sobre as finais de clube
- [x] 4.4 `Career.tsx` mostra a badge do título de seleção pelo `tournament` vencido, não mais por `worldCup`
- [x] 4.5 `npx tsc --noEmit` limpo

## 5. Agregações de histórico

- [x] 5.1 Criar `lib/sim/history.ts` com `ClubSpell` e `clubSpells(state)`, quebrando a passagem quando o clube muda
- [x] 5.2 Deixar a passagem atual sem ano de fim enquanto a carreira não terminou
- [x] 5.3 Adicionar `Trophy` e `trophyCase(state)`, agrupando por nome de competição e separando clube de seleção
- [x] 5.4 Somar em cada passagem os jogos, gols, assistências e títulos das copas daquelas temporadas

## 6. Tela de histórico

- [x] 6.1 Adicionar `history` a `Screen` e `openHistory` / `closeHistory` ao `useGame`, guardando a tela de origem
- [x] 6.2 Criar `components/screens/History.tsx` sobre o `ScreenLayout`: passagens à esquerda, jogos no centro, troféus à direita
- [x] 6.3 Renderizar as passagens com período, jogos, gols, assistências e títulos
- [x] 6.4 Renderizar a sala de troféus com contagem e anos, e o texto de carreira sem títulos
- [x] 6.5 Renderizar os jogos temporada a temporada, com a temporada expandida mostrando competição a competição
- [x] 6.6 Mostrar, na temporada expandida, as partidas de seleção com competição, adversário e placar
- [x] 6.7 Ligar a tela em `app/page.tsx` e o botão de voltar em `closeHistory`

## 7. Entradas para o histórico

- [x] 7.1 Botão de histórico no trilho de ações da `Career.tsx`, oculto enquanto não há temporada jogada
- [x] 7.2 Botão de histórico na `End.tsx`
- [x] 7.3 `SeasonReview.tsx` lista as partidas de seleção da temporada

## 8. Verificação

- [x] 8.1 Carreira completa com nacionalidade brasileira: conferir Eliminatórias, Copa América e Copa do Mundo aparecendo nos anos certos
- [x] 8.2 Repetir com nacionalidade de país sem liga mapeada (ex.: Croácia) e com um país da CONCACAF
- [x] 8.3 Conferir que jogador fraco não é convocado e que a temporada não mostra seleção
- [x] 8.4 Conferir que os totais da tela de fim de carreira batem com a soma das partidas
- [x] 8.5 Abrir o histórico da carreira e do fim de carreira e conferir que voltar devolve à tela certa
- [x] 8.6 Conferir passagens com retorno a um clube anterior e sala de troféus com título repetido
- [x] 8.7 Percorrer o histórico em 390px e em 1440px
- [x] 8.8 `npm run lint` e `npm run build` limpos
