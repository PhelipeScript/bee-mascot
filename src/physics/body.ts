/**
 * Corpo físico da abelha: integração, orientação, ciclo de asas e "buzz".
 *
 * MODELO — Euler semi-implícito:
 *   1. soma forças (behaviors) → clamp na força máxima do perfil (thrust)
 *   2. a = F / massa
 *   3. v += a·dt        (velocidade ANTES da posição = semi-implícito, estável)
 *   4. v *= e^(−drag·dt) (arrasto exponencial, independente de fps)
 *   5. |v| clampado em maxSpeed
 *   6. p += v·dt
 *
 * Por que não easing/tween? Tweens não reagem a forças externas (bordas,
 * cursor, colisões). Com física real a abelha preserva momentum entre
 * estados — a transição de idle→celebrate "arranca" do lugar em vez de
 * teleportar para uma timeline nova.
 */

import type { Vec2 } from './vec2';
import { expDamp, normAngle } from './vec2';
import type { EnergyProfile } from '../types';

/**
 * Direção "para a frente" do sprite no espaço da tela (radianos).
 * Medida no arte: cabeça em ~(45,30), abdômen em ~(95,95) → frente ≈ -127°.
 * Derivada de: atan2(30-95, 45-95).
 */
const SPRITE_FACING = Math.atan2(30 - 95, 45 - 95);

/** Velocidade abaixo da qual a abelha considerada em repouso. */
const REST_SPEED = 6;

export interface Body {
  pos: Vec2;
  vel: Vec2;
  /** Massa — inércia: >1 = arranca devagar, mantém momentum. */
  mass: number;
  /** Rotação suavizada (rad). */
  rot: number;
  /** Espelho horizontal (voando para a esquerda sem ficar de cabeça p/ baixo). */
  flip: 1 | -1;
  /** Altura simulada 0..1 → escala (perspectiva). */
  z: number;
  /** Relógio próprio (s) para ruído/fase. */
  time: number;
  /** Fase acumulada do bater de asas (0..1 = um ciclo completo). */
  flapPhase: number;
  /** Frame visível 0..3. */
  frame: number;
  /** Kick de rotação disparado na troca de frame (decaye exponencial). */
  kick: number;
  /** Seed única por instância → cada abelha tem "personalidade" diferente. */
  seed: number;
  /** Tempo (s) parado consecutivo — para emitir evento 'rest'. */
  restTimer: number;
  /** Aceleração do último passo (para lean/tilt). */
  acc: Vec2;
}

export function createBody(x: number, y: number, seed: number, mass = 1.15): Body {
  return {
    pos: { x, y },
    vel: { x: 0, y: 0 },
    mass,
    rot: 0,
    flip: 1,
    z: 0.5,
    time: seed * 0.37,
    flapPhase: 0,
    frame: 0,
    kick: 0,
    seed,
    restTimer: 0,
    acc: { x: 0, y: 0 },
  };
}

/** Ciclo ping-pong das asas: aberto→fechado→aberto, sem corte seco. */
export const FLAP_CYCLE = [0, 1, 2, 3, 2, 1];

export interface StepResult {
  /** Frame do sprite mudou (dispara buzz + kick). */
  frameChanged: boolean;
  /** A abelha passou a estar em repouso neste frame. */
  justRested: boolean;
  /** Normalizou a velocidade 0..1 (útil p/ partículas e favicon). */
  speedNorm: number;
}

/**
 * Avança a física um passo.
 * @param force    força combinada dos behaviors (px/s², massa 1)
 * @param profile  perfil de energia do estado (interpolar no blend)
 * @param bounds   dims do container p/ hard clamp de posição
 */
export function stepBody(
  body: Body,
  force: Vec2,
  profile: EnergyProfile,
  dt: number,
  bounds: { width: number; height: number },
): StepResult {
  body.time += dt;

  // 1+2. Força → aceleração (clamp de magnitude = "força máxima do músculo")
  let fx = force.x;
  let fy = force.y;
  const fm = Math.hypot(fx, fy);
  if (fm > profile.thrust) {
    const k = profile.thrust / fm;
    fx *= k;
    fy *= k;
  }
  const ax = fx / body.mass;
  const ay = fy / body.mass;
  body.acc.x = ax;
  body.acc.y = ay;

  // 3..5. Integração de velocidade
  body.vel.x += ax * dt;
  body.vel.y += ay * dt;
  const dragK = Math.exp(-profile.drag * dt);
  body.vel.x *= dragK;
  body.vel.y *= dragK;
  const speed = Math.hypot(body.vel.x, body.vel.y);
  if (speed > profile.maxSpeed) {
    const k = profile.maxSpeed / speed;
    body.vel.x *= k;
    body.vel.y *= k;
  }

  // 6. Posição + clamp de bounds (física nunca deixa a abelha sair do host)
  body.pos.x += body.vel.x * dt;
  body.pos.y += body.vel.y * dt;
  body.pos.x = Math.min(Math.max(body.pos.x, 0), bounds.width);
  body.pos.y = Math.min(Math.max(body.pos.y, 0), bounds.height);

  // Altura simulada → escala de perspectiva (devagar, senoide via ruído)
  const zTarget = 0.5 + 0.5 * Math.sin(body.time * 0.7 + body.seed);
  body.z = expDamp(body.z, zTarget, 1.4, dt);

  // Ciclo de asas: Hz do perfil + aceleração com a velocidade real
  const speedNorm = Math.min(1, speed / Math.max(profile.maxSpeed, 1));
  const flapHz = profile.flapHz * (1 + speedNorm * 0.7);
  const prevFrame = body.frame;
  body.flapPhase = (body.flapPhase + flapHz * dt) % 1;
  body.frame = FLAP_CYCLE[Math.floor(body.flapPhase * FLAP_CYCLE.length) % FLAP_CYCLE.length]!;

  let frameChanged = false;
  if (body.frame !== prevFrame) {
    // Troca de frame = "batida": dá um impulso de rotação + vibra as asas.
    body.kick = 0.05 + speedNorm * 0.05;
    frameChanged = true;
  }
  body.kick *= Math.exp(-9 * dt);

  // Orientação: alinhar com a direção do movimento, sem ficar de cabeça
  // para baixo (escolhe entre rot e rot+espelho o de menor |ângulo|).
  let targetRot = 0;
  if (speed > REST_SPEED) {
    const alpha = Math.atan2(body.vel.y, body.vel.x);
    const plain = normAngle(alpha - SPRITE_FACING);
    const flipped = normAngle(Math.PI - SPRITE_FACING - alpha);
    if (Math.abs(flipped) + 0.15 < Math.abs(plain)) {
      body.flip = -1;
      targetRot = flipped;
    } else {
      body.flip = 1;
      targetRot = plain;
    }
    // Lean lateral pela aceleração (banking de curva)
    targetRot += Math.max(-0.3, Math.min(0.3, ax * 0.0009));
  } else {
    // Em repouso, volta para a pose neutra (o que dá a sensação de "pousou")
    body.flip = 1;
  }

  // Buzz: micro-vibração vertical no ritmo das asas (senoide 2× por ciclo)
  // e rotação tremula — pequena, mas é ela que mata o "robótico".
  const buzz = Math.sin(body.flapPhase * Math.PI * 4) * profile.buzzAmp;
  const bodyY = body.pos.y + buzz;

  // Aplica rotação suavizada (independente de fps via expDamp)
  body.rot = expDamp(body.rot, targetRot, 7, dt) + body.kick;
  void bodyY; // buzz é aplicado na camada de render (offset extra)

  // Detecção de repouso (para eventos 'rest' e modo sleep)
  const wasResting = body.restTimer > 0.6;
  if (speed < REST_SPEED) body.restTimer += dt;
  else body.restTimer = 0;
  const justRested = !wasResting && body.restTimer > 0.6;

  return { frameChanged, justRested, speedNorm };
}

/** Deslocamento vertical do buzz (px) — consumido pelo render. */
export function buzzOffset(body: Body, profile: EnergyProfile): number {
  return Math.sin(body.flapPhase * Math.PI * 4) * profile.buzzAmp;
}

/** Escala de perspectiva atual (0.94..1.06). */
export function bodyScale(body: Body): number {
  return 0.94 + body.z * 0.12;
}
