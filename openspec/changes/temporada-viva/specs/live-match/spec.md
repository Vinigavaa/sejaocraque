## ADDED Requirements

### Requirement: Calendário de liga em rodadas
A liga SHALL organizar seus confrontos em rodadas, cada clube jogando no máximo uma vez por
rodada, e SHALL expor os confrontos da última rodada com seus placares.

#### Scenario: Liga com número par de clubes
- **WHEN** uma liga de 20 clubes é simulada em turno e returno
- **THEN** existem 38 rodadas com 10 jogos cada
- **AND** cada clube joga exatamente 38 partidas

#### Scenario: Liga com número ímpar de clubes
- **WHEN** uma liga com número ímpar de clubes é simulada
- **THEN** em cada rodada um clube folga
- **AND** todos os pares de clubes se enfrentam o mesmo número de vezes

#### Scenario: Tabela preservada
- **WHEN** a liga é simulada com o calendário em rodadas
- **THEN** a tabela final continua somando todos os confrontos do formato
- **AND** campeão, acessos e rebaixamentos seguem as mesmas regras

### Requirement: Placar da final de mata-mata
Toda competição de mata-mata SHALL expor os dois finalistas, o placar da final e se a
decisão saiu nos pênaltis.

#### Scenario: Final decidida no tempo normal
- **WHEN** a final termina 2 a 1
- **THEN** o resultado expõe os dois finalistas, o placar 2-1 e decisão fora dos pênaltis

#### Scenario: Final empatada
- **WHEN** a final termina empatada e o vencedor sai do desempate
- **THEN** o resultado expõe o placar empatado e marca a decisão nos pênaltis

### Requirement: Escolha do jogo decisivo da temporada
O sistema SHALL escolher um único jogo por temporada para ser narrado, com a seguinte
precedência: final da Copa do Mundo, final de competição continental, final de copa
nacional, e por último a partida do clube na última rodada da liga.

#### Scenario: Clube chega à final continental
- **WHEN** o clube alcança a final da competição continental e também a final da copa nacional
- **THEN** o jogo narrado é a final continental

#### Scenario: Copa do Mundo tem precedência
- **WHEN** o jogador disputa a final da Copa do Mundo na mesma temporada de uma final de clube
- **THEN** o jogo narrado é a final da Copa do Mundo

#### Scenario: Temporada sem final
- **WHEN** o clube não alcança nenhuma final
- **THEN** o jogo narrado é a partida do clube na última rodada da liga

#### Scenario: Temporada sem jogo narrável
- **WHEN** não há final nem partida do clube na última rodada
- **THEN** nenhum jogo é narrado e o fluxo segue direto para o resumo da temporada

### Requirement: Linha do tempo determinística
A linha do tempo de lances SHALL ser gerada de forma determinística a partir da seed da
carreira, e SHALL terminar exatamente no placar já decidido pela simulação.

#### Scenario: Mesma seed, mesma narração
- **WHEN** a mesma temporada da mesma seed é simulada duas vezes
- **THEN** a linha do tempo é idêntica nos dois casos

#### Scenario: Placar preservado
- **WHEN** a simulação decidiu 3 a 2
- **THEN** a linha do tempo contém exatamente 3 gols de um lado e 2 do outro
- **AND** o placar ao fim da narração é 3 a 2

#### Scenario: Minutos ordenados
- **WHEN** a linha do tempo é gerada
- **THEN** os lances estão em ordem crescente de minuto, todos entre 1 e 90

### Requirement: Participação do jogador na narração
Quando o jogador atua no jogo narrado, os gols e assistências atribuídos a ele SHALL ser um
recorte dos que já foram contabilizados na temporada — nunca acréscimo — e SHALL respeitar
os gols do próprio time na partida.

#### Scenario: Jogador marca na final
- **WHEN** o time do jogador faz 2 gols e um deles é atribuído a ele
- **THEN** o gol aparece com o nome do jogador
- **AND** o total de gols da temporada não aumenta por causa da narração

#### Scenario: Time não marca
- **WHEN** o time do jogador não faz gols na partida
- **THEN** nenhum gol é atribuído ao jogador

#### Scenario: Jogador fora da partida
- **WHEN** o jogador não atuou na competição do jogo narrado
- **THEN** a narração indica que ele não esteve em campo
- **AND** nenhum lance é atribuído a ele

### Requirement: Reprodução minuto a minuto
A narração SHALL avançar o relógio da partida do minuto 1 ao 90, revelando cada lance no
minuto correspondente e mantendo o placar corrente visível, e SHALL permitir pular para o
resultado a qualquer momento.

#### Scenario: Reprodução até o fim
- **WHEN** a narração roda até o minuto 90
- **THEN** todos os lances foram revelados e o placar final está na tela

#### Scenario: Pular a narração
- **WHEN** o usuário escolhe pular
- **THEN** todos os lances e o placar final aparecem imediatamente

#### Scenario: Movimento reduzido
- **WHEN** `prefers-reduced-motion: reduce` está ativo
- **THEN** a partida é apresentada já concluída, com a lista completa de lances

#### Scenario: Saída da narração
- **WHEN** a narração termina e o usuário confirma
- **THEN** o resumo da temporada é apresentado
