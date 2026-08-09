## ADDED Requirements

### Requirement: Feedback de toque em elemento clicável
Todo elemento clicável da interface — botões, cards de seleção e elementos com
`role="button"` — SHALL responder visualmente ao pressionar, e SHALL voltar ao estado
normal ao soltar.

#### Scenario: Pressionar um botão
- **WHEN** o usuário pressiona um botão
- **THEN** o botão encolhe levemente enquanto está pressionado
- **AND** volta ao tamanho original ao soltar

#### Scenario: Pressionar um card de seleção
- **WHEN** o usuário pressiona um card de atributo, posição ou foco de treino
- **THEN** o card responde com o mesmo feedback dos botões

### Requirement: Transição entre telas
A troca de tela SHALL ser animada com uma entrada curta, e cada tela SHALL animar apenas
uma vez por entrada — reentrar na mesma tela depois de sair anima de novo.

#### Scenario: Avançar do draft para a revelação
- **WHEN** o draft é concluído e a tela de revelação entra
- **THEN** a tela de revelação aparece com uma entrada animada

#### Scenario: Atualização dentro da mesma tela
- **WHEN** o estado muda sem trocar de tela
- **THEN** a tela NÃO reanima

### Requirement: Entrada de overlay
Overlays (pênalti, prêmio, transferência) SHALL entrar com animação própria, distinta da
transição de tela, e o fundo escurecido SHALL aparecer junto.

#### Scenario: Overlay de prêmio abre
- **WHEN** um overlay é enfileirado
- **THEN** o painel entra animado sobre o fundo escurecido

### Requirement: Respeito a movimento reduzido
Quando o sistema operacional indica preferência por movimento reduzido, a interface SHALL
suprimir as animações de transição, entrada e feedback, mantendo todos os estados finais
visíveis e todos os controles funcionais.

#### Scenario: Usuário com movimento reduzido ativado
- **WHEN** `prefers-reduced-motion: reduce` está ativo
- **THEN** nenhuma transição de tela, entrada de overlay ou encolhimento de clique ocorre
- **AND** o conteúdo aparece imediatamente em seu estado final
