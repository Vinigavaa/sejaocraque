import type { DecisionSide, MatchFocus } from './liveFocus'
import { focusWeight } from './liveFocus'
import type { TimingKind } from './liveTiming'
import type { MoraleDelta } from './morale'
import type { NumericAttr, Position } from './types'

/**
 * O catalogo de momentos do modo Jogo a Jogo.
 *
 * Aqui so mora **dado**: qual e o momento, o que da para fazer, o que decide o
 * lance e o que cada saida provoca. Quem sorteia, resolve e aplica e o motor
 * em `liveMatch.ts`. A separacao existe porque estas duas coisas mudam por
 * motivos diferentes: acrescentar um momento novo e trabalho de conteudo, e
 * mudar a formula de acerto e trabalho de balanceamento.
 *
 * Regras que todo momento novo precisa respeitar:
 *
 * - **nenhuma opcao e sempre a certa.** Se uma domina, o momento vira clique.
 * - **o risco aparece no texto.** O jogador escolhe informado, nao no escuro.
 * - **a consequencia e coerente com o lance.** Entrada dura da cartao, nao
 *   proposta de transferencia.
 */

export type LiveEffect = {
  /** Gol do jogador. Conta para ele e para o placar do time. */
  goals?: number
  /** Assistencia do jogador. Conta um gol para o time. */
  assists?: number
  /** Gol do time sem participacao direta do jogador. */
  teamGoals?: number
  /** Gol sofrido — erro do jogador custa caro de proposito. */
  opponentGoals?: number
  /** Ajuste direto na nota da partida. */
  rating?: number
  morale?: MoraleDelta
  card?: 'amarelo' | 'vermelho'
  injury?: boolean
  /** Deixa o campo: lesao, expulsao ou substituicao. */
  off?: boolean
  text: string
}

export type DecisionOption = {
  label: string
  detail: string
  /** Atributo que decide o lance. Null quando so confianca e sorte decidem. */
  attr: NumericAttr | null
  /** Chance base de dar certo, antes de atributo, confianca e adversario. */
  base: number
  success: LiveEffect
  failure: LiveEffect
}

export type DecisionCondition = 'sempre' | 'perdendo' | 'ganhando' | 'empatado'

export type DecisionSpec = {
  id: string
  /** `{jogador}`, `{time}` e `{adversario}` sao trocados na hora de exibir. */
  prompt: string
  /** Vazio = serve para qualquer posicao. */
  positions?: readonly Position[]
  phase: 'inicio' | 'fim' | 'qualquer'
  when?: DecisionCondition
  /**
   * De que lado do campo o momento acontece. E o que o foco tatico enxerga:
   * quem joga em Defesa ve mais `defesa`, quem joga em Ataque ve mais `ataque`.
   *
   * Declarado, e nao derivado dos efeitos como `isProductive`: um lance de
   * marcacao que termina em contra-ataque produz gol, e mesmo assim aconteceu
   * na defesa. Nao existe nos efeitos nada que diga isso.
   */
  side: DecisionSide
  weight: number
  options: DecisionOption[]
}

const ATTACK: readonly Position[] = ['MEI', 'PON', 'SA', 'ATA']
const MIDFIELD: readonly Position[] = ['VOL', 'MC', 'MEI', 'ALA']
const DEFENSE: readonly Position[] = ['ZAG', 'ALA', 'VOL']

export const DECISIONS: readonly DecisionSpec[] = [
  {
    id: 'frente-goleiro',
    side: 'ataque',
    prompt: '{jogador} recebe nas costas da zaga e fica de frente para o goleiro.',
    positions: ATTACK,
    phase: 'qualquer',
    weight: 10,
    options: [
      {
        label: 'Bater cruzado',
        detail: 'O caminho mais curto. Depende só da sua finalização.',
        attr: 'fin',
        base: 0.42,
        success: {
          goals: 1,
          rating: 0.4,
          morale: { confidence: 6, squad: 2 },
          text: 'GOL! {jogador} bate cruzado e o goleiro só olha.',
        },
        failure: {
          rating: -0.2,
          morale: { confidence: -4 },
          text: '{jogador} bate cruzado e a bola passa raspando a trave.',
        },
      },
      {
        label: 'Driblar o goleiro',
        detail: 'Mais difícil, mas quase certo se passar.',
        attr: 'dri',
        base: 0.3,
        success: {
          goals: 1,
          rating: 0.7,
          morale: { confidence: 9, reputation: 0.4 },
          text: 'GOL! {jogador} senta o goleiro e empurra para o gol vazio.',
        },
        failure: {
          rating: -0.4,
          morale: { confidence: -7, coach: -3 },
          text: '{jogador} tenta driblar o goleiro e perde a bola. O banco reclama.',
        },
      },
      {
        label: 'Rolar para o companheiro',
        detail: 'Menos glória, mais chance de sair gol.',
        attr: 'pas',
        base: 0.52,
        success: {
          assists: 1,
          rating: 0.3,
          morale: { confidence: 3, squad: 6 },
          text: '{jogador} rola para o companheiro empurrar. Assistência.',
        },
        failure: {
          rating: -0.2,
          morale: { squad: -2 },
          text: '{jogador} rola no meio da área e ninguém chega.',
        },
      },
    ],
  },
  {
    id: 'chute-de-fora',
    side: 'ataque',
    prompt: 'A defesa do {adversario} fecha o meio e a bola sobra para {jogador} na entrada da área.',
    phase: 'qualquer',
    weight: 9,
    options: [
      {
        label: 'Arriscar de fora',
        detail: 'Difícil, mas é o tipo de gol que vira notícia.',
        attr: 'fin',
        base: 0.2,
        success: {
          goals: 1,
          rating: 0.8,
          morale: { confidence: 10, reputation: 0.8 },
          text: 'GOL! {jogador} pega de primeira de fora da área e acerta o ângulo.',
        },
        failure: {
          rating: -0.15,
          morale: { confidence: -2 },
          text: '{jogador} arrisca de longe e manda por cima.',
        },
      },
      {
        label: 'Tocar e continuar',
        detail: 'Mantém a posse e o time no campo de ataque.',
        attr: 'pas',
        base: 0.72,
        success: {
          rating: 0.15,
          morale: { squad: 3 },
          text: '{jogador} toca curto e a jogada segue viva.',
        },
        failure: {
          rating: -0.25,
          morale: { squad: -3 },
          text: '{jogador} demora na saída de bola e o {adversario} recupera.',
        },
      },
    ],
  },
  {
    id: 'penalti',
    side: 'ataque',
    prompt: 'Pênalti para o {time}. O árbitro aponta a marca e o estádio se cala.',
    phase: 'qualquer',
    weight: 5,
    options: [
      {
        label: 'Pegar a bola e bater',
        detail: 'Cobrar é assumir o peso — dos dois lados.',
        attr: 'fin',
        base: 0.68,
        success: {
          goals: 1,
          rating: 0.6,
          morale: { confidence: 8, coach: 4, reputation: 0.6 },
          text: 'GOL! {jogador} desloca o goleiro e converte.',
        },
        failure: {
          rating: -1,
          morale: { confidence: -14, coach: -5, squad: -4 },
          text: '{jogador} perde o pênalti. O estádio inteiro viu.',
        },
      },
      {
        label: 'Deixar para o batedor oficial',
        detail: 'Sem risco pessoal. Sem crédito também.',
        attr: null,
        base: 0.75,
        success: {
          teamGoals: 1,
          morale: { squad: 2 },
          text: 'O batedor oficial converte. {jogador} comemora de longe.',
        },
        failure: {
          morale: { confidence: -2 },
          text: 'O batedor oficial para no goleiro.',
        },
      },
    ],
  },
  {
    id: 'entrada-dura',
    side: 'defesa',
    prompt: 'O camisa 10 do {adversario} passa por {jogador} e o contra-ataque está armado.',
    positions: DEFENSE,
    phase: 'qualquer',
    weight: 9,
    options: [
      {
        label: 'Cortar com falta',
        detail: 'Mata o lance. Cartão quase certo.',
        attr: 'fis',
        base: 0.8,
        success: {
          rating: 0.1,
          card: 'amarelo',
          morale: { coach: 3, squad: 4 },
          text: '{jogador} derruba o contra-ataque e leva o amarelo. O banco aprova.',
        },
        failure: {
          card: 'vermelho',
          off: true,
          rating: -1.5,
          morale: { confidence: -12, coach: -12, squad: -8 },
          text: '{jogador} chega atrasado e o árbitro mostra o vermelho direto.',
        },
      },
      {
        label: 'Recompor correndo',
        detail: 'Limpo, se o fôlego der.',
        attr: 'vel',
        base: 0.5,
        success: {
          rating: 0.4,
          morale: { confidence: 5, coach: 4 },
          text: '{jogador} volta correndo e desarma na entrada da área.',
        },
        failure: {
          opponentGoals: 1,
          rating: -0.7,
          morale: { confidence: -8, coach: -6 },
          text: 'O contra-ataque termina em gol do {adversario}. {jogador} não chegou.',
        },
      },
    ],
  },
  {
    id: 'bola-dividida',
    side: 'neutro',
    prompt: 'Bola dividida no meio-campo, e o volante do {adversario} vem com tudo.',
    positions: MIDFIELD,
    phase: 'qualquer',
    weight: 8,
    options: [
      {
        label: 'Ir com força',
        detail: 'Ganhar a dividida muda o ânimo do time.',
        attr: 'fis',
        base: 0.55,
        success: {
          rating: 0.35,
          morale: { confidence: 5, squad: 5 },
          text: '{jogador} ganha a dividida e a torcida levanta.',
        },
        // Sem `injury` de propósito. Este é um dos momentos mais frequentes da
        // partida, e tirar o jogador de campo em metade das vezes que ele
        // aparecia enchia a temporada de lesões — o risco de lesão fica
        // concentrado no momento que existe para isso, `lesao-sentida`.
        failure: {
          rating: -0.3,
          morale: { confidence: -5 },
          text: '{jogador} leva a pior na dividida e fica no chão reclamando.',
        },
      },
      {
        label: 'Tirar o corpo',
        detail: 'Sem risco físico, mas o time perde a bola.',
        attr: null,
        base: 0.6,
        success: {
          rating: -0.05,
          text: '{jogador} tira o corpo e a bola sai pela lateral.',
        },
        failure: {
          rating: -0.4,
          morale: { squad: -5, coach: -4 },
          text: '{jogador} evita o choque e o {adversario} sai jogando. O banco não gostou.',
        },
      },
    ],
  },
  {
    id: 'lesao-sentida',
    side: 'neutro',
    prompt: '{jogador} sente a parte de trás da coxa depois de um pique. O médico pergunta se dá para seguir.',
    phase: 'fim',
    weight: 5,
    options: [
      {
        label: 'Continuar em campo',
        detail: 'O time precisa. O corpo talvez não aguente.',
        attr: 'fis',
        base: 0.45,
        success: {
          rating: 0.3,
          morale: { coach: 6, squad: 6, confidence: 4 },
          text: '{jogador} segue em campo e aguenta até o fim. O vestiário viu.',
        },
        failure: {
          injury: true,
          off: true,
          rating: -0.3,
          morale: { confidence: -8 },
          text: '{jogador} força, sente de novo e sai carregado.',
        },
      },
      {
        label: 'Pedir substituição',
        detail: 'Preserva o corpo. O treinador anota.',
        attr: null,
        base: 1,
        success: {
          off: true,
          morale: { coach: -4 },
          text: '{jogador} pede para sair. O treinador acena, sem entusiasmo.',
        },
        failure: { text: '' },
      },
    ],
  },
  {
    id: 'ordem-do-treinador',
    side: 'neutro',
    prompt: 'O treinador chama {jogador} na beira do campo: é para recuar e segurar o resultado.',
    phase: 'fim',
    when: 'ganhando',
    weight: 7,
    options: [
      {
        label: 'Obedecer',
        detail: 'Some do ataque, ganha o treinador.',
        attr: null,
        base: 0.8,
        success: {
          rating: 0.1,
          morale: { coach: 8 },
          text: '{jogador} recua, marca e o resultado fica de pé.',
        },
        failure: {
          rating: -0.2,
          morale: { coach: 2 },
          text: '{jogador} recua, mas o {adversario} pressiona até o fim.',
        },
      },
      {
        label: 'Continuar atacando',
        detail: 'Pode matar o jogo. Pode custar caro.',
        attr: 'dri',
        base: 0.38,
        success: {
          goals: 1,
          rating: 0.6,
          morale: { confidence: 8, coach: -2, reputation: 0.5 },
          text: 'GOL! {jogador} ignora a ordem, ataca e mata o jogo.',
        },
        failure: {
          opponentGoals: 1,
          rating: -0.8,
          morale: { coach: -12, squad: -6, confidence: -6 },
          text: '{jogador} insiste no ataque, perde a bola e o {adversario} descontou.',
        },
      },
    ],
  },
  {
    id: 'pressao-da-torcida',
    side: 'neutro',
    prompt: 'A torcida do {time} vaia depois de mais um passe errado. A bola vem para {jogador} outra vez.',
    phase: 'qualquer',
    weight: 7,
    options: [
      {
        label: 'Pedir a bola e encarar',
        detail: 'Assumir o jogo quando ninguém quer.',
        attr: 'dri',
        base: 0.4,
        success: {
          rating: 0.5,
          morale: { confidence: 10, squad: 4, reputation: 0.4 },
          text: '{jogador} encara a marcação, arranca aplauso e vira a vaia.',
        },
        failure: {
          rating: -0.4,
          morale: { confidence: -9 },
          text: '{jogador} tenta resolver sozinho, perde a bola, e a vaia aumenta.',
        },
      },
      {
        label: 'Jogar simples',
        detail: 'Passe curto até a vaia passar.',
        attr: 'pas',
        base: 0.72,
        success: {
          rating: 0.1,
          morale: { confidence: 2 },
          text: '{jogador} joga simples e o time recompõe.',
        },
        failure: {
          rating: -0.25,
          morale: { confidence: -5 },
          text: '{jogador} erra até o passe curto. O estádio percebe.',
        },
      },
    ],
  },
  {
    id: 'ultimo-lance',
    side: 'ataque',
    prompt: 'Último minuto, {time} precisa do gol. Escanteio na área.',
    phase: 'fim',
    when: 'perdendo',
    weight: 9,
    options: [
      {
        label: 'Subir para cabecear',
        detail: 'A bola vai para a área. Você também.',
        attr: 'fis',
        base: 0.3,
        success: {
          goals: 1,
          rating: 0.9,
          morale: { confidence: 12, squad: 8, reputation: 1 },
          text: 'GOL! {jogador} sobe mais alto que todo mundo no último lance.',
        },
        failure: {
          rating: -0.15,
          morale: { confidence: -3 },
          text: '{jogador} sobe, cabeceia e a bola sai por cima. Acabou.',
        },
      },
      {
        label: 'Ficar na sobra',
        detail: 'Chute de fora se a bola voltar.',
        attr: 'fin',
        base: 0.24,
        success: {
          goals: 1,
          rating: 0.9,
          morale: { confidence: 12, reputation: 1 },
          text: 'GOL! A bola sobra e {jogador} acerta um chutaço no último lance.',
        },
        failure: {
          rating: -0.1,
          text: 'A sobra vem, {jogador} chuta e a zaga bloqueia.',
        },
      },
    ],
  },
  {
    id: 'falta-perigosa',
    side: 'ataque',
    prompt: 'Falta na entrada da área do {adversario}. {jogador} olha para a barreira.',
    phase: 'qualquer',
    weight: 6,
    options: [
      {
        label: 'Cobrar direto',
        detail: 'Gol de falta é currículo.',
        attr: 'fin',
        base: 0.18,
        success: {
          goals: 1,
          rating: 0.9,
          morale: { confidence: 10, reputation: 1.2 },
          text: 'GOL! {jogador} cobra por cima da barreira e no ângulo.',
        },
        failure: {
          rating: -0.1,
          morale: { confidence: -2 },
          text: '{jogador} cobra na barreira.',
        },
      },
      {
        label: 'Levantar na área',
        detail: 'Chance de assistência, sem holofote.',
        attr: 'pas',
        base: 0.32,
        success: {
          assists: 1,
          rating: 0.5,
          morale: { squad: 6, confidence: 4 },
          text: '{jogador} levanta na medida e o zagueiro cabeceia para o gol. Assistência.',
        },
        failure: {
          rating: -0.1,
          text: '{jogador} levanta na área e o goleiro sai bem.',
        },
      },
    ],
  },
  {
    id: 'discussao-companheiro',
    side: 'neutro',
    prompt: 'O camisa 9 do {time} reclama alto que {jogador} não passou a bola.',
    phase: 'qualquer',
    weight: 6,
    options: [
      {
        label: 'Responder na mesma moeda',
        detail: 'Impõe respeito ou racha o vestiário.',
        attr: null,
        base: 0.35,
        success: {
          rating: 0.1,
          morale: { squad: 4, confidence: 5 },
          text: '{jogador} responde, os dois se resolvem em campo e o time acorda.',
        },
        failure: {
          rating: -0.3,
          morale: { squad: -10, coach: -5 },
          text: 'A discussão sobe de tom e o treinador precisa separar os dois.',
        },
      },
      {
        label: 'Engolir e procurá-lo na próxima',
        detail: 'Custa orgulho, ganha vestiário.',
        attr: 'pas',
        base: 0.6,
        success: {
          assists: 1,
          rating: 0.4,
          morale: { squad: 9 },
          text: '{jogador} procura o camisa 9 na jogada seguinte e sai o gol. Assistência.',
        },
        failure: {
          morale: { squad: 2, confidence: -3 },
          text: '{jogador} engole a reclamação e joga mais apagado.',
        },
      },
    ],
  },
  {
    id: 'saida-de-bola',
    side: 'defesa',
    prompt: 'O {adversario} pressiona a saída de bola e {jogador} recebe de costas, marcado.',
    positions: DEFENSE,
    phase: 'inicio',
    weight: 7,
    options: [
      {
        label: 'Sair jogando curto',
        detail: 'O jeito certo. Se der errado, é gol.',
        attr: 'pas',
        base: 0.55,
        success: {
          rating: 0.3,
          morale: { coach: 5, confidence: 4 },
          text: '{jogador} sai jogando sob pressão e quebra a linha de marcação.',
        },
        failure: {
          opponentGoals: 1,
          rating: -0.9,
          morale: { confidence: -12, coach: -8 },
          text: '{jogador} erra a saída de bola e o {adversario} não perdoa.',
        },
      },
      {
        label: 'Mandar para a frente',
        detail: 'Seguro e feio.',
        attr: null,
        base: 0.85,
        success: {
          rating: -0.05,
          text: '{jogador} manda a bola para a frente e alivia a pressão.',
        },
        failure: {
          rating: -0.2,
          morale: { coach: -3 },
          text: '{jogador} chuta para frente e devolve a posse de graça.',
        },
      },
    ],
  },
  {
    id: 'contra-ataque',
    side: 'ataque',
    prompt: '{jogador} pega a bola no meio com espaço e dois companheiros correndo.',
    phase: 'qualquer',
    weight: 8,
    options: [
      {
        label: 'Conduzir e finalizar',
        detail: 'O gol é seu se der certo.',
        attr: 'vel',
        base: 0.33,
        success: {
          goals: 1,
          rating: 0.7,
          morale: { confidence: 9, reputation: 0.6, squad: -1 },
          text: 'GOL! {jogador} conduz do meio-campo e finaliza sozinho.',
        },
        failure: {
          rating: -0.35,
          morale: { squad: -5, confidence: -5 },
          text: '{jogador} segura demais e o contra-ataque morre. Os companheiros abrem os braços.',
        },
      },
      {
        label: 'Lançar quem está livre',
        detail: 'Assistência limpa, se o passe sair.',
        attr: 'pas',
        base: 0.5,
        success: {
          assists: 1,
          rating: 0.5,
          morale: { squad: 8, confidence: 5 },
          text: '{jogador} lança na medida e o companheiro conclui. Assistência.',
        },
        failure: {
          rating: -0.25,
          text: '{jogador} lança forte demais e o goleiro sai para abafar.',
        },
      },
    ],
  },
  {
    id: 'provocacao',
    side: 'neutro',
    prompt: 'O zagueiro do {adversario} provoca {jogador} depois de um lance dividido.',
    phase: 'qualquer',
    weight: 5,
    options: [
      {
        label: 'Responder no jogo',
        detail: 'A resposta certa costuma ser com a bola.',
        attr: 'dri',
        base: 0.45,
        success: {
          rating: 0.45,
          morale: { confidence: 8, reputation: 0.5 },
          text: '{jogador} dá um drible humilhante no mesmo zagueiro. Resposta dada.',
        },
        failure: {
          rating: -0.25,
          morale: { confidence: -5 },
          text: '{jogador} tenta responder no drible e é desarmado de novo.',
        },
      },
      {
        label: 'Peitar na hora',
        detail: 'O árbitro está olhando.',
        attr: null,
        base: 0.3,
        success: {
          rating: 0.1,
          morale: { squad: 5, confidence: 3 },
          text: '{jogador} peita o zagueiro e o time inteiro chega junto.',
        },
        failure: {
          card: 'amarelo',
          rating: -0.4,
          morale: { coach: -5 },
          text: '{jogador} peita, o árbitro chega e mostra o amarelo.',
        },
      },
    ],
  },
  {
    id: 'substituicao-cedo',
    side: 'neutro',
    prompt: 'O quarto árbitro levanta a placa: é o número de {jogador}, e ainda falta meia hora.',
    phase: 'fim',
    when: 'perdendo',
    weight: 4,
    options: [
      {
        label: 'Sair aplaudindo o time',
        detail: 'Profissional. O treinador registra.',
        attr: null,
        base: 1,
        success: {
          off: true,
          morale: { coach: 6, squad: 3, confidence: -3 },
          text: '{jogador} sai batendo palma para a torcida. Nada a explicar depois.',
        },
        failure: { text: '' },
      },
      {
        label: 'Sair reclamando',
        detail: 'Honesto e caro.',
        attr: null,
        base: 1,
        success: {
          off: true,
          rating: -0.2,
          morale: { coach: -14, confidence: 2 },
          text: '{jogador} sai reclamando e chuta a garrafa perto do banco. Vai dar assunto.',
        },
        failure: { text: '' },
      },
    ],
  },
  /* ---------------------------------------------------------------------
   * Momentos defensivos sem restricao de posicao.
   *
   * Existem porque o foco em Defesa precisa ter o que oferecer a **qualquer**
   * jogador: os dois momentos defensivos anteriores sao de zagueiro, e um
   * atacante que escolhesse Defesa perdia as oportunidades ofensivas sem
   * ganhar nada em troca. Marcar na frente e correr para trás é o que um
   * atacante faz quando o time se fecha.
   * ------------------------------------------------------------------ */
  {
    id: 'pressao-alta',
    side: 'defesa',
    prompt: 'O zagueiro do {adversario} domina de costas para o gol, e {jogador} está perto.',
    phase: 'qualquer',
    weight: 8,
    options: [
      {
        label: 'Pressionar a saída',
        detail: 'Roubar ali é meio gol. Se passar, o time fica exposto.',
        attr: 'vel',
        base: 0.4,
        success: {
          goals: 1,
          rating: 0.6,
          morale: { confidence: 8, coach: 6, reputation: 0.4 },
          text: 'GOL! {jogador} rouba na saída de bola e define na frente do goleiro.',
        },
        failure: {
          rating: -0.35,
          morale: { coach: -4, confidence: -4 },
          text: '{jogador} vai à pressão, é driblado e abre o campo para o {adversario}.',
        },
      },
      {
        label: 'Segurar a linha',
        detail: 'Fecha o passe e espera o time subir junto.',
        attr: 'def',
        base: 0.66,
        success: {
          rating: 0.25,
          morale: { coach: 6, squad: 3 },
          text: '{jogador} fecha o passe, o time sobe junto e o {adversario} volta para trás.',
        },
        failure: {
          rating: -0.15,
          morale: { coach: -2 },
          text: '{jogador} espera, o {adversario} inverte o jogo e a pressão passa.',
        },
      },
    ],
  },
  {
    id: 'cobertura-area',
    side: 'defesa',
    prompt: 'Cruzamento na área do {time} e sobra um atacante sem marcação nas costas de {jogador}.',
    phase: 'qualquer',
    weight: 8,
    options: [
      {
        label: 'Cortar de cabeça',
        detail: 'Subir junto. Se errar o tempo, é gol.',
        attr: 'fis',
        base: 0.55,
        success: {
          rating: 0.4,
          morale: { confidence: 5, coach: 5 },
          text: '{jogador} sobe firme e afasta o perigo da área.',
        },
        failure: {
          opponentGoals: 1,
          rating: -0.7,
          morale: { confidence: -8, coach: -6 },
          text: '{jogador} erra o tempo do salto e o {adversario} cabeceia para o gol.',
        },
      },
      {
        label: 'Marcar o homem',
        detail: 'Deixa a bola para o goleiro e cola no atacante.',
        attr: 'def',
        base: 0.68,
        success: {
          rating: 0.3,
          morale: { coach: 5, squad: 3 },
          text: '{jogador} cola no atacante, o goleiro sai e domina a área.',
        },
        failure: {
          rating: -0.3,
          morale: { confidence: -4 },
          text: '{jogador} fica entre a bola e o homem e não faz nem uma coisa nem outra.',
        },
      },
    ],
  },
  {
    id: 'interceptacao',
    side: 'defesa',
    prompt: 'O meia do {adversario} levanta a cabeça para lançar. {jogador} lê a jogada.',
    phase: 'qualquer',
    weight: 7,
    options: [
      {
        label: 'Antecipar o lançamento',
        detail: 'Interceptar e sair jogando na frente.',
        attr: 'def',
        base: 0.5,
        success: {
          assists: 1,
          rating: 0.55,
          morale: { confidence: 7, coach: 5, squad: 4 },
          text: '{jogador} intercepta, sai jogando na hora certa e sai o gol. Assistência.',
        },
        failure: {
          rating: -0.4,
          morale: { coach: -5 },
          text: '{jogador} antecipa errado e a bola passa por cima dele.',
        },
      },
      {
        label: 'Fechar o corredor',
        detail: 'Nada de espetacular. Também nada de errado.',
        attr: null,
        base: 0.78,
        success: {
          rating: 0.15,
          morale: { coach: 3 },
          text: '{jogador} fecha o corredor e o lançamento sai pela linha de fundo.',
        },
        failure: {
          rating: -0.2,
          text: '{jogador} recua demais e o {adversario} avança sem oposição.',
        },
      },
    ],
  },
]

/**
 * Se o momento pode virar gol ou assistencia.
 *
 * Derivado dos efeitos, e nao declarado num campo proprio: um campo teria que
 * ser mantido em sincronia com as opcoes toda vez que um momento fosse
 * editado, e a primeira divergencia entre os dois quebraria o orcamento de
 * producao da partida sem nenhum sinal.
 */
/**
 * Que barra de timing a opcao abre, ou null quando ela e resolvida no sorteio.
 *
 * Derivado, e nao declarado: a barra existe para a **execucao** de um lance, e
 * um lance so tem execucao quando produz algo e depende de um atributo do
 * jogador. Deixar o batedor oficial cobrar o penalti produz gol e mesmo assim
 * nao abre barra — quem executa nao e ele.
 */
export function timingKindOf(option: DecisionOption): TimingKind | null {
  if (!option.attr) return null
  if (option.success.goals) return 'finalizacao'
  if (option.success.assists || option.success.teamGoals) return 'passe'

  return null
}

export function isProductive(spec: DecisionSpec): boolean {
  return spec.options.some(
    (option) =>
      Boolean(option.success.goals) ||
      Boolean(option.success.assists) ||
      Boolean(option.success.teamGoals),
  )
}

/** Os momentos que cabem naquele instante da partida. */
export function eligibleDecisions(input: {
  position: Position
  minute: number
  teamGoals: number
  opponentGoals: number
  used: readonly string[]
  /** Filtra por momentos que podem (ou nao) virar gol. */
  productive?: boolean
  /** Filtra por lado do campo. Usado quando o foco pede um lance defensivo. */
  side?: DecisionSide
}): DecisionSpec[] {
  const phase = input.minute <= 45 ? 'inicio' : 'fim'
  const condition: DecisionCondition =
    input.teamGoals > input.opponentGoals
      ? 'ganhando'
      : input.teamGoals < input.opponentGoals
        ? 'perdendo'
        : 'empatado'

  return DECISIONS.filter((spec) => {
    // Repetir o mesmo momento na mesma partida quebra a ilusao antes de
    // qualquer outra coisa.
    if (input.used.includes(spec.id)) return false
    if (spec.positions && !spec.positions.includes(input.position)) return false
    if (spec.phase !== 'qualquer' && spec.phase !== phase) return false
    if (spec.when && spec.when !== 'sempre' && spec.when !== condition) return false
    if (input.productive !== undefined && isProductive(spec) !== input.productive) return false
    if (input.side && spec.side !== input.side) return false

    return true
  })
}

/**
 * O peso do momento no sorteio, ja com o foco tatico.
 *
 * Fica aqui, junto do catalogo, porque `weight` e dado do catalogo — o motor
 * so precisa saber o numero final.
 */
export function weightFor(spec: DecisionSpec, focus: MatchFocus): number {
  return spec.weight * focusWeight(focus, spec.side)
}
