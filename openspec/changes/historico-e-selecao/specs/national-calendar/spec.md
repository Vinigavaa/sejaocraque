## ADDED Requirements

### Requirement: Toda partida de seleção é individual

Cada jogo do jogador pela seleção SHALL ser registrado como uma partida própria, com nome da competição, fase, adversário, placar pelo lado da seleção e a produção do jogador naquele jogo. O sistema MUST NOT representar um ano de seleção como um número agregado de convocações.

#### Scenario: Ano de seleção registrado

- **WHEN** o jogador é convocado em uma temporada
- **THEN** a temporada guarda uma lista de partidas, cada uma com competição, fase, adversário, gols a favor, gols contra, e os gols e assistências do jogador

#### Scenario: Totais derivados das partidas

- **WHEN** a interface precisa dos jogos, gols ou assistências do jogador pela seleção na temporada
- **THEN** esses números vêm da soma das partidas em que ele entrou em campo, e não de um campo armazenado à parte

### Requirement: O ano da seleção segue um ciclo de quatro anos

O calendário da seleção SHALL seguir o ciclo real: Copa do Mundo no ano dela, torneio continental da confederação do país no meio do ciclo, e Eliminatórias mais amistosos nos demais anos. Toda temporada em que o jogador é convocado SHALL ter ao menos um jogo.

#### Scenario: Ano de Copa do Mundo

- **WHEN** a temporada é ano de Copa do Mundo e a seleção se classificou
- **THEN** o calendário tem amistosos de preparação e as partidas da Copa do Mundo, cada uma nomeada com a fase alcançada

#### Scenario: Ano de torneio continental

- **WHEN** a temporada cai no meio do ciclo e o país pertence a uma confederação com torneio mapeado
- **THEN** o calendário tem as partidas desse torneio, nomeadas com o nome dele — Eurocopa, Copa América, Copa Africana, Copa Asiática ou Copa Ouro

#### Scenario: Ano de preparação

- **WHEN** a temporada não é de Copa do Mundo nem de torneio continental
- **THEN** o calendário tem partidas de Eliminatórias e amistosos, cada uma identificada com a sua competição

#### Scenario: Confederação sem torneio disputável

- **WHEN** a confederação do país do jogador não tem seleções suficientes para formar uma chave
- **THEN** o ano do meio do ciclo é disputado como ano de preparação, e nenhuma competição inventada aparece

### Requirement: A convocação é decidida por partida

Estar na lista da seleção SHALL ser avaliado jogo a jogo, e não uma vez por temporada. Um jogador convocado que não entrou em campo em uma partida SHALL ter essa partida registrada sem produção dele.

#### Scenario: Jogador no limite da lista

- **WHEN** o OVR do jogador está próximo do corte de convocação da seleção
- **THEN** ele aparece em parte das partidas do ano e fica de fora das outras

#### Scenario: Jogador muito abaixo do corte

- **WHEN** o OVR do jogador está abaixo da margem de convocação
- **THEN** a temporada não tem seleção nenhuma e nada de seleção é exibido

### Requirement: O mata-mata registra o caminho de cada participante

A simulação de mata-mata SHALL registrar, para cada participante, a sequência de partidas que ele disputou — fase, adversário e placar. A quantidade de jogos de um participante SHALL ser derivada desse caminho.

#### Scenario: Caminho da seleção na Copa

- **WHEN** a seleção do jogador é eliminada nas quartas de final
- **THEN** o caminho dela tem uma partida por fase disputada, terminando na derrota das quartas, com adversário e placar em cada uma

#### Scenario: Participante que não entrou na chave

- **WHEN** um participante fica fora da chave por ela só aceitar potência de dois
- **THEN** o caminho dele é vazio e ele conta zero jogos
