/**
 * Behaviors de steering (Reynolds).
 *
 * CONTRATO DE UNIDADES: cada função retorna um vetor de FORÇA candidata em
 * px/s² (para massa 1). O integrador (body.ts) soma as forças com pesos,
 * aplica o clamp do perfil (`thrust` = força máxima) e só então divide pela
 * massa. Assim, nenhum behavior pode "vencer" a inércia da abelha de uma vez.
 */

import type { Vec2 } from './vec2';
import { norm, sub, dist } from './vec2';
import { fbm2 } from './noise';

/** Ganho do Arrive (1/s): converte erro de velocidade em aceleração. */
const ARRIVE_GAIN = 5;

/**
 * Seek/Arrive: desacelera dentro de `slowRadius` (radius de chegada).
 * Seek puro oscila em torno do alvo — o Arrive dá o damp natural da
 * aproximação e evita o overshoot robótico.
 */
export function arrive(
  pos: Vec2,
  vel: Vec2,
  target: Vec2,
  maxSpeed: number,
  slowRadius: number,
): Vec2 {
  const toTarget = sub(target, pos);
  const d = Math.hypot(toTarget.x, toTarget.y);
  if (d < 1e-3) return { x: -vel.x * ARRIVE_GAIN, y: -vel.y * ARRIVE_GAIN };

  const speed = d < slowRadius ? maxSpeed * (d / slowRadius) : maxSpeed;
  const desired = { x: (toTarget.x / d) * speed, y: (toTarget.y / d) * speed };
  return { x: (desired.x - vel.x) * ARRIVE_GAIN, y: (desired.y - vel.y) * ARRIVE_GAIN };
}

/**
 * Wander orgânico: força constante numa direção derivada de ruído fBm 2D.
 * Ruído contíuo no tempo (nunca rand() por frame) = rumo que serpenteia
 * sem saltos; o arrasto + clamp de velocidade transformam isso em curvas
 * suaves e imprevisíveis — o oposto de easing genérico.
 */
export function wander(time: number, seed: number, strength: number): Vec2 {
  const angle = fbm2(time * 0.055, 0.5, seed) * Math.PI;
  return { x: Math.cos(angle) * strength, y: Math.sin(angle) * strength };
}

/**
 * Repulsão suave das bordas: penalidade quadrática ao penetrar a margem +
 * componente proporcional à velocidade apontando para dentro (evita que a
 * abelha "encoste" a alta velocidade antes da penalidade agir).
 */
export function avoidEdges(
  pos: Vec2,
  vel: Vec2,
  width: number,
  height: number,
  margin: number,
  strength = 1,
): Vec2 {
  let fx = 0;
  let fy = 0;

  if (pos.x < margin) fx += (margin - pos.x) ** 2 * 0.5;
  else if (pos.x > width - margin) fx -= (pos.x - (width - margin)) ** 2 * 0.5;
  if (pos.y < margin) fy += (margin - pos.y) ** 2 * 0.5;
  else if (pos.y > height - margin) fy -= (pos.y - (height - margin)) ** 2 * 0.5;

  const edgePush = 0.05;
  if (pos.x < margin * 2 && vel.x < 0) fx -= Math.abs(vel.x) * edgePush;
  if (pos.x > width - margin * 2 && vel.x > 0) fx += Math.abs(vel.x) * edgePush;
  if (pos.y < margin * 2 && vel.y < 0) fy -= Math.abs(vel.y) * edgePush;
  if (pos.y > height - margin * 2 && vel.y > 0) fy += Math.abs(vel.y) * edgePush;

  return { x: fx * strength, y: fy * strength };
}

/**
 * Personal space: empurra a abelha para fora de uma "zona de conforto"
 * ao redor do cursor. Sem isso, em followTarget ela some atrás do mouse.
 */
export function personalSpace(
  pos: Vec2,
  threat: Vec2,
  radius: number,
  strength: number,
): Vec2 {
  const d = dist(pos, threat);
  if (d > radius || d < 1e-3) return { x: 0, y: 0 };
  const away = norm(sub(pos, threat));
  const urgency = 1 - d / radius; // 0 na borda da zona, 1 colado
  return { x: away.x * urgency * strength, y: away.y * urgency * strength };
}

/** Flee completo (usado em reações de "susto"): desacelera e fuje. */
export function flee(pos: Vec2, threat: Vec2, maxSpeed: number): Vec2 {
  const d = dist(pos, threat);
  if (d < 1e-3) return { x: 0, y: -maxSpeed * 6 };
  const away = norm(sub(pos, threat));
  const urgency = Math.max(0, 1 - d / 260);
  return { x: away.x * maxSpeed * urgency * 9, y: away.y * maxSpeed * urgency * 9 };
}
