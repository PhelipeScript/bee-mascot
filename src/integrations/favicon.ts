/**
 * Favicon dinâmico — o ícone da aba reflete o estado do mascote.
 *
 * Pipeline: frame SVG (serializado com <style> interno) → blob URL → Image →
 * canvas 64×64 → dataURL PNG → <link rel="icon">.
 *
 * Decisões:
 *  - rasterização é async e cacheada por chave (estado+frame) — nunca duas
 *    decodificações do mesmo frame;
 *  - estados "parados" usam 1 frame estático (favicon muda só na transição);
 *  - loading/celebrate animam a ~6fps, com throttle — favicon animado caro
 *    demais custa CPU em aba em background;
 *  - em quality low ou reduced-motion, fica estático.
 */

import { prepareSprites, frameToStandaloneSvg, DEFAULT_SPRITES } from '../sprites';
import type { BeeState, Quality } from '../types';
import type { BeeMascot } from '../core/bee';

export interface FaviconOptions {
  /** Frames (padrão: sprites do bundle). */
  sprites?: string[];
  /** Tamanho do ícone gerado (px). Padrão: 64. */
  size?: number;
  /** Qualidade global do sistema. */
  quality?: Quality;
  /** Ignora prefers-reduced-motion (força animação). */
  forceAnimation?: boolean;
}

export interface FaviconController {
  /** Para de atualizar e restaura o favicon original. */
  destroy(): void;
  /** Ativa/desativa temporariamente (ex.: aba invisível). */
  setEnabled(enabled: boolean): void;
}

const ANIMATED_STATES: Partial<Record<BeeState, number[]>> = {
  loading: [1, 2, 3, 2],
  celebrate: [0, 1, 2, 3],
  thinking: [0, 1],
  callHelp: [0, 1, 2], // "chamando" a equipe
};

const STATIC_FRAME: Record<BeeState, number> = {
  idle: 0,
  followTarget: 1,
  loading: 2,
  celebrate: 0,
  thinking: 0,
  callHelp: 1,
  logoMode: 1,
  faviconMode: 3,
  guide: 1,
  sleep: 3, // asas fechadas
};

let preparedCache: ReturnType<typeof prepareSprites> | null = null;
function getPrepared(sprites?: string[]) {
  if (!sprites && preparedCache) return preparedCache;
  const p = prepareSprites(sprites ?? DEFAULT_SPRITES);
  if (!sprites) preparedCache = p;
  return p;
}

/** Cria o controlador de favicon e o conecta aos eventos do mascote. */
export function createFavicon(bee: BeeMascot, options: FaviconOptions = {}): FaviconController {
  const size = options.size ?? 64;
  const prepared = getPrepared(options.sprites);
  const cache = new Map<string, string>();
  const inflight = new Map<string, Promise<void>>();

  const link = ensureLink();
  const originalHref = link.getAttribute('href');
  const originalType = link.getAttribute('type');

  let enabled = true;
  let state: BeeState = bee.getState();
  let tick = 0;
  let lastKey = '';
  let timer = 0;
  let destroyed = false;

  const reduced =
    !options.forceAnimation &&
    typeof window !== 'undefined' &&
    'matchMedia' in window &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowQuality = options.quality === 'low';
  const animated = !reduced && !lowQuality;

  function frameFor(state: BeeState): number {
    if (!animated) return STATIC_FRAME[state] ?? 0;
    const seq = ANIMATED_STATES[state];
    if (!seq) return STATIC_FRAME[state] ?? 0;
    return seq[tick % seq.length]!;
  }

  async function rasterize(key: string, frame: number): Promise<void> {
    const svg = frameToStandaloneSvg(prepared, frame);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('falha ao decodificar frame do favicon'));
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const c = canvas.getContext('2d')!;
      c.drawImage(img, 0, 0, size, size);
      cache.set(key, canvas.toDataURL('image/png'));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function update(): Promise<void> {
    if (destroyed || !enabled) return;
    const frame = frameFor(state);
    const key = `${state}:${frame}`;
    if (key === lastKey) return;
    lastKey = key;

    if (!cache.has(key)) {
      let p = inflight.get(key);
      if (!p) {
        p = rasterize(key, frame).finally(() => inflight.delete(key));
        inflight.set(key, p);
      }
      await p.catch(() => undefined);
    }
    const href = cache.get(key);
    if (href && !destroyed && enabled && lastKey === key) {
      link.setAttribute('href', href);
      link.setAttribute('type', 'image/png');
    }
  }

  // Throttle: no máximo ~7 trocas/s mesmo em estados animados
  timer = window.setInterval(() => {
    if (animated && ANIMATED_STATES[state]) tick++;
    void update();
  }, 140);

  const offState = bee.on('statechange', ({ to }) => {
    state = to;
    tick = 0;
    void update();
  });
  void update();

  return {
    setEnabled(v: boolean) {
      enabled = v;
      if (v) void update();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(timer);
      offState();
      if (originalHref !== null) {
        link.setAttribute('href', originalHref);
        if (originalType !== null) link.setAttribute('type', originalType);
      } else {
        link.remove();
      }
    },
  };
}

function ensureLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}
