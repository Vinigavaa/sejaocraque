## Why

Hoje o jogador é passageiro da própria carreira. A tabela da liga sai de `club.strength` e
mais nada: um OVR 92 no Botafogo-PB termina a Série C exatamente onde o Botafogo-PB
terminaria sem ele. Títulos, acessos e campanhas de copa são função pura da força do
elenco, e a única coisa que o craque muda são os próprios números.

Isso esvazia a decisão mais interessante do jogo. Escolher um clube pequeno hoje é só
aceitar competição mais fraca — não existe a fantasia de carregar um time nas costas, que é
metade do apelo do gênero.

## What Changes

- **A presença do jogador levanta o clube nas partidas.** Quem rende acima do elenco soma
  força ao time nos jogos que disputa: liga, copa nacional, competição continental e
  seleção.
- **O efeito é moderado e tem teto.** No máximo **+5** de força, proporcional a quanto o
  jogador está acima do elenco e a quantos jogos ele disputou. Um OVR 92 num clube de força
  45 leva o time a ~50 — briga por acesso em vez de meio de tabela, mas não ganha sozinho.
  Um jogador é 1 de 11.
- **Nunca puxa para baixo.** Jogador abaixo do nível do elenco já é punido com menos minutos
  e nota menor; o clube não é punido junto.
- **O efeito é visível.** O jogador vê quanto vale para o clube na tela de carreira e no
  resumo de temporada. Um mecanismo invisível não muda decisão nenhuma.
- **BREAKING**: muda a ordem de consumo do RNG dentro da temporada — a produção do jogador
  passa a ser apurada antes da tabela, porque a tabela agora depende dela. Uma seed antiga
  não reproduz mais a mesma carreira.

Explicitamente fora do escopo: o reforço vale para **simular partidas**, e para nada mais.
Minutos em campo, nota, valor de mercado, propostas de transferência e prêmios continuam
lendo a força real do elenco. Misturar as duas coisas criaria um laço perverso — ser bom
aumentaria a força do clube, e a força maior do clube te mandaria para o banco.

## Capabilities

### New Capabilities
- `player-impact`: quanto a presença do jogador soma à força do clube, em quais competições
  isso vale, o que explicitamente não é afetado, e como o efeito é mostrado.

### Modified Capabilities
<!-- Nenhuma: openspec/specs/ ainda está vazio (o change temporada-viva não foi sincronizado).
     Os requisitos alterados de simulação de liga e mata-mata entram em player-impact. -->

## Impact

Motor (`lib/sim/`):
- `impact.ts` (novo): a fórmula do reforço, num arquivo só, para ser medida por script.
- `season.ts`: `simulateLeague` aceita o reforço do clube do jogador.
- `competitions.ts`: `simulateKnockout` aceita o mesmo reforço.
- `career.ts`: a produção do jogador passa a ser apurada antes da tabela; o reforço entra em
  liga, copas e seleção, e é registrado na temporada.

Interface:
- Tela de carreira e resumo de temporada mostram o reforço.

Sem impacto em backend, dados ou dependências.
