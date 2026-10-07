/**
 * Tipos públicos da API do mascote.
 */

/** Estados da máquina de estados. */
export type BeeState =
  | 'idle'          // voa livremente (wander orgânico)
  | 'followTarget'  // segue mouse/elemento
  | 'loading'       // órbitas de carregamento
  | 'celebrate'     // euforia + partículas (auto-retorno)
  | 'thinking'      // voo lento com pausas
  | 'logoMode'      // órbita miúda ancorada (header/logo)
  | 'faviconMode'   // estática no centro, só asas (gera frames do favicon)
  | 'guide'         // guia de onboarding ao lado de um elemento
  | 'sleep'         // pousa e fecha as asas
  | 'callHelp';     // chama 3–5 auxiliares com papéis distintos (auto-retorno)

export type Quality = 'low' | 'medium' | 'high';
export type Theme = 'light' | 'dark' | 'auto';

/** Ponto em coordenadas locais do container. */
export interface BeePoint {
  x: number;
  y: number;
}

/** Alvo de perseguição: ponto, elemento DOM ou o mouse. */
export type BeeTarget = BeePoint | HTMLElement | 'mouse';

/** Perfil de energia interpolado nas transições de estado. */
export interface EnergyProfile {
  /** Velocidade máxima (px/s). */
  maxSpeed: number;
  /** Aceleração máxima (px/s²). */
  thrust: number;
  /** Frequência de bater de asas (Hz). */
  flapHz: number;
  /** Amplitude do ruído de flutuação (px). */
  noiseAmp: number;
  /** Amplitude da micro-vibração (buzz) (px). */
  buzzAmp: number;
  /** Arrasto exponencial (1/s) — maior = mais "pegajoso". */
  drag: number;
  /** Raio de chegada do Seek/Arrive (px) — evita overshoot. */
  arriveRadius: number;
}

export interface BeeOptions {
  /** Elemento que hospeda a abelha (precisa ter position != static). */
  container: HTMLElement;
  /** Os 4 SVGs de frame. Padrão: sprites embutidas no bundle. */
  sprites?: string[];
  /** Estado inicial. Padrão: 'idle'. */
  initialState?: State;
  /** Qualidade: controla partículas, ruído e favicon animado. */
  quality?: Quality;
  /** Tema das cores derivadas (partículas/highlight). Padrão: 'auto'. */
  theme?: Theme;
  /** Tamanho do sprite em px (largura/altura). Padrão: 96. */
  size?: number;
  /** z-index do layer. Padrão: 10. */
  zIndex?: number;
  /** Se true, cliques na abelha disparam o evento 'click'. Padrão: false. */
  interactive?: boolean;
  /** Reduz/remove animações (prefers-reduced-motion). Padrão: automático. */
  reducedMotion?: boolean;
}

type State = BeeState;

export interface SetStateOptions {
  /** Alvo para estados que precisam de um (followTarget/guide/logoMode). */
  target?: BeeTarget;
  /** Ancoragem (centro da órbita) para loading/logoMode/dock. */
  anchor?: BeePoint | HTMLElement;
  /** Duração da celebração em ms antes de auto-retorno. Padrão: 3200 (callHelp: 7000). */
  duration?: number;
  /** Progresso 0..1 para o modo loading (anula a órbita automática). */
  progress?: number;
  /** Nº de auxiliares no callHelp (3..5). Padrão: conforme qualidade (low 3 · medium 4 · high 5). */
  helpers?: number;
}

export interface CelebrationOptions extends SetStateOptions {
  /** Quantidade de partículas de pólen/brilho. Padrão: 'medium'. */
  intensity?: 'low' | 'medium' | 'high';
}

/** Eventos emitidos pelo mascote. */
export interface BeeEvents {
  /** Mudança de estado (de, para). */
  statechange: { from: BeeState; to: BeeState };
  /** Frame do sprite mudou (índice do frame 0..3). */
  frame: { index: number };
  /** Abelha pousou / parou de se mover significativamente. */
  rest: { x: number; y: number };
  /** Alcançou o alvo atual (arrive). */
  arrived: { x: number; y: number };
  /** Clique na abelha (quando interactive: true). */
  click: { x: number; y: number };
  /** Reação a feedback (success/error/info). */
  react: { kind: 'success' | 'error' | 'info' };
  /** Erro interno (normalmente sprite/asset inválido). */
  error: { error: Error };
}

/** API pública retornada por createBeeMascot. */
export interface BeeMascot {
  /** Troca o estado com blend suave de física/energia. */
  setState(state: BeeState, options?: SetStateOptions): void;
  /** Estado atual. */
  getState(): BeeState;
  /** Define/persegue alvo (ponto, elemento ou 'mouse'). */
  setTarget(target: BeeTarget): void;
  /** Atalho: celebração efêmera com auto-retorno ao estado anterior. */
  celebrate(options?: CelebrationOptions): void;
  /**
   * Atalho: chama uma equipe de 3–5 abelhas auxiliares (batedora,
   * construtora, sentinela, mensageira, analisadora) para ajudar numa tarefa.
   * Efêmero — auto-retorna ao estado anterior após `duration` (padrão 7000ms).
   */
  callHelp(options?: SetStateOptions): void;
  /** Atalho: entra/sai do modo de carregamento. `progress` opcional 0..1. */
  setLoading(progress?: number): void;
  /** Progresso do carregamento (0..1), ou undefined para indeterminado. */
  setProgress(progress: number | undefined): void;
  /** âncora em um elemento (modo companheiro/dock). */
  dock(element: HTMLElement): void;
  /** Sai do dock, voltando ao estado anterior. */
  undock(): void;
  /** Reação imediata a feedback de UI. */
  react(kind: 'success' | 'error' | 'info'): void;
  /** Assina eventos. Retorna função para cancelar. */
  on<K extends keyof BeeEvents>(event: K, cb: (payload: BeeEvents[K]) => void): () => void;
  /** Pausa/respeita a física (ex.: container fora da viewport). */
  pause(): void;
  resume(): void;
  /** Troca qualidade em tempo de execução. */
  setQuality(quality: Quality): void;
  /** Troca tema em tempo de execução. */
  setTheme(theme: Theme): void;
  /** Redimensiona o sprite (px). Aceita qualquer inteiro > 0; presets sugeridos: 48 · 64 · 96 · 128 · 160. */
  setSize(size: number): void;
  /** Remove a abelha do DOM e cancela animações/listeners. */
  destroy(): void;
  /** Elemento raiz do layer (para estilos/posicionamento externos). */
  readonly element: HTMLElement;
  /** Lê a posição atual (centro do sprite) em coords do container. */
  getPosition(): BeePoint;
}
