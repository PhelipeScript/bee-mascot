/**
 * Acessibilidade — utilitários de movimento reduzido e anúncios.
 *
 * O próprio mascote já lê prefers-reduced-motion na criação (fica estático).
 * Estes utilitários ficam à disposição da UI hospedeira para:
 *   - reagir a mudanças ao vivo na preferência;
 *   - anunciar mudanças de estado em regiões aria-live (opcional).
 */

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia(QUERY).matches
    : false;
}

/** Observa mudanças na preferência. Retorna função de unsubscribe. */
export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || !('matchMedia' in window)) return () => {};
  const mq = window.matchMedia(QUERY);
  const handler = (e: MediaQueryListEvent): void => cb(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

/** Região aria-live oculta para anunciar estados do mascote (se desejado). */
export function createAnnouncer(): { announce: (text: string) => void; element: HTMLElement } {
  const el = document.createElement('div');
  el.className = 'bee-sr-only';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);
  return {
    announce(text: string) {
      el.textContent = '';
      // Timeout mínimo para screen readers reconhecerem a mudança
      window.setTimeout(() => {
        el.textContent = text;
      }, 50);
    },
    element: el,
  };
}
