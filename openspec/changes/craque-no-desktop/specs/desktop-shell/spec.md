## ADDED Requirements

### Requirement: Painel de tela cheia no desktop

A partir de 1024px o jogo SHALL ocupar toda a largura da viewport em um painel de três faixas — trilho esquerdo, palco central e trilho direito — sob um cabeçalho fixo.

O painel MUST NOT impor largura máxima ao conjunto. O palco central MUST absorver a largura sobrando; os trilhos MUST ter largura fixa.

#### Scenario: Monitor largo

- **WHEN** o jogo é aberto em uma viewport de 1440x900
- **THEN** o painel ocupa os 1440px de largura, com trilhos de largura fixa e o palco central preenchendo o restante

#### Scenario: Sem rolagem horizontal

- **WHEN** o jogo é aberto em qualquer largura entre 320px e 2560px
- **THEN** a página não apresenta rolagem horizontal

### Requirement: Coluna única abaixo do breakpoint

Abaixo de 1024px o jogo SHALL renderizar em coluna única, mantendo o enquadramento vertical atual.

Os lotes de conteúdo MUST empilhar em uma ordem declarada pela tela, para que o resultado no celular permaneça o que é hoje.

#### Scenario: Celular

- **WHEN** a viewport tem menos de 1024px de largura
- **THEN** os três lotes aparecem empilhados em uma coluna, na ordem declarada pela tela, sem trilhos e sem cabeçalho fixo

#### Scenario: Tablet em retrato

- **WHEN** a viewport tem 768px de largura
- **THEN** o layout é o mesmo do celular, em coluna única

### Requirement: Cabeçalho fixo de identificação

A partir de 1024px o shell SHALL exibir um cabeçalho fixo no topo com a marca do jogo e, quando existe carreira em andamento, a identificação do jogador: nome, número, posição, clube, idade e OVR.

O cabeçalho MUST permanecer visível durante a rolagem e MUST exibir apenas a marca enquanto não há jogador criado.

#### Scenario: Antes de criar o jogador

- **WHEN** a tela inicial ou a de criação está ativa em desktop
- **THEN** o cabeçalho exibe apenas a marca do jogo

#### Scenario: Durante a carreira

- **WHEN** qualquer tela posterior à revelação está ativa em desktop
- **THEN** o cabeçalho exibe nome, número, posição, clube, idade e OVR do jogador

#### Scenario: Rolagem

- **WHEN** o jogador rola uma tela longa em desktop
- **THEN** o cabeçalho permanece fixo no topo

### Requirement: Trilhos com rolagem independente

Cada trilho e o palco central SHALL rolar de forma independente no desktop, cada um limitado à altura disponível abaixo do cabeçalho.

#### Scenario: Tabela longa no trilho esquerdo

- **WHEN** a tela de carreira exibe uma tabela de 20 clubes em uma viewport de 900px de altura
- **THEN** o trilho esquerdo rola sozinho, sem arrastar o palco central nem o trilho direito

### Requirement: Trilho ausente

Uma tela SHALL poder declarar nenhum conteúdo para um trilho.

Quando um trilho não tem conteúdo, a grade MUST redistribuir o espaço em vez de deixar uma coluna vazia.

#### Scenario: Tela inicial sem trilho esquerdo

- **WHEN** a tela inicial é exibida em desktop e não declara conteúdo à esquerda
- **THEN** nenhuma coluna vazia é reservada e o espaço vai para o palco central

### Requirement: Overlays ancorados à viewport

Os overlays SHALL cobrir a viewport inteira e permanecer limitados à altura dela em qualquer breakpoint, rolando internamente quando o conteúdo excede o espaço.

#### Scenario: Overlay com o palco rolado

- **WHEN** um overlay abre com a página rolada para o meio de uma tela longa
- **THEN** ele aparece centralizado na viewport, e não na posição original do conteúdo
