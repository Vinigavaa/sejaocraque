## Context

`simulateKnockout` já produz `KnockoutResult { winnerId, eliminatedIn, paths }`, e todo o resto do motor lê só isso: `matchesIn`, `finalIn`, `reachedIn` e `toRun`. Nada acima dele sabe como a chave foi montada.

`buildTimeline` já existe e já resolve o problema difícil — narrar sem simular. Ela distribui os gols que a partida já tem ao longo dos 90 minutos e decide quais foram do jogador a partir da produção que ele já tem registrada. O que a prende hoje é o tipo do parâmetro: `DecisiveMatch`.

## Goals / Non-Goals

**Goals:**

- Fase de grupos real nos torneios que a têm de verdade.
- Narração disponível para qualquer partida de seleção, sem custo de fluxo.
- Nada acima do `KnockoutResult` precisar mudar.

**Non-Goals:**

- Repescagem, melhores terceiros, confronto direto como critério de desempate.
- Narração dos ~38 jogos de liga por temporada.
- Sorteio com potes e restrição de confederação.

## Decisions

### 1. O formato com grupos devolve o mesmo `KnockoutResult`

`simulateGroupTournament` produz exatamente a estrutura que `simulateKnockout` produz. As partidas de grupo entram em `paths` com a fase escrita por extenso (`Grupo C · 2ª rodada`), e o mata-mata é o `simulateKnockout` de sempre rodando sobre os classificados, com os caminhos concatenados.

O ganho é que `matchesIn`, `finalIn`, `reachedIn`, `toRun` e a tela de partidas continuam funcionando sem uma linha de mudança — a fase de grupos é só mais partida no caminho.

*Alternativa descartada:* um tipo `TournamentResult` próprio, com grupos e mata-mata separados. Obrigaria todos os consumidores a distinguir os dois formatos para responder perguntas ("quantos jogos ele fez") que não dependem disso.

### 2. Grupos de quatro, dois classificados, sempre

Não há tabela de formato por competição. Grupos de quatro com dois classificados cobrem Copa do Mundo (32 → 8 grupos → 16), Eurocopa (16 → 4 grupos → 8), e os torneios de 8 (2 grupos → 4, que entram na semifinal). Todas as contagens de classificados caem em potência de dois, que é o que o mata-mata exige.

Participantes que sobram de um grupo incompleto ficam de fora com caminho vazio — o mesmo tratamento que a chave de potência de dois já dá hoje.

### 3. Empate existe na fase de grupos

`playTie` não serve: ele força um vencedor. A partida de grupo usa `simulateMatch` direto e aceita o empate. `KnockoutMatch.won` continua significando "venceu esta partida", então um empate é `won: false` — quem precisa distinguir empate de derrota compara `forGoals` com `againstGoals`, que estão ali do lado. Um campo a mais para uma distinção que ninguém faz hoje seria peso sem uso.

### 4. Quem tem grupo e quem não tem

| Competição | Formato | Por quê |
| --- | --- | --- |
| Copa do Mundo, Eurocopa, Copa América, Copa Africana, Copa Asiática, Copa Ouro | Grupos → mata-mata | É o formato real |
| Champions League, Libertadores, Concachampions, AFC Champions | Grupos → mata-mata | É o formato real |
| Copa do Brasil, FA Cup, Copa del Rey, e demais copas nacionais | Eliminação direta | É o formato real |

Isso muda o volume das campanhas continentais de clube: a Champions sai de ~4 partidas para até 10. Mais jogos significam mais gols e assistências na temporada, e portanto mais peso na disputa de prêmios individuais. É consequência desejada — a Champions **é** metade da temporada de quem joga nela — mas é uma mudança de balanceamento, não só de fidelidade.

### 5. `buildTimeline` deixa de conhecer `DecisiveMatch`

Entra um tipo estreito com só o que a narração usa:

```ts
export type NarratableMatch = {
  teamName: string
  opponentName: string
  teamGoals: number
  opponentGoals: number
  stage: string | null
  onPenalties: boolean
  won: boolean
  played: boolean
  playerMatches: number
  playerGoals: number
  playerAssists: number
}
```

`DecisiveMatch` é estruturalmente um superconjunto disso, então a chamada de hoje continua igual sem adaptador. Uma `NationalMatch` vira `NarratableMatch` com `playerMatches: 1` e os gols da própria partida — a taxa de atribuição fica exata, e não uma média da competição.

O texto dos pênaltis passa a depender de `stage`: `Final` fala em título, qualquer outra fala em classificação. Hoje ele fala em título mesmo numa semifinal.

### 6. A narração é gerada na hora, e não guardada

A semente é `${seed}:selecao:${label}:${índice da partida}`, então a mesma partida narra igual toda vez sem ocupar memória em `CareerState`. Guardar ~200 listas de eventos por carreira para exibir uma de cada vez seria pagar caro por nada.

### 7. A partida abre na própria lista

Sem tela nova e sem estado de navegação: a linha da partida em `NationalMatches` expande e mostra os lances, como a temporada já faz no histórico. Uma tela dedicada exigiria saber de onde o jogador veio, e a lista já é o contexto certo.

## Risks / Trade-offs

- **Mais partidas por torneio inflam os totais da seleção** → São 3 jogos de grupo contra 1 de primeira fase. O jogador que chegava à final fazia 5 jogos e passa a fazer 7; quem caía de cara fazia 1 e passa a fazer 3. A escada do fim de carreira pesa título, não volume, então o efeito no degrau final é pequeno.
- **A Champions com grupos muda o balanceamento de prêmios** → Descrito acima. Verificável rodando `smoke-season-review.ts` e `play-career.ts` e comparando a ordem de grandeza.
- **`NationalMatches` vira um componente com estado** → Passa a ter `useState` de qual partida está aberta. É o mesmo padrão do `SeasonBlock` no histórico, que já funciona.
