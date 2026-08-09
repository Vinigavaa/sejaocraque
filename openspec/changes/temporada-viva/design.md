## Context

O motor (`lib/sim/`) é puro, determinístico e não conhece React. A interface
(`components/`, `lib/game/useGame.ts`) consome o motor e não decide nada de simulação. Essa
separação é o que sustenta os cinco scripts de medição em `scripts/`, e ela se mantém aqui.

O ponto de partida relevante:

- `simulateLeague` roda um laço `i × j` sobre os clubes, sem noção de rodada. Guarda só a
  tabela final. Não existe "última rodada".
- `simulateKnockout` devolve `winnerId`, em que fase cada um caiu e quantos jogos fez.
  O placar da final é descartado.
- `SeasonRecord.stats` é **só da liga**. Copas ficam em `cups[]` e seleção em `national`.
  Ninguém soma os três.
- `SeasonRecord.trainingFocus` guarda o atributo treinado, mas não o ganho — o ganho é
  aplicado em `playSeason` depois do registro e some.
- `advance()` em `useGame.ts` faz tudo num passo e enfileira overlays.

## Goals / Non-Goals

**Goals:**

- Cada temporada termina com um fechamento legível, consolidando o que hoje está espalhado
  em três campos diferentes do registro.
- A temporada tem um momento: o jogo que a decide é narrado.
- A interface responde ao toque e a troca de tela tem continuidade.
- O motor continua puro, determinístico e testável por script.

**Non-Goals:**

- A partida narrada **não é jogável**. Nenhuma decisão do usuário altera o placar. Quem
  quiser interferir tem o pênalti, que já existe e já conta gol de verdade.
- Nada de biblioteca de animação. As animações cabem em CSS.
- Nada de guardar o calendário inteiro da liga: só a última rodada sobrevive à simulação.
- Persistência de carreira continua fora do escopo.

## Decisions

### 1. A partida narrada é revelação, não simulação nova

O placar já existe quando a narração começa. A linha do tempo é construída **a partir dele**:
sorteia minutos para os gols já contados e distribui autoria. Assim a narração nunca
contradiz a tabela, o título nem os números da temporada.

*Alternativa descartada:* simular a partida ao vivo e depois costurar o resultado de volta na
tabela. Exigiria reabrir tabela, chave e prêmios já resolvidos — muita superfície para uma
tela de vitrine.

**Consequência importante:** os gols do jogador na partida narrada são um **recorte** dos
gols que ele já tinha na temporada, não um acréscimo. `buildTimeline` recebe quantos gols o
jogador fez na competição e sorteia quantos caem naquele jogo, limitado pelos gols do time
na partida. Nenhum total muda.

### 2. Calendário em rodadas pelo método do círculo

Para existir "última rodada" é preciso ordem. O método do círculo é o padrão: fixa um clube
e rotaciona os demais; com número ímpar entra um clube fantasma que representa a folga.
Turno e returno = duas voltas com mando invertido. Liga acima de 24 clubes segue em turno
único, como hoje.

O conjunto de confrontos é exatamente o mesmo de hoje — muda só a ordem em que são jogados.
Como a ordem de consumo do RNG muda, **seeds antigas não reproduzem mais a mesma carreira**.
Sem partidas salvas, o custo é zero.

`LeagueOutcome` ganha `lastRound: LeagueFixture[]`, só a última rodada. Guardar o calendário
inteiro seria ~380 objetos por liga por temporada para exibir um.

*Alternativa descartada:* sortear uma partida qualquer do clube e chamar de decisiva.
Mais barato, mas mentiria no rótulo.

**Correção durante a implementação:** o método do círculo é determinístico na ordem em que
recebe os clubes, e como essa ordem vem dos dados, o clube enfrentava **o mesmo adversário
na última rodada de todas as temporadas da carreira** — Coventry todo ano em Oxford,
Heidenheim todo ano em Leipzig. A ordem passou a entrar sorteada pelo RNG da temporada.
Nada muda estatisticamente; o calendário é que deixou de ser fixo.

### 3. Precedência do jogo decisivo

Copa do Mundo → continental → copa nacional → última rodada da liga. Justificativa: quanto
maior a competição, mais a final define a temporada. Só entra como "final" quem chegou lá —
`reached === 'Final'` (perdeu) ou `won` (ganhou).

A escolha vive no motor (`decisiveMatch` em `career.ts`) porque depende de dados que só o
motor tem, e o resultado entra em `SeasonRecord.decisive` como descritor já pronto para a
interface: competição, adversário, placar, lado do jogador e se ele atuou.

### 4. Evolução de atributos registrada no momento em que acontece

`playSeason` já calcula `applyTraining` logo depois de montar o registro. Basta comparar
antes/depois e gravar `growth: { attr, from, to }[]` no próprio registro. Nada de recalcular
na interface — a interface não deve saber a regra de treino.

A variação de OVR é derivada na tela comparando `record.overall` com o da temporada
anterior, porque é informação puramente comparativa e o registro já tem os dois lados.

### 5. Totais consolidados como função pura

`seasonTotals(record)` em `career.ts` devolve `{ matches, goals, assists, lines[] }`, onde
cada linha é uma competição com seus próprios números. Uma função, sem estado, usada pelo
resumo e reaproveitável pelo fim de carreira.

### 6. `advance()` vira um fluxo de etapas

Hoje `advance()` é um passo só. Passa a ser:

```
avançar → [jogo decisivo] → [pênalti] → resumo → [prêmio] → [transferência] → carreira
```

O pênalti sobe para **antes** do resumo: ele soma um gol real à temporada, e resolvê-lo
depois faria o resumo mostrar um número que muda em seguida.

Implementação: o resultado da temporada fica guardado em `pendingSeason` e as telas
`'match'` e `'review'` entram no `Screen` existente. Os overlays continuam na fila atual.
`skipToEnd` não passa por nenhuma das duas — segue jogando em laço, como hoje.

### 7. Animação em CSS, com uma exceção

Feedback de clique e transição de tela são regras globais em `globals.css`
(`button, [role="button"] { transition: transform .09s } :active { transform: scale(.97) }`
e keyframes de entrada), envolvidas em `@media (prefers-reduced-motion: no-preference)`.
Zero mudança nos componentes existentes, zero dependência.

A exceção é o relógio da partida, que precisa de JS. Usa `setInterval`, **não**
`requestAnimationFrame`: rAF não dispara em aba que não está compondo quadros e já travou o
contador de OVR em zero uma vez. O relógio também garante o estado final por timeout, para a
tela nunca parar no minuto 61.

## Risks / Trade-offs

- **Reescrever `simulateLeague` pode alterar a distribuição de títulos** → `scripts/smoke-titles.ts`
  já mede isso (PSG 76%, Bayern 66%, La Liga 42/40, 15 campeões no Brasileirão). Rodar antes e
  depois e comparar. Se divergir muito, o calendário introduziu viés e precisa voltar.
- **Seeds antigas deixam de reproduzir a mesma carreira** → aceito: nada é salvo hoje.
  Documentado como BREAKING na proposta.
- **A narração pode parecer jogável e frustrar** → o texto da tela deixa explícito que é a
  reprise do jogo; não há botão que sugira interferência, só "pular".
- **Mais um passo entre uma temporada e outra deixa a carreira lenta** → a narração tem
  botão de pular sempre visível, e o resumo é uma tela só, sem paginação.
- **Atribuir gols do jogador na final é aproximação** → é recorte de números já contados,
  nunca acréscimo; no pior caso a narração dá ao jogador um gol que "estatisticamente" foi em
  outra rodada. O total da temporada permanece correto.
- **Liga ímpar com folga** → o método do círculo com clube fantasma resolve, mas precisa de
  verificação de que todo clube joga o mesmo número de partidas. Vai como checagem em
  `scripts/check-data.ts`.

## Migration Plan

Sem migração de dados — não há persistência. A ordem de implementação isola o risco:
primeiro o motor com scripts de verificação (calendário, final, totais, evolução), depois a
narração, depois o resumo, depois as animações. Cada etapa é reversível por conta própria; a
única com efeito sistêmico é o calendário em rodadas, e ela é a primeira justamente para ser
medida antes de qualquer coisa depender dela.

## Open Questions

- A duração da narração (proposto: ~18s para 90 minutos) precisa de ajuste no uso real.
- A última rodada da liga pode ser um jogo irrelevante (time já rebaixado, meio de tabela).
  Vale mostrá-la mesmo assim ou pular direto ao resumo quando nada está em jogo? Começa
  mostrando sempre; se ficar sem graça, vira regra de "só quando há algo em disputa".
