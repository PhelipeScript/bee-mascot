/** Operações vetoriais mínimas sobre {x, y} (sem alocação quando possível). */

export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function len(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function norm(a: Vec2): Vec2 {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-6 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

/** Limita a magnitude de `a` a `max` (in-place). */
export function limit(a: Vec2, max: number): Vec2 {
  const l = Math.hypot(a.x, a.y);
  if (l > max && l > 1e-6) {
    const k = max / l;
    a.x *= k;
    a.y *= k;
  }
  return a;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Normaliza ângulo para (-π, π]. */
export function normAngle(a: number): number {
  let r = a;
  while (r <= -Math.PI) r += Math.PI * 2;
  while (r > Math.PI) r -= Math.PI * 2;
  return r;
}

/**
 * Interpolação exponencial independente de frame.
 * `rate` é a velocidade de convergência (1/s): quanto maior, mais rápido.
 * Usada em TODO smoothing de ângulo/velocidade para manter o mesmo "peso"
 * a 30fps e a 144fps.
 */
export function expDamp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
