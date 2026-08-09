## Context

O motor já simula a carreira inteira e guarda um `SeasonRecord` por temporada. O que falta não é simulação — é **granularidade** num ponto e **leitura** no outro.

No ponto da seleção, `playNationalTeam` resolve o ano com `caps = range(rng, 6, 10)` e uma chamada de `playerOutput` para o lote inteiro. Não existe adversário, placar nem competição, porque não existe partida: existe um número. A Copa do Mundo é a única coisa nomeada, e mesmo ela só guarda a fase alcançada.

No ponto da leitura, tudo já está em `career.seasons` e nada é agregado. `careerTotals` soma a carreira em números soltos e `seasonTotals` monta as linhas de um ano — mas ninguém junta temporadas por clube nem por competição vencida.

Restrições que valem aqui:

- O mata-mata é o mesmo algoritmo para copa nacional, continental e Copa do Mundo (`simulateKnockout`). Qualquer coisa que se ganhe nele vale para as três.
- Toda simulação passa por uma `Rng` derivada da seed da carreira. Nada de `Math.random`.
- O jogo não persiste carreira entre sessões, então mudar a forma de `NationalSeason` não exige migração.
- `lib/sim` não conhece React; a interface só lê.

## Goals / Non-Goals

**Goals:**

- Partida de seleção como unidade de registro, com competição, adversário e placar.
- Um calendário de seleção que faça sentido no ciclo de quatro anos, sem inventar competição para país que não tem.
- Agregações puras sobre a carreira — passagens e troféus — reutilizáveis por qualquer tela.
- Uma tela de histórico alcançável durante a carreira.

**Non-Goals:**

- Jogo a jogo do clube. São ~38 partidas por temporada por clube; guardar isso multiplica o tamanho do estado por uma ordem de grandeza para responder uma pergunta que ninguém fez.
- Elenco de seleção, concorrência por posição, lesão, suspensão.
- Persistência da carreira.

## Decisions

### 1. `simulateKnockout` passa a registrar o caminho, e `matchesPlayed` sai

Hoje o resultado tem `matchesPlayed: Map<id, number>` e `final: KnockoutFinal | null`. Os dois viram um só:

```ts
export type KnockoutMatch = {
  stage: string
  opponentId: string
  forGoals: number
  againstGoals: number
  onPenalties: boolean
  won: boolean
}

export type KnockoutResult = {
  winnerId: string
  eliminatedIn: Map<string, string>
  /** O caminho de cada participante, na ordem das fases. Vazio para quem ficou fora da chave. */
  paths: Map<string, KnockoutMatch[]>
}
```

`matchesPlayed.get(id)` vira `paths.get(id)?.length ?? 0` e `finalScoreFor` vira "a entrada do caminho cuja fase é `Final`". As duas informações antigas eram projeções do caminho — mantê-las junto seria guardar a mesma coisa três vezes.

*Alternativa descartada:* somar `paths` ao lado dos campos atuais. Deixaria `matchesPlayed` como número que pode divergir do caminho, que é exatamente o tipo de duplicação que o CLAUDE.md manda evitar.

### 2. A seleção tem confederação, e a confederação tem torneio

`Nation` ganha `confederation: 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF'`. Um torneio continental de seleção por confederação, com nome e número de vagas.

CONCACAF hoje só tem `US` e `MX` em `NATIONS` — uma "Copa Ouro" de dois participantes é uma final e mais nada. Entram Costa Rica, Panamá, Jamaica e Honduras na tabela de seleções, que são candidatos legítimos e ainda ficam abaixo do corte de 32 vagas da Copa do Mundo. Independente disso, fica a guarda: **confederação com menos de quatro seleções não disputa torneio continental**, e o ano vira ano de preparação.

*Alternativa descartada:* torneio continental único genérico ("Copa Continental"). O jogador pediu para saber qual é o campeonato; um nome genérico não responde isso.

### 3. O ano da seleção sai do índice da temporada

A Copa do Mundo já é `seasonIndex >= 3 && (seasonIndex - 3) % 4 === 0` — anos 3, 7, 11. O continental cai dois anos antes e dois depois: `seasonIndex % 4 === 1` — anos 1, 5, 9. Os índices pares sobram para preparação. Um `switch` sobre isso decide o calendário, sem estado novo na carreira.

### 4. A convocação vira um sorteio por partida

`isCalledUp` continua sendo o portão do ano: quem está mais de 12 pontos abaixo da força da seleção não é convocado e a temporada não tem seleção nenhuma. Passado o portão, cada partida sorteia se o jogador entrou, com probabilidade derivada da mesma folga:

```
share = clamp(0.5 + (overall - nation.strength + CALL_UP_MARGIN) / 24, 0.15, 1)
```

O craque joga tudo; quem passou raspando joga um terço. É o mesmo espírito do `matchesPlayed` do clube, e evita a esquisitice atual de ser "convocado" e sempre jogar exatamente o mesmo lote.

### 5. A forma de `NationalSeason`

```ts
export type NationalMatch = {
  competition: string
  /** Fase, no mata-mata. Null em amistoso e eliminatória. */
  stage: string | null
  opponentName: string
  forGoals: number
  againstGoals: number
  onPenalties: boolean
  /** Se o jogador entrou em campo. Quando falso, gols e assistências são 0. */
  played: boolean
  goals: number
  assists: number
}

export type NationalSeason = {
  nationId: string
  matches: NationalMatch[]
  /** O torneio do ano, quando houve. Null em ano de preparação. */
  tournament: { name: string; reached: string; won: boolean } | null
}

export function nationalTotals(national: NationalSeason): {
  caps: number
  goals: number
  assists: number
}
```

`caps`, `goals`, `assists` e `worldCup` deixam de existir como campos. Quem consome (`seasonTotals`, `careerTotals`, `decisiveMatch`, a badge de campeão na carreira) passa por `nationalTotals` e por `tournament`. O "ganhou a Copa do Mundo" que hoje é `national.worldCup?.won` vira `tournament?.won && tournament.name === 'Copa do Mundo'` — mantido explícito porque `careerTotals` conta Copa do Mundo à parte na escada.

A produção de cada partida sai de `playerOutput` com `matches: 1`, com a seleção entrando como `Club` sintético — exatamente o que o código já faz hoje para o lote. Chamar uma vez por jogo em vez de uma vez por ano muda a variância, não o modelo.

### 6. O jogo decisivo lê a final do calendário

`decisiveMatch` hoje começa por `national?.worldCup?.final`. Passa a procurar, entre `national.matches`, a partida com `stage === 'Final'` do torneio do ano. A precedência (Copa do Mundo antes de continental de clube antes de copa nacional antes da última rodada) só é alterada num ponto: a final do torneio continental **de seleção** também é uma final, e entra com a mesma precedência da Copa do Mundo. Ganhar a Eurocopa é o jogo do ano.

### 7. `lib/sim/history.ts` — agregações puras

```ts
export type ClubSpell = {
  clubId: string
  from: string      // rótulo da primeira temporada
  to: string | null // null enquanto a passagem é a atual
  seasons: number
  matches: number
  goals: number
  assists: number
  titles: number
}

export type Trophy = {
  name: string
  scope: 'clube' | 'selecao'
  count: number
  years: string[]
}

export function clubSpells(state: CareerState): ClubSpell[]
export function trophyCase(state: CareerState): Trophy[]
```

Passagem quebra quando `clubId` muda de uma temporada para a seguinte — voltar a um clube gera duas passagens, que é o que o jogador espera ver. Troféu é agrupado por **nome** da competição, não por id: a copa nacional não tem id por país e o continental de seleção também não; o nome é o que o jogador reconhece.

O arquivo fica em `lib/sim` e não em `lib/game` porque é função pura sobre o estado do motor, sem React — mesma vizinhança de `ladder.ts`.

### 8. A tela de histórico e a volta

Nova tela `history` no `Screen` de `useGame`. Ela não é um passo do fluxo: é um desvio. O `useGame` guarda de onde veio (`historyOrigin`) e `closeHistory` volta para lá. Sem isso, sair do histórico aberto no fim de carreira jogaria o jogador de volta para a tela de carreira, que é uma tela do passado.

O layout usa o `ScreenLayout` já existente: passagens à esquerda, jogos temporada a temporada no centro, sala de troféus à direita. No celular empilha na ordem centro → esquerda → direita, como as outras telas.

`End.tsx` mantém o "Retrospecto" — ele é o resumo emocional do fim, uma lista curta por temporada. O histórico é a consulta. Duplicam a ideia, não o código.

## Risks / Trade-offs

- **A carreira fica maior na memória** — a seleção passa de 5 números por temporada para ~12 objetos de partida. → São ~200 objetos numa carreira de 18 anos. Irrelevante.
- **Mudar `KnockoutResult` toca copa nacional e continental de clube junto** → São dois pontos de chamada em `career.ts` (`toRun` e `playCups`) e ambos usam só `matchesPlayed` e `final`. A conversão é mecânica e o `tsc` aponta cada uma.
- **Variância maior nos números da seleção** — 12 chamadas de Poisson com λ pequeno não dão exatamente a mesma distribuição de uma com λ grande. → A média é a mesma; o desvio maior é justamente o que faz existir o ano em que ele não marcou nenhum.
- **Adicionar seleções muda quem vai à Copa do Mundo** → As quatro entram com força 68–72, abaixo das 32 primeiras; só aparecem se o jitter as favorecer, que é o comportamento desejado para zebra.
- **A tela de histórico pode virar um paredão de números** → Passagens e troféus são as duas leituras que respondem à pergunta; a lista de jogos por temporada fica em seções recolhidas por padrão, expandindo a temporada que o jogador escolher.

## Open Questions

Nenhuma. As decisões acima cobrem o pedido; o que ficou de fora está listado como Non-Goal.
