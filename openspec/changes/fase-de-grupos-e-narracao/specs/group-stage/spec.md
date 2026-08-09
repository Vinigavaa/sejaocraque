## ADDED Requirements

### Requirement: Torneio disputado em grupos e depois em mata-mata

Um torneio com fase de grupos SHALL dividir os participantes em grupos de quatro, disputar todos contra todos dentro do grupo, e classificar os dois primeiros de cada grupo para um mata-mata de eliminação direta.

#### Scenario: Copa do Mundo

- **WHEN** 32 seleções disputam a Copa do Mundo
- **THEN** são 8 grupos de 4, cada seleção joga 3 partidas de grupo, e os 16 classificados disputam oitavas, quartas, semifinal e final

#### Scenario: Torneio de oito participantes

- **WHEN** 8 seleções disputam a Copa América
- **THEN** são 2 grupos de 4 e os 4 classificados entram direto na semifinal

#### Scenario: Participantes que não completam um grupo

- **WHEN** o número de participantes não é múltiplo de quatro
- **THEN** só os que formam grupos completos disputam, e os demais ficam de fora com caminho vazio

### Requirement: Cada partida de grupo é identificada

Toda partida da fase de grupos SHALL registrar o grupo e a rodada em que aconteceu, e SHALL admitir empate.

#### Scenario: Rodada de grupo

- **WHEN** a seleção joga a segunda partida do grupo C
- **THEN** a partida aparece identificada como `Grupo C · 2ª rodada`

#### Scenario: Empate na fase de grupos

- **WHEN** uma partida de grupo termina empatada
- **THEN** o empate é registrado como tal, sem desempate por pênaltis

### Requirement: A classificação do grupo decide quem avança

A ordem dentro do grupo SHALL ser decidida por pontos, depois por saldo de gols, depois por gols marcados. Quem não avança SHALL ter "Fase de grupos" registrado como a fase alcançada.

#### Scenario: Eliminado no grupo

- **WHEN** a seleção termina em terceiro no grupo
- **THEN** a fase alcançada é "Fase de grupos", e não "Não se classificou"

#### Scenario: Empate em pontos

- **WHEN** duas seleções terminam o grupo com os mesmos pontos
- **THEN** a que tem melhor saldo de gols fica à frente

### Requirement: O mata-mata continua sendo o mesmo

O mata-mata que segue a fase de grupos SHALL usar as mesmas regras da eliminação direta já existente, incluindo o desempate quando a partida termina empatada.

#### Scenario: Final empatada

- **WHEN** a final termina empatada no tempo normal
- **THEN** o desempate decide o campeão e a partida fica marcada como decidida nos pênaltis

#### Scenario: Campanha completa registrada

- **WHEN** a seleção é eliminada nas quartas de final
- **THEN** o caminho dela tem as 3 partidas de grupo mais as das fases de mata-mata que disputou, na ordem
