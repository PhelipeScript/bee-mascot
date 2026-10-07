/**
 * Loop de animação compartilhado (requestAnimationFrame + delta time).
 *
 * Um único rAF alimenta todas as instâncias — vários mascotes (logo, favicon,
 * guia…) não disparam loops concorrentes. O dt é clamped em MAX_DT para que
 * aba em background / GC pause não "teleporte" a física; o subscritor decide
 * se pausa (fora de viewport, document.hidden, destroy).
 */

type Subscriber = (dt: number, elapsed: number) => void;

const MAX_DT = 0.05; // 50ms — acima disso integração demais por frame

const subscribers = new Set<Subscriber>();
let rafId = 0;
let last = 0;
let elapsed = 0;

function tick(now: number): void {
  // `now` do rAF é ms; normaliza para segundos.
  const dt = Math.min((now - last) / 1000, MAX_DT);
  last = now;
  elapsed += dt;
  for (const sub of subscribers) sub(dt, elapsed);
  rafId = subscribers.size > 0 ? requestAnimationFrame(tick) : 0;
}

function start(): void {
  if (rafId) return;
  last = performance.now();
  rafId = requestAnimationFrame(tick);
}

/** Adiciona um callback por frame. Retorna a função de remoção. */
export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  start();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}
