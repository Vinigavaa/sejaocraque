## Why

A carreira já é simulada inteira, mas o jogador quase não consegue olhar para trás. O passado só aparece em três recortes pobres: a tira de idades na tela de carreira (idade, escudo, nome do clube), o resumo da temporada que acabou, e o "Retrospecto" do fim de carreira — que só existe depois de tudo terminado. Não há como responder "por quais clubes eu passei?", "quantos jogos eu fiz por cada um?" ou "quais títulos eu tenho?" enquanto se joga.

A seleção é ainda mais vaga. Um ano inteiro de seleção hoje é `caps = range(6, 10)`: um número sorteado de "amistosos e eliminatórias" sem adversário, sem placar e sem nome de competição. O jogador vê "Brasil — 8 jogos, 3 gols, Convocado" e não sabe se aquilo foi Eliminatória, amistoso ou Copa América — porque o motor também não sabe. Nos anos ímpares do ciclo a seleção simplesmente não disputa nada.

## What Changes

**Calendário da seleção, jogo a jogo**

- Cada partida de seleção passa a ser simulada individualmente, com adversário, placar, competição e fase — e com a produção do jogador naquele jogo.
- O ano da seleção deixa de ser um número solto e passa a ser um calendário: **Eliminatórias** e **amistosos** nos anos de preparação, o **torneio continental da confederação do país** (Eurocopa, Copa América, Copa Africana, Copa Asiática, Copa Ouro) no meio do ciclo, e a **Copa do Mundo** no ano dela.
- A Copa do Mundo deixa de ser só "chegou nas quartas": vira a lista dos jogos que a seleção fez no caminho, cada um com fase, adversário e placar.
- Convocação passa a ser decidida por partida, não por temporada: quem está no limite da lista aparece em alguns jogos e falha em outros, que é o que acontece de verdade.
- **BREAKING** — `NationalSeason.caps`, `.goals`, `.assists` e `.worldCup` deixam de ser campos armazenados. A lista de partidas vira a fonte única e esses números passam a ser derivados dela. Estado de carreira salvo em versão anterior não é lido (o jogo não persiste carreira hoje, então não há migração a fazer).

**Histórico consultável**

- Nova tela de histórico, acessível **durante** a carreira e não só no fim.
- **Passagens**: cada período em um clube (temporadas consecutivas no mesmo clube viram uma linha só), com período, jogos, gols, assistências e títulos conquistados ali.
- **Sala de troféus**: os títulos agrupados por competição, com os anos em que cada um foi ganho, e a separação entre título de clube e título de seleção.
- **Jogos**: temporada a temporada, competição a competição — liga, copas e seleção — e, na seleção, a lista de partidas com adversário e placar.

## Capabilities

### New Capabilities

- `national-calendar`: como o ano de seleção é montado e simulado — quais competições existem, quando cada uma acontece, como a convocação é decidida por jogo e o que fica registrado de cada partida.
- `career-history`: o que o jogador consegue consultar sobre o próprio passado — passagens por clube, títulos e jogos — e de onde essa consulta é alcançável.

### Modified Capabilities

Nenhuma. Não existe spec publicada em `openspec/specs/`.

## Impact

**Motor**

- `lib/sim/competitions.ts` — `simulateKnockout` passa a registrar o caminho de cada participante (fase, adversário, placar), e não só quantos jogos ele fez; `matchesPlayed` sai, derivado do caminho. Entram as confederações e seus torneios continentais.
- `lib/sim/career.ts` — `playNationalTeam` é reescrito sobre o calendário; `NationalSeason` muda de forma; `decisiveMatch` e `seasonTotals` passam a ler os totais derivados.
- `lib/sim/data/nations.ts` — cada seleção ganha a confederação a que pertence.
- `lib/sim/ladder.ts` — `careerTotals` lê os totais derivados da seleção.
- Novo `lib/sim/history.ts` — agregações puras sobre `CareerState`: passagens por clube e sala de troféus.

**Interface**

- Nova tela `history` em `useGame` e em `app/page.tsx`, com entrada a partir da carreira e do fim de carreira.
- `components/screens/SeasonReview.tsx` passa a mostrar as partidas de seleção do ano.
- `components/screens/Career.tsx` ganha o acesso ao histórico.

**Fora de escopo**

- Jogo a jogo do clube. A liga tem ~38 rodadas por temporada por clube e guardar isso muda o custo de memória da carreira inteira; o pedido é sobre a seleção.
- Elenco de seleção e disputa por posição na convocação.
- Persistência da carreira entre sessões.
