/**
 * Easter egg — sequência secreta de cliques ativa o "modo festa".
 *
 * 5 cliques rápidos no logo (ou no seletor configurado) dentro da janela
 * de tempo → celebração longa + alta intensidade.
 */

import type { BeeMascot } from '../core/bee';

export interface EasterEggOptions {
  /** Alvo dos cliques (seletor ou elemento). Padrão: '[data-bee-logo]'. */
  target?: string | HTMLElement;
  /** Cliques necessários. Padrão: 5. */
  clicks?: number;
  /** Janela de tempo (ms). Padrão: 1600. */
  windowMs?: number;
  /** Duração da festa (ms). Padrão: 7000. */
  durationMs?: number;
  /** Callback quando o egg dispara (para toast/UI da demo). */
  onTrigger?: () => void;
}

export function attachEasterEgg(
  bee: BeeMascot,
  options: EasterEggOptions = {},
): () => void {
  const clicks = options.clicks ?? 5;
  const windowMs = options.windowMs ?? 1600;
  const durationMs = options.durationMs ?? 7000;
  const selector = options.target ?? '[data-bee-logo]';

  let times: number[] = [];
  let triggered = false;

  const handler = (e: Event): void => {
    const el = e.target as Element | null;
    const match =
      typeof selector === 'string' ? el?.closest?.(selector) : el === selector || selector.contains(el as Node);
    if (!match) return;

    const now = performance.now();
    times = times.filter((t) => now - t < windowMs);
    times.push(now);
    if (times.length >= clicks && !triggered) {
      triggered = true;
      times = [];
      bee.celebrate({ duration: durationMs, intensity: 'high' });
      bee.react('success');
      options.onTrigger?.();
      // Volta a armar depois que a festa acaba
      window.setTimeout(() => {
        triggered = false;
      }, durationMs + 400);
    }
  };

  const root = typeof selector === 'string' ? document : (selector as HTMLElement);
  root.addEventListener('click', handler);
  return () => root.removeEventListener('click', handler);
}
