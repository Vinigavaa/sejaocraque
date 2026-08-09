## ADDED Requirements

### Requirement: Toda partida de seleção tem narração minuto a minuto

Cada partida de seleção SHALL ter uma narração minuto a minuto disponível, gerada a partir da semente da carreira. A narração SHALL ser determinística: a mesma partida narra igual todas as vezes que for aberta.

#### Scenario: Abrir a narração

- **WHEN** o jogador toca em uma partida de seleção na lista
- **THEN** os lances da partida aparecem em ordem de minuto, e os gols somam o placar já registrado

#### Scenario: Reabrir a mesma partida

- **WHEN** o jogador fecha a narração e abre a mesma partida de novo
- **THEN** os lances são exatamente os mesmos

#### Scenario: Partida em que o jogador não entrou

- **WHEN** a partida é de um jogo em que o jogador não foi escalado
- **THEN** a narração acontece sem nenhum lance atribuído a ele

### Requirement: A narração não é obrigatória

Abrir a narração SHALL ser uma escolha do jogador. Avançar a temporada SHALL NOT exigir passar por nenhuma partida de seleção.

#### Scenario: Avançar sem narrar

- **WHEN** o jogador avança uma temporada em que houve dez jogos de seleção
- **THEN** nenhuma tela de narração é imposta, e o fluxo continua o de hoje

## MODIFIED Requirements

### Requirement: O ano da seleção segue um ciclo de quatro anos

O calendário da seleção SHALL seguir o ciclo real: Copa do Mundo no ano dela, torneio continental da confederação do país no meio do ciclo, e Eliminatórias mais amistosos nos demais anos. Toda temporada em que o jogador é convocado SHALL ter ao menos um jogo. Os torneios SHALL ser disputados com fase de grupos seguida de mata-mata.

#### Scenario: Ano de Copa do Mundo

- **WHEN** a temporada é ano de Copa do Mundo e a seleção se classificou
- **THEN** o calendário tem amistosos de preparação, as três partidas do grupo e as partidas de mata-mata que a seleção alcançou, cada uma nomeada com a sua fase

#### Scenario: Ano de torneio continental

- **WHEN** a temporada cai no meio do ciclo e o país pertence a uma confederação com torneio mapeado
- **THEN** o calendário tem as partidas desse torneio, nomeadas com o nome dele — Eurocopa, Copa América, Copa Africana, Copa Asiática ou Copa Ouro

#### Scenario: Ano de preparação

- **WHEN** a temporada não é de Copa do Mundo nem de torneio continental
- **THEN** o calendário tem partidas de Eliminatórias e amistosos, cada uma identificada com a sua competição

#### Scenario: Confederação sem torneio disputável

- **WHEN** a confederação do país do jogador não tem seleções suficientes para formar uma chave
- **THEN** o ano do meio do ciclo é disputado como ano de preparação, e nenhuma competição inventada aparece
