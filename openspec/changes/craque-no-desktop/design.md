## Context

O CRAQUE é um Next.js 16 / React 19 sem biblioteca de UI: estilo inline via objetos `style`, tokens de cor em `lib/ui/theme.ts`, e um punhado de regras globais em `app/globals.css` (movimento, scrollbar, feedback de toque). A composição é uma coluna vertical, com nove telas em `components/screens/` e primitivos em `components/ui.tsx`.

**Esta é a segunda versão do design.** A primeira manteve a coluna e apenas a alargou para 560px com uma moldura ambiente. Foi implementada, revisada e rejeitada: em um monitor continuava sendo uma tira estreita cercada de vazio. A referência trazida na revisão é outra arquitetura — painel de tela cheia, cabeçalho fixo, trilhos laterais e um placar sempre visível à direita.

O que sobreviveu da primeira versão: a escala por custom property (decisão 1) e os estados de ponteiro (decisão 7). O que foi descartado: coluna de 560px, moldura ambiente e centralização vertical.

## Goals / Non-Goals

**Goals:**

- Ocupar a tela inteira do desktop com um painel de três faixas, sem largura máxima.
- Tornar a ficha do jogador — atributos e totais — permanentemente visível, como o placar da referência.
- Dar ao jogo sua primeira peça gráfica de verdade: o cartão do jogador.
- Preservar no mobile o empilhamento em coluna única que existe hoje.

**Non-Goals:**

- Escudos, fotos ou ilustração de campo. A identidade continua tipográfica.
- Atalhos de teclado além do Enter/Espaço já implementados.
- Tema claro, migração para Tailwind, alterações em `lib/sim/`.

## Decisions

### 1. Escala via custom property CSS, não via estado React *(mantida da v1)*

`--ui-scale` é declarada em `:root` e sobrescrita em `@media (min-width: 1024px)`. O helper `scaled(px)` em `lib/ui/theme.ts` devolve `calc(${px}px * var(--ui-scale))`.

*Por quê:* um hook `useViewport` introduziria estado de cliente e um primeiro frame errado na hidratação. A custom property resolve no CSS e funciona no SSR.

### 2. Telas declaram lotes, não árvores

Cada tela passa a renderizar um `<ScreenLayout left={…} right={…}>{centro}</ScreenLayout>`. O `ScreenLayout` não decide o que vai em cada lote — a tela decide; ele só sabe posicioná-los.

*Por quê:* a alternativa seria o shell tentar adivinhar o que promover a trilho a partir de uma árvore única, o que exigiria marcação semântica em cada seção e daria um componente frágil. Lotes explícitos são chatos de escrever uma vez e óbvios de ler depois.

*Alternativa descartada:* dois componentes por tela (`CareerMobile` / `CareerDesktop`). Dobraria a superfície de manutenção — nove telas viram dezoito — e é exatamente o erro que o CLAUDE.md chama de complexidade antecipada.

### 3. Uma grade, não dois layouts

O mesmo DOM serve os dois breakpoints. Abaixo de 1024px é uma coluna; acima, `grid-template-columns: <trilho> 1fr <trilho>` com posicionamento explícito por `grid-area`.

*Por quê:* posicionar por `grid-area` desacopla a ordem visual do desktop da ordem do DOM. Assim o DOM pode manter a ordem que o mobile precisa — o empilhamento de hoje — sem que isso amarre a disposição do desktop.

*Consequência:* a ordem de empilhamento no mobile vira uma decisão explícita de cada tela (prop `mobileOrder`), em vez de acidente da ordem do JSX.

### 4. Trilhos rolam sozinhos, o palco também

No desktop, cabeçalho fixo e três regiões com `overflow-y: auto` e `height: calc(100dvh - <cabeçalho>)`. No mobile, nada disso: a página rola inteira, como hoje.

*Por quê:* é o que faz o painel parecer um painel. Sem isso, ler a tabela da liga rolaria a ficha do jogador para fora da tela — justamente o que ela existe para evitar.

*Risco assumido:* três áreas de rolagem é uma decisão que envelhece mal se o conteúdo de um trilho crescer muito. Aceito porque o conteúdo de cada trilho é limitado por natureza (8 atributos, 20 clubes, ~20 temporadas).

### 5. `PlayerSheet` lê do estado do jogo, não de props das telas

A ficha do trilho direito recebe o `Game` inteiro e decide sozinha o que mostrar: espaços do draft antes da carreira, atributos e totais depois.

*Por quê:* a ficha aparece em oito das nove telas. Passar os mesmos seis campos por oito telas seria repetição pura, e cada tela teria a chance de passar errado.

*Consequência aceita:* acoplamento da ficha ao formato de `useGame`. É aceitável — `useGame` já é o contrato único de estado do projeto.

### 6. O cartão é tipográfico

`PlayerCard` em duas variantes (`hero`, `rail`), construído com Anton, o número da camisa em corpo grande e os atributos em grade. Sem escudo e sem foto.

*Por quê:* `theme.ts` registra que a identidade é carregada pela tipografia e pelo laranja. Uma figurinha com foto exigiria direitos de imagem e contradiria o aviso de não-afiliação que a tela inicial exibe.

### 7. Hover e foco por regra global *(mantida da v1)*

`@media (hover: hover) and (pointer: fine)` para hover; `:focus-visible` com `outline` em `t.accent` para foco. Ambos no `globals.css`, como a regra `:active` que já existia.

## Risks / Trade-offs

- **Telas com pouco conteúdo ficam com trilhos vazios e palco solto.** → `ScreenLayout` colapsa trilhos ausentes e redistribui o espaço; Home e Create não declaram trilho esquerdo.
- **Nove telas reescritas de uma vez é muita superfície para regredir.** → Cada tela é convertida e verificada isoladamente nos dois breakpoints antes de passar para a próxima.
- **A ordem de empilhamento no mobile pode mudar sem ninguém perceber.** → `mobileOrder` é explícito por tela e a verificação em 390px compara com o comportamento atual, tela a tela.
- **Rolagem em três regiões pode prender o scroll do mouse na região errada.** → Verificar com a roda do mouse sobre cada região; `overscroll-behavior: contain` nos trilhos.

## Migration Plan

Mudança puramente visual, sem estado persistido, sem API, sem migração de dados. Reversível por `git revert`. Verificação manual em 390px, 768px, 1440px e 2560px, percorrendo as nove telas e os overlays.

## Open Questions

Nenhuma. Estrutura do shell (ficha fixa à direita) e peça central (cartão do jogador) foram decididas com o usuário na revisão.
