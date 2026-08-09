## ADDED Requirements

### Requirement: Totais consolidados da temporada
O sistema SHALL calcular, para cada temporada, os totais de jogos, gols e assistências
somando liga, copas disputadas e temporada pela seleção, e SHALL preservar o detalhamento
por competição.

#### Scenario: Jogador com liga, copa e seleção
- **WHEN** o jogador fez 30 jogos na liga, 5 na copa nacional e 8 pela seleção
- **THEN** o total de jogos da temporada é 43

#### Scenario: Jogador não convocado
- **WHEN** o jogador não foi convocado pela seleção na temporada
- **THEN** os totais consideram apenas liga e copas
- **AND** a seleção não aparece no detalhamento

#### Scenario: Detalhamento preservado
- **WHEN** os totais são apresentados
- **THEN** cada competição aparece com seus próprios jogos, gols e assistências

### Requirement: Registro da evolução de atributos
Cada temporada SHALL registrar quais atributos subiram de valor e de quanto, resultado do
foco de treino aplicado ao fim daquela temporada.

#### Scenario: Foco de treino com ganho
- **WHEN** o jogador tem 19 anos e treina Finalização, subindo de 71 para 74
- **THEN** a temporada registra Finalização com valor anterior 71 e novo valor 74

#### Scenario: Foco de treino sem ganho
- **WHEN** o jogador tem 33 anos e o treino não gera ganho
- **THEN** a temporada registra evolução vazia

#### Scenario: Atributo em estrela
- **WHEN** o treino sobe Fintas de 3 para 4 estrelas
- **THEN** a evolução é registrada na escala de estrelas, não na escala numérica

### Requirement: Variação do OVR entre temporadas
O resumo SHALL apresentar o OVR da temporada e a variação em relação à temporada anterior,
indicando queda quando o declínio por idade supera o ganho de treino.

#### Scenario: Jovem em evolução
- **WHEN** o OVR passa de 68 para 73
- **THEN** o resumo mostra a variação como ganho de 5

#### Scenario: Veterano em declínio
- **WHEN** o OVR cai de 84 para 82
- **THEN** o resumo mostra a variação como perda de 2

#### Scenario: Primeira temporada
- **WHEN** é a primeira temporada da carreira
- **THEN** o resumo mostra o OVR sem variação

### Requirement: Campanha em cada competição
O resumo SHALL listar todas as competições disputadas na temporada — liga, copa nacional,
competição continental quando classificado e Copa do Mundo quando houver — com a fase
alcançada, e SHALL destacar as conquistadas.

#### Scenario: Título de liga
- **WHEN** o clube termina em 1º na liga
- **THEN** a liga aparece na campanha marcada como conquistada

#### Scenario: Eliminação em copa
- **WHEN** o clube cai nas quartas de final da copa nacional
- **THEN** a copa nacional aparece com a fase "Quartas de final" e sem marca de título

#### Scenario: Sem competição continental
- **WHEN** o clube não tinha vaga continental na temporada
- **THEN** nenhuma competição continental aparece na campanha

### Requirement: Apresentação do resumo ao fim de cada temporada
Depois de cada temporada jogada, o sistema SHALL apresentar o resumo antes de voltar à tela
de carreira, e o resumo SHALL refletir os números já definitivos da temporada.

#### Scenario: Fim de temporada comum
- **WHEN** o jogador avança uma temporada
- **THEN** o resumo daquela temporada é apresentado
- **AND** ao confirmar, a tela de carreira volta com a temporada seguinte pronta

#### Scenario: Pênalti convertido antes do resumo
- **WHEN** o jogador converte o pênalti do momento da temporada
- **THEN** o gol já está somado nos totais mostrados no resumo

#### Scenario: Pular para o fim
- **WHEN** o jogador escolhe pular para o fim da carreira
- **THEN** nenhum resumo intermediário é apresentado

### Requirement: Aposentadoria no resumo
Quando a temporada apresentada for a última da carreira, o resumo SHALL indicar o
encerramento e levar à tela de fim de carreira em vez de voltar à tela de carreira.

#### Scenario: Última temporada
- **WHEN** o jogador ultrapassa a idade de aposentadoria
- **THEN** o resumo indica que foi a última temporada
- **AND** a confirmação leva à tela de fim de carreira
