## ADDED Requirements

### Requirement: Escala de interface por viewport

O sistema SHALL expor uma escala de interface como custom property CSS (`--ui-scale`) definida no elemento raiz e ajustada por breakpoint.

A escala MUST valer `1` abaixo de 1024px e `1.15` a partir de 1024px, sem nenhum outro degrau intermediário.

#### Scenario: Escala neutra no mobile

- **WHEN** a viewport tem menos de 1024px de largura
- **THEN** `--ui-scale` vale 1 e a interface renderiza com os mesmos tamanhos de hoje

#### Scenario: Escala ampliada no desktop

- **WHEN** a viewport tem 1024px ou mais de largura
- **THEN** `--ui-scale` vale 1.15 e tipografia e espaçamentos dos componentes compartilhados crescem proporcionalmente

### Requirement: Componentes compartilhados consomem a escala

Os componentes de `components/ui.tsx` — `Display`, `SectionLabel`, `Stat`, `PrimaryButton`, `GhostButton`, `SelectCard`, `Badge` e `Screen` — SHALL derivar seus tamanhos de fonte e espaçamentos da escala, em vez de valores fixos em pixel.

A API pública desses componentes MUST permanecer inalterada: `Display` continua recebendo `size` como número em px, interpretado como tamanho base antes da escala.

#### Scenario: Display escalado

- **WHEN** `<Display size={34} />` é renderizado em uma viewport de desktop
- **THEN** o texto é renderizado a 34px multiplicados pela escala vigente

#### Scenario: Chamada existente não quebra

- **WHEN** qualquer tela existente renderiza um componente compartilhado sem alterar sua chamada
- **THEN** o componente compila e renderiza sem mudança de API

### Requirement: Ausência de tamanhos fixos concorrentes nas telas

Tamanhos de fonte e espaçamentos definidos diretamente nas telas SHALL passar pela mesma escala quando pertencem a elementos de leitura primária (títulos, números, rótulos e corpo de texto).

Detalhes de traço — larguras de borda, raios de canto e alturas de barra de progresso — MAY permanecer fixos.

#### Scenario: Tela densa em desktop

- **WHEN** as telas Home, Draft, Career, SeasonReview e End são abertas em uma viewport de 1440px
- **THEN** seus textos e números aparecem escalados junto com os componentes compartilhados, sem elementos visivelmente menores que o restante da tela
