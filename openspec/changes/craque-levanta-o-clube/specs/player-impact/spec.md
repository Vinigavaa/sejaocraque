## ADDED Requirements

### Requirement: Reforço do jogador ao clube
A presença do jogador SHALL somar força ao clube dele na simulação de partidas, proporcional
a quanto o jogador está acima da força do elenco e à fração da temporada que ele disputou.

#### Scenario: Craque em clube pequeno
- **WHEN** um jogador de OVR 92 disputa a temporada inteira num clube de força 45
- **THEN** o clube joga as partidas com força 50

#### Scenario: Jogador no nível do elenco
- **WHEN** o OVR do jogador é igual à força do clube
- **THEN** o reforço é zero e o clube joga com a força de sempre

#### Scenario: Reserva pouco utilizado
- **WHEN** o jogador está 20 pontos acima do elenco mas disputa apenas 10% dos jogos
- **THEN** o reforço é aproximadamente um décimo do que seria com participação integral

### Requirement: Teto do reforço
O reforço SHALL ser limitado a 5 pontos de força, independentemente de quão superior o
jogador for ao elenco.

#### Scenario: Diferença enorme
- **WHEN** um jogador de OVR 99 disputa a temporada inteira num clube de força 42
- **THEN** o reforço é 5, e não a diferença proporcional

#### Scenario: Diferença moderada
- **WHEN** um jogador de OVR 85 disputa a temporada inteira num clube de força 74
- **THEN** o reforço fica entre 1 e 5

### Requirement: O reforço nunca é negativo
Jogador abaixo da força do elenco SHALL produzir reforço zero, nunca uma penalidade ao
clube.

#### Scenario: Jogador muito abaixo do elenco
- **WHEN** um jogador de OVR 60 está num clube de força 85
- **THEN** o reforço é zero
- **AND** o clube joga exatamente com a força que teria sem ele

### Requirement: Competições alcançadas pelo reforço
O reforço SHALL valer na liga nacional, na copa nacional, na competição continental e na
seleção, e SHALL usar em cada uma a participação do jogador naquela competição.

#### Scenario: Copa nacional
- **WHEN** o clube do jogador disputa a copa nacional
- **THEN** as partidas do clube na copa usam a força reforçada

#### Scenario: Adversários não são reforçados
- **WHEN** o clube do jogador enfrenta outro clube
- **THEN** apenas o clube do jogador recebe reforço

#### Scenario: Seleção
- **WHEN** o jogador é convocado e sua seleção disputa a Copa do Mundo
- **THEN** a seleção joga com a força reforçada pela presença dele

### Requirement: O reforço não afeta as regras de elenco
O reforço SHALL ser usado exclusivamente para simular partidas. Minutos em campo, nota da
temporada, valor de mercado, propostas de transferência e prêmios individuais SHALL
continuar lendo a força real do elenco.

#### Scenario: Minutos em campo
- **WHEN** o jogador é muito superior ao elenco e portanto reforça bastante o clube
- **THEN** os jogos que ele disputa são calculados pela força real do elenco
- **AND** o reforço não reduz seus minutos

#### Scenario: Nota da temporada
- **WHEN** a nota do jogador é apurada
- **THEN** a comparação usa a força real do elenco, não a reforçada

#### Scenario: Propostas de transferência
- **WHEN** outros clubes avaliam o jogador ao fim da temporada
- **THEN** a avaliação usa a força real do clube atual

### Requirement: Apuração da temporada antes da tabela
A produção do jogador na temporada SHALL ser apurada antes da simulação da liga, porque a
tabela passa a depender de quanto ele jogou.

#### Scenario: Ordem de apuração
- **WHEN** uma temporada é jogada
- **THEN** os jogos disputados pelo jogador são determinados antes da tabela da liga
- **AND** a tabela reflete o reforço correspondente a essa participação

### Requirement: Visibilidade do reforço
O jogo SHALL mostrar ao jogador quanto sua presença vale para o clube, na tela de carreira e
no resumo de temporada.

#### Scenario: Jogador que reforça
- **WHEN** o reforço da temporada é maior que zero
- **THEN** o valor aparece na tela de carreira e no resumo da temporada

#### Scenario: Jogador que não reforça
- **WHEN** o reforço é zero
- **THEN** a interface não exibe o indicador, em vez de exibir zero
