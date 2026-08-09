## ADDED Requirements

### Requirement: O histórico é consultável durante a carreira

O jogador SHALL conseguir abrir o histórico completo da carreira a qualquer momento entre temporadas, e não apenas ao se aposentar. Sair do histórico SHALL devolver o jogador à tela de onde ele veio, sem avançar a carreira nem alterar estado nenhum.

#### Scenario: Acesso na tela de carreira

- **WHEN** o jogador está na tela de carreira com ao menos uma temporada jogada
- **THEN** existe um acesso ao histórico, e abri-lo não avança a temporada

#### Scenario: Acesso no fim de carreira

- **WHEN** a carreira terminou
- **THEN** o histórico continua acessível a partir da tela de fim de carreira

#### Scenario: Carreira ainda sem temporadas

- **WHEN** nenhuma temporada foi jogada
- **THEN** o acesso ao histórico não é oferecido

### Requirement: Passagens por clube

O histórico SHALL apresentar as passagens do jogador por clube. Temporadas consecutivas no mesmo clube SHALL formar uma passagem única, com o período, o total de jogos, gols e assistências, e os títulos conquistados naquela passagem.

#### Scenario: Temporadas seguidas no mesmo clube

- **WHEN** o jogador ficou quatro temporadas no mesmo clube
- **THEN** aparece uma passagem só, com o período do primeiro ao último ano e os números somados das quatro

#### Scenario: Retorno a um clube anterior

- **WHEN** o jogador sai de um clube e volta a ele mais tarde
- **THEN** as duas passagens aparecem separadas, cada uma com o seu período

#### Scenario: Passagem em andamento

- **WHEN** o jogador está no clube atual e a carreira não terminou
- **THEN** a passagem atual aparece com o ano de início e sem ano de fim

### Requirement: Sala de troféus

O histórico SHALL apresentar os títulos agrupados por competição, com quantas vezes cada um foi conquistado e em que anos, separando título de clube de título de seleção. Competição nunca vencida SHALL NOT aparecer.

#### Scenario: Título repetido

- **WHEN** o jogador foi campeão da mesma liga em três temporadas
- **THEN** a competição aparece uma vez, com a contagem três e os três anos

#### Scenario: Carreira sem títulos

- **WHEN** o jogador nunca foi campeão de nada
- **THEN** a sala de troféus diz isso explicitamente, em vez de aparecer vazia

### Requirement: Jogos temporada a temporada

O histórico SHALL permitir ver, para cada temporada, o que o jogador disputou competição a competição — liga, copas e seleção — com jogos, gols, assistências e o resultado alcançado em cada uma.

#### Scenario: Temporada com clube e seleção

- **WHEN** o jogador disputou liga, copa nacional e foi convocado no mesmo ano
- **THEN** as três aparecem como linhas separadas da temporada, e o total do ano é a soma delas

#### Scenario: Partidas da seleção

- **WHEN** a temporada teve jogos de seleção
- **THEN** é possível ver cada partida com competição, adversário e placar
