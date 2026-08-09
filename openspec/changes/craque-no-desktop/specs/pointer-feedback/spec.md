## ADDED Requirements

### Requirement: Estado de hover em controles

Controles interativos SHALL apresentar retorno visual ao passar o cursor, aplicado apenas em dispositivos com ponteiro fino.

O hover MUST ser aplicado por regra global em `app/globals.css`, cobrindo `button:not(:disabled)` e `[role="button"]`, sem alterar componente por componente.

#### Scenario: Cursor sobre um botão habilitado

- **WHEN** o cursor passa sobre um botão habilitado em um dispositivo com ponteiro fino
- **THEN** o controle muda visivelmente de aparência enquanto o cursor permanece sobre ele

#### Scenario: Controle desabilitado

- **WHEN** o cursor passa sobre um botão desabilitado
- **THEN** nenhuma mudança de aparência ocorre

#### Scenario: Dispositivo de toque

- **WHEN** o jogo é aberto em um dispositivo sem ponteiro fino
- **THEN** nenhum estado de hover é aplicado e o feedback de `:active` atual permanece o único

### Requirement: Foco visível

Controles interativos SHALL exibir um indicador de foco visível ao serem alcançados por teclado.

O indicador MUST usar `:focus-visible` — nunca `:focus` — para não aparecer em cliques de mouse, e MUST usar a cor de acento já definida em `lib/ui/theme.ts`.

#### Scenario: Navegação por Tab

- **WHEN** o jogador percorre a tela com a tecla Tab
- **THEN** o controle focado exibe um contorno visível na cor de acento

#### Scenario: Clique de mouse

- **WHEN** o jogador clica em um controle com o mouse
- **THEN** nenhum contorno de foco é exibido

### Requirement: Respeito a movimento reduzido

Transições associadas a hover e foco SHALL viver dentro de `@media (prefers-reduced-motion: no-preference)`, como o restante do movimento do projeto.

#### Scenario: Movimento reduzido ativo

- **WHEN** o sistema operacional sinaliza preferência por movimento reduzido
- **THEN** os estados de hover e foco continuam visíveis, mas mudam de estado sem transição animada
