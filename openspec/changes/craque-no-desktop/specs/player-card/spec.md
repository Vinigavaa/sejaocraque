## ADDED Requirements

### Requirement: Cartão do jogador

O sistema SHALL exibir um cartão do jogador: bloco em estilo figurinha com número da camisa, posição, nome, nacionalidade, OVR e os oito atributos.

O cartão MUST ser inteiramente tipográfico — sem escudo, foto ou ilustração — coerente com a identidade registrada em `lib/ui/theme.ts`.

O cartão MUST existir em duas variantes: `hero`, peça central de tela, e `rail`, versão compacta do trilho direito.

#### Scenario: Cartão na revelação

- **WHEN** o draft termina e a tela de revelação é exibida
- **THEN** o cartão aparece na variante `hero` como peça central, com todos os oito atributos

#### Scenario: Cartão no trilho

- **WHEN** qualquer tela com carreira em andamento é exibida em desktop
- **THEN** o cartão aparece na variante `rail` no topo do trilho direito

### Requirement: Ficha persistente

A partir de 1024px o trilho direito SHALL exibir, em todas as telas onde já existe jogador, a ficha: os oito atributos com seus valores atuais e os totais acumulados de carreira.

Os totais MUST cobrir jogos, gols, assistências, títulos e bolas de ouro.

#### Scenario: Ficha durante a carreira

- **WHEN** a tela de carreira é exibida em desktop
- **THEN** o trilho direito mostra os oito atributos com os valores atuais e os totais acumulados

#### Scenario: Atributo evolui

- **WHEN** um atributo evolui ao virar a temporada
- **THEN** o valor exibido na ficha reflete o novo valor sem que o jogador precise mudar de tela

### Requirement: Ficha durante o draft

Durante o draft a ficha SHALL mostrar os oito espaços do jogador em construção, indicando quais já foram preenchidos e de qual lenda cada atributo veio.

#### Scenario: Draft pela metade

- **WHEN** quatro dos oito atributos já foram roubados
- **THEN** a ficha mostra os quatro valores com a lenda de origem e os quatro espaços restantes como vazios

### Requirement: Ausência de jogador

Enquanto não existe jogador, o trilho direito SHALL NOT exibir cartão nem ficha.

#### Scenario: Tela inicial

- **WHEN** a tela inicial é exibida em desktop
- **THEN** nenhum cartão ou ficha aparece no trilho direito
