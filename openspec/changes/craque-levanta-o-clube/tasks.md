## 1. A fórmula do reforço

- [x] 1.1 Criar `lib/sim/impact.ts` com `LIFT_WEIGHT = 0.22`, `MAX_LIFT = 5` e `clubLift(overall, clubStrength, participation)`
- [x] 1.2 Garantir que o resultado é zero quando o jogador está abaixo do elenco e que nunca passa de 5
- [x] 1.3 Documentar no arquivo por que o reforço não pode entrar em `Club.strength`

## 2. Reforço na simulação de partidas

- [x] 2.1 Adicionar o parâmetro opcional de reforço `{ clubId, amount }` a `simulateLeague`
- [x] 2.2 Aplicar o reforço em `seasonForm`, somando à força antes da variação de forma
- [x] 2.3 Adicionar o mesmo parâmetro a `simulateKnockout` e aplicá-lo em `playTie`
- [x] 2.4 Conferir que apenas o clube indicado é reforçado, e que sem o parâmetro o comportamento é idêntico ao atual

## 3. Ordem da temporada

- [x] 3.1 Inverter `playSeason`: apurar `simulatePlayerSeason` antes de `simulateLeague`
- [x] 3.2 Calcular o reforço da liga a partir de `stats.matches / totalMatches` e passá-lo a `simulateLeague`
- [x] 3.3 Passar o reforço correspondente à copa nacional e à competição continental em `playCups`
- [x] 3.4 Passar o reforço da seleção em `playNationalTeam`, calculado contra a força da seleção
- [x] 3.5 Adicionar `clubLift: number` ao `SeasonRecord`
- [x] 3.6 Conferir que `matchesPlayed`, `ratingFor`, `playerOutput`, `buildOffers`, `marketValue` e `resolveAwards` continuam lendo a força real do elenco

## 4. Medição

- [x] 4.1 Escrever `scripts/smoke-impact.ts` medindo, ao longo de muitas temporadas, a colocação média e a taxa de título de um mesmo clube com e sem craque
- [x] 4.2 Rodar para um clube de Série C com OVR 92, um clube de meio de tabela da Série A com OVR 85 e um clube de elite com OVR 85
- [x] 4.3 Confirmar que o clube pequeno sobe de faixa sem virar favorito absoluto, e que o clube de elite quase não muda
- [x] 4.4 Rodar `smoke-titles.ts` e conferir que a liga sem jogador continua com a mesma distribuição de títulos
- [x] 4.5 Rodar `smoke-season-review.ts` e `check-data.ts` sem erros

## 5. Interface

- [x] 5.1 Mostrar o reforço na tela de carreira — no bloco da temporada, não no cabeçalho: o cabeçalho mostra o clube da próxima temporada e a frase nomearia o clube errado
- [x] 5.2 Mostrar o reforço no bloco de evolução do resumo de temporada
- [x] 5.3 Omitir o indicador quando o reforço é zero, em vez de exibir "+0"

## 6. Verificação

- [x] 6.1 `npx tsc --noEmit` sem erros
- [x] 6.2 `npx eslint .` sem erros
- [x] 6.3 `npm run build` concluindo
- [x] 6.4 Jogar no navegador uma carreira começando em clube pequeno e confirmar que o clube rende acima do esperado enquanto o jogador está lá
- [x] 6.5 Confirmar que subir para clube muito acima do nível zera o reforço sem custar minutos — verificado por `smoke-impact.ts`, não no navegador (o script de automação do navegador travava)
