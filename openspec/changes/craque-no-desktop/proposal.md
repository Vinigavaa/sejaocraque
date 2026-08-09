## Why

O CRAQUE foi desenhado como uma coluna vertical de 480px com tamanhos fixos em pixels. Em um monitor de 1440px o jogo aparece como uma tira estreita perdida no meio da tela, com tipografia pequena demais para a distância de leitura de desktop e sem nenhum retorno visual ao passar o mouse — o único feedback de interação hoje é o `:active`, pensado para toque.

Quem joga no navegador do computador tem, na prática, uma versão pior do mesmo jogo.

**Revisão (2026-08-09):** a primeira tentativa manteve a coluna vertical, apenas mais larga (560px) e com uma moldura ambiente. Foi rejeitada na revisão: continuava sendo uma tira no meio de um monitor vazio. O desktop precisa de um **painel de tela cheia** — cabeçalho fixo, trilhos laterais e ficha do jogador sempre visível —, não de uma coluna melhor enquadrada.

## What Changes

- Introduzir uma **escala de interface** dependente da viewport: custom properties CSS (`--ui-scale`) consumidas pelos componentes compartilhados, em vez de valores fixos em px espalhados pelas telas.
- Introduzir um **shell de desktop de tela cheia** a partir de 1024px: cabeçalho fixo com a identificação do jogador, trilho esquerdo contextual, palco central e trilho direito persistente.
- Tornar a **ficha do jogador** (os 8 atributos e os totais de carreira) um elemento persistente do trilho direito, visível em todas as telas — hoje ela só existe espalhada dentro de cada tela.
- Criar o **cartão do jogador**, primeira peça gráfica do projeto: bloco tipográfico estilo figurinha com número, posição, OVR e atributos, usado como peça central na revelação e em versão compacta no trilho direito.
- Converter as telas para o modelo de **três lotes de conteúdo** (esquerda, centro, direita), preservando no mobile o empilhamento em coluna única que existe hoje.
- Adicionar estados `:hover` e `:focus-visible` a botões e cartões selecionáveis, hoje inexistentes, respeitando `prefers-reduced-motion` como o resto do movimento do projeto.

**Não faz parte desta mudança:** atalhos de teclado além de Enter/Espaço já existentes, tema claro, escudos ou fotos de jogador, e qualquer alteração na simulação (`lib/sim/`).

## Capabilities

### New Capabilities

- `desktop-shell`: o painel de tela cheia — cabeçalho fixo, trilhos, palco central, e como cada tela distribui conteúdo entre eles em cada breakpoint.
- `player-card`: o cartão do jogador e a ficha persistente — o que mostram, em que variantes, e a partir de que ponto da partida existem.
- `ui-scale`: escala tipográfica e de espaçamento dirigida por custom properties, com os componentes compartilhados consumindo tokens em vez de px fixos.
- `pointer-feedback`: estados de hover e foco visível para controles interativos, coerentes com o feedback de toque já existente.

### Modified Capabilities

Nenhuma — `openspec/specs/` está vazio; não há requisito publicado sendo alterado.

## Impact

- `app/globals.css` — custom properties de escala, grade do shell por breakpoint, regras de hover/focus.
- `app/page.tsx` — deixa de montar uma coluna e passa a montar o shell.
- `lib/ui/theme.ts` — helper de escala ao lado dos tokens de cor já existentes.
- `components/ui.tsx` — primitivos consumindo a escala; `Screen` deixa de ser o enquadramento e vira o palco.
- **Novos:** `components/DesktopShell.tsx`, `components/ScreenLayout.tsx`, `components/PlayerCard.tsx`, `components/PlayerSheet.tsx`.
- `components/screens/*.tsx` — todas as nove telas passam a declarar seus lotes de conteúdo. Career, SeasonReview e Draft são as mais afetadas.
- `components/Overlays.tsx` — ancoragem à viewport em vez de à coluna.
- Sem novas dependências. Sem impacto em `lib/sim/` ou em `lib/game/useGame.ts`.
