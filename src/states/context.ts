/**
 * Contexto compartilhado entre a máquina de estados e os behaviors.
 * Objeto mutável único — evita alocação por frame no hot path.
 */

import type { Vec2 } from '../physics/vec2';
import type { Body } from '../physics/body';
import type { BeeState, EnergyProfile, Quality, Theme } from '../types';

export interface BeeContext {
  /** Elemento host da abelha (base para converter coords de elementos). */
  hostEl: HTMLElement;
  /** Corpo físico (pos/vel/rotação/flap). */
  body: Body;
  /** Dimensões do container (px). */
  bounds: { width: number; height: number };
  /** Perfil de energia JÁ interpolado do frame atual. */
  profile: EnergyProfile;
  /** Relógio global compartilhado (s). */
  time: number;
  /** Mouse atual em coords do container (null se nunca moveu/saiu). */
  mouse: Vec2 | null;
  /** Alvo explícito (setTarget/setState) — ponto ou elemento. */
  target: Vec2 | HTMLElement | 'mouse' | null;
  /** Elemento âncora (dock/logo) — centro recalculado por frame. */
  anchor: Vec2 | HTMLElement | null;
  /** Alvo do guia de onboarding. */
  guideTarget: HTMLElement | null;
  /** Progresso 0..1 do loading (undefined = indeterminado). */
  progress: number | undefined;
  /** Bias de rotação extra (ex.: "olhar para o lado" no thinking). */
  rotBias: number;
  /** 0..1 — peso de "pousado" (sleep): afeta escala/pose. */
  landT: number;
  /** Se definido, congela o frame do sprite (ex.: asas fechadas ao pousar). */
  freezeFrame: number | null;
  /** Emite partículas (null em quality low). */
  emitParticles:
    | ((kind: 'pollen' | 'sparkle' | 'trail', x: number, y: number, n: number) => void)
    | null;
  /** Preferências. */
  quality: Quality;
  theme: Theme;
  /** Estado atual. */
  state: BeeState;
  /** Estado anterior (auto-retorno de celebrate). */
  previousState: BeeState | null;
  /** Modo festa (easter egg): densidade extra de partículas. */
  party: boolean;
}

/** Centro do elemento em coords locais do container da abelha. */
export function elementCenter(el: HTMLElement, ctx: BeeContext): Vec2 {
  const base = ctx.hostEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
}

/** Resolve qualquer alvo para um ponto em coords do container. */
export function resolvePoint(
  target: Vec2 | HTMLElement | 'mouse' | null,
  ctx: BeeContext,
  fallback: Vec2,
): Vec2 {
  if (!target) return fallback;
  if (target === 'mouse') return ctx.mouse ?? fallback;
  if (typeof (target as HTMLElement).getBoundingClientRect === 'function') {
    return elementCenter(target as HTMLElement, ctx);
  }
  return target as Vec2;
}
