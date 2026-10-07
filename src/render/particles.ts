/**
 * Partículas de pólen/brilho — canvas pequeno, pool fixo, sem alocação
 * em runtime (GC zero no hot path).
 *
 * Qualidade:
 *   low    → desligado (0 partículas)
 *   medium → pool de 90, sem additive blending
 *   high   → pool de 200, additive (glow)
 */

export type ParticleKind = 'pollen' | 'sparkle' | 'trail';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: ParticleKind;
  wobble: number;
}

const POOL_SIZE: Record<string, number> = { low: 0, medium: 90, high: 200 };

export class ParticleSystem {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pool: Particle[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private cursor = 0;
  private theme: 'light' | 'dark' = 'light';

  constructor(container: HTMLElement, quality: 'low' | 'medium' | 'high') {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'bee-layer-particles';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resizePool(quality);
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
  }

  resizePool(quality: 'low' | 'medium' | 'high'): void {
    const n = POOL_SIZE[quality] ?? 90;
    if (n === 0) {
      this.pool = [];
      this.clear();
      return;
    }
    this.pool = Array.from({ length: n }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      kind: 'pollen' as ParticleKind,
      wobble: 0,
    }));
  }

  get enabled(): boolean {
    return this.pool.length > 0;
  }

  resize(width: number, height: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = width;
    this.h = height;
    this.canvas.width = Math.max(1, Math.round(width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(height * this.dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  /** Emite `n` partículas de um tipo na posição (coords do container). */
  emit(kind: ParticleKind, x: number, y: number, n: number): void {
    if (this.pool.length === 0) return;
    for (let i = 0; i < n; i++) {
      const p = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % this.pool.length;
      const a = Math.random() * Math.PI * 2;
      switch (kind) {
        case 'pollen': {
          p.vx = (Math.random() - 0.5) * 26;
          p.vy = -14 - Math.random() * 30; // sobem (pólen leve)
          p.maxLife = 1.1 + Math.random() * 1.1;
          p.size = 1.6 + Math.random() * 2.4;
          break;
        }
        case 'sparkle': {
          const speed = 60 + Math.random() * 150;
          p.vx = Math.cos(a) * speed;
          p.vy = Math.sin(a) * speed;
          p.maxLife = 0.45 + Math.random() * 0.5;
          p.size = 1.2 + Math.random() * 2.2;
          break;
        }
        case 'trail': {
          p.vx = (Math.random() - 0.5) * 14;
          p.vy = (Math.random() - 0.5) * 14 - 6;
          p.maxLife = 0.5 + Math.random() * 0.4;
          p.size = 1.4 + Math.random() * 1.6;
          break;
        }
      }
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.life = 0;
      p.kind = kind;
      p.wobble = Math.random() * Math.PI * 2;
    }
  }

  update(dt: number): void {
    let any = false;
    for (const p of this.pool) {
      if (!p.active) continue;
      any = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.wobble += dt * 6;
      if (p.kind === 'pollen') {
        // Sobe com "crescimento" — leve deriva senoidal como esperado de grão
        p.vy *= Math.exp(-0.4 * dt);
        p.x += (p.vx + Math.sin(p.wobble) * 10) * dt;
        p.y += p.vy * dt;
      } else {
        p.vx *= Math.exp(-3 * dt);
        p.vy *= Math.exp(-3 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    if (!any) this.clear();
    else this.render();
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const additive = this.pool.length > 90;
    if (additive) ctx.globalCompositeOperation = 'lighter';

    const pollenColor = this.theme === 'dark' ? '255,232,140' : '41,196,244';
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = 1 - p.life / p.maxLife;
      const alpha = t * t;
      if (p.kind === 'sparkle') {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      } else if (p.kind === 'trail') {
        ctx.fillStyle = `rgba(156,220,248,${alpha * 0.8})`;
      } else {
        ctx.fillStyle = `rgba(${pollenColor},${alpha * 0.85})`;
      }
      const s = p.size * (0.5 + t * 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private clear(): void {
    ctxClear(this.ctx, this.w, this.h, this.dpr);
  }

  destroy(): void {
    this.canvas.remove();
    this.pool = [];
  }
}

function ctxClear(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
}
