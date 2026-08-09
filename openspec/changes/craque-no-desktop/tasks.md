## 1. Fundação da escala

- [x] 1.1 Declarar `--ui-scale: 1` em `:root` no `app/globals.css` e sobrescrever para `1.15` em `@media (min-width: 1024px)`
- [x] 1.2 Adicionar o helper `scaled(px: number): string` em `lib/ui/theme.ts`
- [x] 1.3 Reexportar `scaled` em `components/shared.ts`

## 2. Componentes compartilhados

- [x] 2.1 Aplicar `scaled()` ao `fontSize` de `Display`, mantendo a prop `size` como número
- [x] 2.2 Converter `sectionLabel` para usar `scaled(11)`
- [x] 2.3 Aplicar `scaled()` a `Stat`, `Badge`, `PrimaryButton` e `GhostButton`
- [x] 2.4 Aplicar `scaled()` ao padding de `Screen`, mantendo bordas e raios fixos
- [x] 2.5 Rodar `npm run lint` e `npx tsc --noEmit`

## 3. Coluna e moldura — SUPERSEDIDO pela v2 do design

- [x] 3.1 ~~Marcar `<main>` com `data-frame` e a coluna com `data-column`~~ — os atributos permanecem, mas passam a marcar o shell
- [x] 3.2 ~~`--column-width` de 480px/560px~~ — removido: o desktop não tem mais coluna
- [x] 3.3 Substituir `minHeight: '100vh'` por `100dvh` — mantido, vale para o shell
- [x] 3.4 ~~Fundo ambiente, borda lateral e centralização vertical~~ — removido com a coluna
- [x] 3.5 ~~Confirmar que abaixo de 640px nada disso se aplica~~ — sem efeito

## 4. Estados de ponteiro

- [x] 4.1 Regra de hover sob `@media (hover: hover) and (pointer: fine)`
- [x] 4.2 `:focus-visible` com `outline` na cor de acento
- [x] 4.3 Transições de hover dentro do bloco `prefers-reduced-motion: no-preference`

## 5. Escala nas telas

- [x] 5.1 Escalar os px de leitura em `Home.tsx`
- [x] 5.2 Escalar `Draft.tsx`, mantendo a barra de progresso fixa
- [x] 5.3 Escalar `Career.tsx` e `SeasonReview.tsx`
- [x] 5.4 Escalar `End.tsx`, `Reveal.tsx`, `Create.tsx`, `ClubStart.tsx` e `LiveMatch.tsx`
- [x] 5.5 Ajustar `Overlays.tsx` para a viewport com rolagem interna

## 6. Verificação da v1

- [x] 6.1 Verificar em 390px que nada regrediu
- [x] 6.2 Verificar em 1440px
- [x] 6.3 Verificar em 768px
- [x] 6.4 Testar nomes longos de `lib/sim/data/`
- [x] 6.5 Tab dá foco visível; clique de mouse não deixa contorno
- [x] 6.6 Movimento reduzido mantém hover e foco sem transição
- [x] 6.7 `npm run lint` e `npm run build` limpos

## 7. Shell de tela cheia

- [x] 7.1 Criar `components/ScreenLayout.tsx` com as props `left`, `right`, `mobileOrder` e children, sem lógica de breakpoint em JS
- [x] 7.2 Criar `components/DesktopShell.tsx` com o cabeçalho fixo (marca + identificação do jogador quando há carreira)
- [x] 7.3 Definir no `globals.css` a grade do shell: coluna única abaixo de 1024px, `<trilho> 1fr <trilho>` acima, com posicionamento por `grid-area`
- [x] 7.4 Implementar o colapso de trilho ausente sem deixar coluna vazia
- [x] 7.5 Dar rolagem independente a cada região no desktop, com `overscroll-behavior: contain`
- [x] 7.6 Remover de `app/page.tsx` a coluna, o `--column-width` e a moldura da v1, montando o shell no lugar
- [x] 7.7 Ancorar os overlays à viewport (já em `fixed`) e confirmar que seguem centrados no palco

## 8. Cartão e ficha

- [x] 8.1 Criar `components/PlayerCard.tsx` com as variantes `hero` e `rail`, só tipografia
- [x] 8.2 Criar `components/PlayerSheet.tsx` lendo o `Game`: espaços do draft antes da carreira, atributos e totais depois
- [x] 8.3 Incluir na ficha os totais de jogos, gols, assistências, títulos e bolas de ouro
- [x] 8.4 Ocultar cartão e ficha enquanto não existe jogador

## 9. Conversão das telas

- [x] 9.1 `Home.tsx` — hero central sem trilho esquerdo; exemplos de carreira à direita
- [x] 9.2 `Create.tsx` — formulário no centro, prévia do cartão à direita
- [x] 9.3 `Draft.tsx` — lenda e grade no centro; progresso, re-sorteios e seed à esquerda; slots na ficha
- [x] 9.4 `Reveal.tsx` — cartão `hero` como peça central
- [x] 9.5 `ClubStart.tsx` — escolha do clube no centro
- [x] 9.6 `LiveMatch.tsx` — placar no centro, lances à esquerda
- [x] 9.7 `SeasonReview.tsx` — totais e evolução no centro, competição a competição à esquerda
- [x] 9.8 `Career.tsx` — temporada e treino no centro; tabela, linha do tempo e imprensa à esquerda; ações no trilho direito
- [x] 9.9 `End.tsx` — cartão final no centro, carreira à esquerda

## 10. Verificação do shell

- [x] 10.1 Percorrer as nove telas em 1440px conferindo que o painel ocupa a tela toda e nenhum trilho fica vazio
- [x] 10.2 Repetir em 2560px e em 1024px (o próprio breakpoint)
- [x] 10.3 Percorrer as nove telas em 390px conferindo que o empilhamento é o de hoje
- [x] 10.4 Confirmar rolagem independente por região e ausência de rolagem horizontal em todas as larguras
- [x] 10.5 Confirmar que o cabeçalho mostra só a marca antes da revelação e a identificação depois
- [x] 10.6 Abrir os três overlays com a página rolada e confirmar centralização na viewport
- [x] 10.7 `npm run lint` e `npm run build` limpos
