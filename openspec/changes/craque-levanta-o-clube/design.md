## Context

O motor é puro e determinístico, e a força de um clube é um número só (`Club.strength`,
1–99) que hoje faz três trabalhos diferentes:

1. **Simular partidas** — `seasonForm` em `season.ts` e `playTie` em `competitions.ts`.
2. **Definir quem é titular** — `matchesPlayed(overall, clubStrength, …)`: quem está abaixo
   do elenco fica no banco.
3. **Servir de referência** — nota da temporada (`ratingFor`), suporte à produção
   (`playerOutput`), propostas (`buildOffers`), prêmios (`resolveAwards`).

Esse acúmulo é o que torna a mudança delicada. Somar o reforço direto em `Club.strength`
resolveria o item 1 e quebraria o 2 e o 3.

## Goals / Non-Goals

**Goals:**

- Um craque num clube pequeno rende melhores resultados **ao clube**, não só a si mesmo.
- O efeito é moderado, com teto de +5, e proporcional à participação.
- O efeito é legível na tela — mecanismo invisível não muda decisão.
- O motor continua puro e medível por script.

**Non-Goals:**

- Nada de modelar elenco, companheiros de time ou reforços do clube entre temporadas.
- Nada de reforço negativo.
- O reforço não vira uma segunda moeda de progressão: não entra em valor de mercado, nem em
  prêmio, nem em proposta.

## Decisions

### 1. O reforço é um parâmetro da simulação, não uma mutação de `Club.strength`

`simulateLeague` e `simulateKnockout` passam a aceitar um reforço opcional
`{ clubId, amount }`. Todo o resto do motor continua lendo `Club.strength` cru.

Essa é a decisão central, e é o que evita um laço perverso: se o reforço entrasse no objeto
do clube, `matchesPlayed` veria um elenco mais forte, e **ser bom passaria a te mandar para
o banco**. O mesmo vale para `ratingFor`, onde o reforço anularia exatamente o bônus de
"está acima do elenco" que a nota concede.

*Alternativa descartada:* devolver um clone do clube com a força somada e passar adiante.
Mais curto de escrever, mas espalha a decisão de "quem enxerga o reforço" por toda a
chamada, em vez de concentrá-la numa assinatura.

### 2. A fórmula

```
lift = clamp((overall - clubStrength) * LIFT_WEIGHT, 0, MAX_LIFT) * participation
```

Com `LIFT_WEIGHT = 0.22` e `MAX_LIFT = 5`:

| Situação | Reforço |
| --- | --- |
| OVR 92 no Botafogo-PB (45), temporada inteira | +5 (teto) |
| OVR 85 no Leipzig (83), temporada inteira | +0,4 |
| OVR 85 num clube 74, temporada inteira | +2,4 |
| OVR 78 num clube 74, metade dos jogos | +0,4 |
| OVR 60 num clube 85 | 0 |

O peso 0,22 foi escolhido para que a saturação chegue por volta de 23 pontos de diferença —
que é aproximadamente a distância entre um craque no auge e um elenco duas divisões abaixo.
Acima disso o teto assume, e é ele que garante a promessa de "não ganha sozinho".

Vive em `lib/sim/impact.ts`, sozinho, para o script de medição poder variar os dois números
sem tocar em mais nada.

### 3. A produção do jogador passa a ser apurada antes da tabela

`participation` sai de `stats.matches / totalMatches`, e hoje `simulateLeague` roda antes de
`simulatePlayerSeason`. A inversão é possível porque `simulatePlayerSeason` não depende da
tabela — só de clube, média da liga e total de partidas.

Custo: muda a ordem de consumo do RNG e portanto o significado de uma seed. Sem
persistência, custo zero hoje.

### 4. A seleção usa a mesma função

A seleção já entra no mata-mata como um `Contender` com `strength` própria. O reforço é
calculado contra a força da seleção e a participação do jogador nela. Sem caso especial.

### 5. O reforço fica registrado na temporada

`SeasonRecord` ganha `clubLift: number`. Guardar o valor apurado — em vez de recalculá-lo na
tela — mantém a regra dentro do motor e garante que o número mostrado é o mesmo que a
simulação usou.

Na interface aparece como uma linha discreta ("sua presença vale +5 ao Botafogo-PB"), e some
quando é zero: exibir "+0" só ensina que o mecanismo não funciona.

## Risks / Trade-offs

- **O reforço pode desequilibrar acessos e títulos das ligas de base** → o efeito é aplicado
  a um clube só, e `scripts/smoke-titles.ts` mede a liga sem jogador. Vai um script novo,
  `smoke-impact.ts`, medindo a colocação média de um mesmo clube com e sem craque, para o
  ganho ser um número e não uma impressão.
- **Teto de +5 pode parecer pouco a quem pediu a mudança** → é a leitura escolhida
  explicitamente ("um jogador é 1 de 11"). O teto está isolado numa constante em
  `impact.ts`; se na prática o efeito não for sentido, sobe sem tocar em mais nada.
- **A inversão da ordem pode mascarar uma dependência que eu não vi** → a suíte de scripts
  (`check-data`, `smoke-season`, `smoke-titles`, `smoke-season-review`) roda antes e depois.
- **Risco de o reforço vazar para as regras de elenco numa mudança futura** → mitigado pela
  assinatura: quem quiser aplicar o reforço em outro lugar precisa passá-lo explicitamente,
  e o comentário em `impact.ts` diz por que não deve.

## Migration Plan

Sem migração de dados. Ordem: fórmula isolada e medida por script → assinatura de
`simulateLeague` e `simulateKnockout` → inversão da ordem em `playSeason` → interface. Cada
etapa é verificável sozinha, e a inversão da ordem é a única com efeito sistêmico.

## Open Questions

- O reforço deveria crescer com prêmios individuais já conquistados (um Bola de Ouro pesa
  mais no vestiário)? Fica de fora por ora — é uma segunda regra para o mesmo efeito.
- Quando o jogador é transferido no meio da carreira para um clube muito acima, o reforço
  cai para perto de zero e o clube "perde" o que tinha. Isso é correto, mas pode ser vivido
  como punição. Vale observar no uso antes de tratar.
