/**
 * Perfis de energia por estado.
 *
 * Cada estado da FSM define "quanto músculo" a abelha tem. Nas transições o
 * perfil é interpolado (blend.ts) em vez de trocado de uma vez — é isso que
 * faz a abelha "acelerar" ao entrar em celebrate em vez de teleportar.
 *
 * Unidades: px, px/s, px/s², Hz, 1/s.
 */

import type { BeeState, EnergyProfile } from '../types';

export const PROFILES: Record<BeeState, EnergyProfile> = {
  idle: {
    maxSpeed: 110,
    thrust: 320,
    flapHz: 13,
    noiseAmp: 26,
    buzzAmp: 0.7,
    drag: 2.4,
    arriveRadius: 70,
  },
  followTarget: {
    maxSpeed: 340,
    thrust: 900,
    flapHz: 24,
    noiseAmp: 9,
    buzzAmp: 1.1,
    drag: 3.4,
    arriveRadius: 64,
  },
  loading: {
    maxSpeed: 260,
    thrust: 760,
    flapHz: 30,
    noiseAmp: 5,
    buzzAmp: 1.3,
    drag: 3.0,
    arriveRadius: 34,
  },
  celebrate: {
    maxSpeed: 430,
    thrust: 1500,
    flapHz: 37,
    noiseAmp: 8,
    buzzAmp: 1.6,
    drag: 2.2,
    arriveRadius: 40,
  },
  callHelp: {
    maxSpeed: 220,
    thrust: 620,
    flapHz: 20,
    noiseAmp: 14,
    buzzAmp: 1.0,
    drag: 2.8,
    arriveRadius: 46,
  },
  thinking: {
    maxSpeed: 64,
    thrust: 170,
    flapHz: 9,
    noiseAmp: 34,
    buzzAmp: 0.5,
    drag: 3.6,
    arriveRadius: 90,
  },
  logoMode: {
    maxSpeed: 170,
    thrust: 480,
    flapHz: 16,
    noiseAmp: 6,
    buzzAmp: 0.6,
    drag: 3.2,
    arriveRadius: 22,
  },
  faviconMode: {
    maxSpeed: 0,
    thrust: 60,
    flapHz: 11,
    noiseAmp: 0,
    buzzAmp: 0.4,
    drag: 8,
    arriveRadius: 10,
  },
  guide: {
    maxSpeed: 380,
    thrust: 1150,
    flapHz: 22,
    noiseAmp: 12,
    buzzAmp: 0.9,
    drag: 3.0,
    arriveRadius: 52,
  },
  sleep: {
    maxSpeed: 150,
    thrust: 420,
    flapHz: 8,
    noiseAmp: 3,
    buzzAmp: 0.15,
    drag: 3.6,
    arriveRadius: 16,
  },
};

/**
 * Interpolação linear entre perfis (usada no blend de transição).
 * Chaves numéricas simples — mantida à mão para evitar reflection no hot path.
 */
export function lerpProfile(a: EnergyProfile, b: EnergyProfile, t: number): EnergyProfile {
  const k = (x: number, y: number) => x + (y - x) * t;
  return {
    maxSpeed: k(a.maxSpeed, b.maxSpeed),
    thrust: k(a.thrust, b.thrust),
    flapHz: k(a.flapHz, b.flapHz),
    noiseAmp: k(a.noiseAmp, b.noiseAmp),
    buzzAmp: k(a.buzzAmp, b.buzzAmp),
    drag: k(a.drag, b.drag),
    arriveRadius: k(a.arriveRadius, b.arriveRadius),
  };
}
