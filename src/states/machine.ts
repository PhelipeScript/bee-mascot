/**
 * Máquina de estados (FSM) com blend de perfis.
 *
 * - Transição NUNCA corta a física: velocity/momentum são preservados e o
 *   perfil de energia (velocidade, força, flap) é interpolado em ~280ms com
 *   easing — a abelha "acelera" para o novo estado.
 * - Estados efêmeros (celebrate, callHelp) guardam o estado anterior e
 *   fazem auto-retorno após `duration` (em ms: celebrate 3200, callHelp
 *   7000 por padrão).
 */

import type { BeeState, EnergyProfile, SetStateOptions } from '../types';
import { PROFILES, lerpProfile } from './profiles';
import type { Behavior } from './behaviors';
import type { BeeContext } from './context';

export interface StateMachineDeps {
  behaviors: Record<BeeState, Behavior>;
  /** Força extra sempre aplicada (ex.: startle). Retorna null se inativa. */
  overrideForce?: (ctx: BeeContext, dt: number) => { x: number; y: number } | null;
  onTransition?: (from: BeeState, to: BeeState) => void;
}

/** Estados efêmeros: voltam ao estado anterior após `duration`. */
const EPHEMERAL = new Set<BeeState>(['celebrate', 'callHelp']);

/** Duração padrão (ms) de cada estado efêmero. */
const EPHEMERAL_DURATION: Record<'celebrate' | 'callHelp', number> = {
  celebrate: 3200,
  callHelp: 7000,
};

/** Duração do blend de energia (s). */
const BLEND_TIME = 0.28;

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class StateMachine {
  current: BeeState;
  previous: BeeState | null = null;
  private blendT = 1;
  private from: EnergyProfile;
  private to: EnergyProfile;
  /** Perfil do frame (interpolação viva). */
  profile: EnergyProfile;
  private deps: StateMachineDeps;
  private setStateOptions: SetStateOptions | undefined;
  /** Auto-retorno (celebrate). */
  private revertAt = 0;
  private revertTo: BeeState | null = null;

  constructor(initial: BeeState, deps: StateMachineDeps) {
    this.deps = deps;
    this.current = initial;
    this.from = PROFILES[initial];
    this.to = PROFILES[initial];
    this.profile = { ...PROFILES[initial] };
  }

  setState(ctx: BeeContext, next: BeeState, options?: SetStateOptions): void {
    if (!PROFILES[next]) {
      // Blindagem: estado desconhecido (typo na API) não pode derrubar o loop.
      console.warn(`[bee-mascot] estado desconhecido ignorado: "${next}"`);
      return;
    }
    if (next === this.current && !options?.target && !options?.anchor) return;
    const from = this.current;
    this.previous = from;
    this.current = next;
    this.from = { ...this.profile }; // parte de onde a energia ESTÁ, não de onde era
    this.to = PROFILES[next];
    this.blendT = 0;
    this.setStateOptions = options;

    this.deps.behaviors[from]?.exit?.(ctx);
    this.deps.behaviors[next]?.enter?.(ctx, options);

    // Auto-retorno para estados efêmeros (celebrate/callHelp). `prior`
    // preserva o destino ao reentrar no mesmo estado efêmero (callHelp→callHelp).
    const prior = this.revertTo;
    this.revertTo = null;
    this.revertAt = 0;
    const key = next === 'celebrate' || next === 'callHelp' ? next : null;
    if (key && EPHEMERAL.has(next)) {
      const back = from !== next ? from : prior;
      if (back && back !== next) {
        this.revertTo = back;
        this.revertAt = ctx.time + (options?.duration ?? EPHEMERAL_DURATION[key]) / 1000; // ms
      }
    }

    this.deps.onTransition?.(from, next);
  }

  /** Avança blend, executa o behavior e devolve a força combinada (px/s²). */
  update(ctx: BeeContext, dt: number): { x: number; y: number } {
    // Blend de energia
    if (this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / BLEND_TIME);
      this.profile = lerpProfile(this.from, this.to, easeInOut(this.blendT));
    }

    // Auto-retorno dos estados efêmeros
    if (this.revertTo && ctx.time >= this.revertAt) {
      const back = this.revertTo;
      this.revertTo = null;
      this.setState(ctx, back);
    }

    const behavior = this.deps.behaviors[this.current];
    let force = behavior.update(ctx, dt);

    // Reação efêmera SOMA à força do estado (nunca substitui): a abelha
    // foge/treme mas continua obedecendo ao comportamento atual.
    const override = this.deps.overrideForce?.(ctx, dt);
    if (override) force = { x: force.x + override.x, y: force.y + override.y };

    ctx.state = this.current;
    ctx.previousState = this.previous;
    return force;
  }

  /** As opções passadas na última transição (alvo/anchor/progress). */
  get options(): SetStateOptions | undefined {
    return this.setStateOptions;
  }
}
