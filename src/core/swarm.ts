/**
 * Enxame de auxiliares (callHelp) — 3..5 abelhas com papéis distintos.
 *
 * A equipe vive FORA da FSM principal: a abelha-chefe entra em callHelp no
 * seu próprio ciclo de vida, e o enxame é criado/demitido nas transições
 * (onTransition), atualizado no mesmo loop. Cada auxiliar tem corpo físico
 * próprio (createBody/stepBody) e coreografia determinística por papel —
 * sem aleatoriedade por frame.
 *
 * Papéis (ordem de contratação: 3 = núcleo fixo, 4 = +mensageira, 5 = +analisadora):
 *   batedora    — órbita ampla ao redor da tarefa, marcando o caminho com rastro
 *   construtora — leva pólen do depósito até a tarefa (ida e volta)
 *   sentinela   — patrulha o perímetro retangular ao redor da tarefa
 *   mensageira  — corre entre a abelha-chefe e a tarefa
 *   analisadora — radar par acima do alvo, pulsando sparkle
 *
 * Saída: ao sair de callHelp, todos voam para fora dos limites (sem clamp)
 * e explodem em sparkle ao sumir de cena.
 */

import type { BeeContext } from '../states/context';
import { resolvePoint } from '../states/context';
import type { PreparedSprites } from '../sprites';
import type { EnergyProfile, Quality } from '../types';
import type { Vec2 } from '../physics/vec2';
import { expDamp, lerp, normAngle } from '../physics/vec2';
import { arrive, avoidEdges } from '../physics/steering';
import {
  FLAP_CYCLE,
  bodyScale,
  buzzOffset,
  createBody,
  stepBody,
} from '../physics/body';
import type { Body } from '../physics/body';
import { BeeLayer } from '../render/layer';

export type HelperRole =
  | 'batedora'
  | 'construtora'
  | 'sentinela'
  | 'mensageira'
  | 'analisadora';

/** Ordem de contratação por nº de auxiliares. */
const ROLE_ORDER: HelperRole[] = [
  'batedora',
  'construtora',
  'sentinela',
  'mensageira',
  'analisadora',
];

/** Nº de auxiliares padrão por qualidade de render. */
export function helpersForQuality(q: Quality): number {
  return q === 'low' ? 3 : q === 'medium' ? 4 : 5;
}

/** Perfil base dos auxiliares (velocidade varia por papel). */
const BASE_PROFILE: EnergyProfile = {
  maxSpeed: 240,
  thrust: 700,
  flapHz: 24,
  noiseAmp: 0,
  buzzAmp: 0.8,
  drag: 3.0,
  arriveRadius: 30,
};

const ROLE_SPEED: Record<HelperRole, number> = {
  batedora: 230,
  construtora: 210,
  sentinela: 175,
  mensageira: 300,
  analisadora: 200,
};

type HelperPhase = 'enter' | 'work' | 'leave';

interface Helper {
  role: HelperRole;
  layer: BeeLayer;
  body: Body;
  profile: EnergyProfile;
  phase: HelperPhase;
  /** ctx.time em que entrou na fase atual. */
  phaseAt: number;
  /** Timer do próximo emit de partículas (ctx.time). */
  emitAt: number;
  /** Fase angular própria (quebra simetria entre auxiliares). */
  seed: number;
  /** Depósito da construtora (canto do container). */
  depot: Vec2;
}

export interface SwarmOptions {
  /** Contexto da abelha-chefe (alvo da tarefa, bounds, partículas). */
  ctx: BeeContext;
  prepared: PreparedSprites;
  container: HTMLElement;
  /** Tamanho da abelha-chefe (px) — auxiliares usam ~0.62×. */
  size: number;
  zIndex: number;
}

export class Swarm {
  private helpers: Helper[] = [];
  private time = 0;
  private spawned = false;
  private dismissed = false;
  private destroyed = false;
  private opts: SwarmOptions;

  constructor(opts: SwarmOptions) {
    this.opts = opts;
  }

  /** Cria e insere a equipe (3..5 auxiliares entrando pelas bordas). */
  spawn(count: number): void {
    if (this.destroyed || this.spawned) return;
    this.spawned = true;
    const { ctx, prepared, container } = this.opts;
    const n = Math.max(3, Math.min(5, Math.round(count)));
    const helperSize = Math.max(28, Math.round(this.opts.size * 0.62));
    const b = ctx.bounds;

    for (let i = 0; i < n; i++) {
      const role = ROLE_ORDER[i]!;
      // Ponto de entrada na borda (determinístico por índice)
      const side = i % 4;
      const frac = 0.18 + 0.64 * ((i * 0.37 + 0.11) % 1);
      const entry: Vec2 =
        side === 0 ? { x: 0, y: b.height * frac }
        : side === 1 ? { x: b.width, y: b.height * frac }
        : side === 2 ? { x: b.width * frac, y: 0 }
        : { x: b.width * frac, y: b.height };

      const body = createBody(entry.x, entry.y, i * 2.399 + 0.7);
      const layer = new BeeLayer(prepared, container, helperSize, this.opts.zIndex);
      layer.layer.dataset.helper = role;
      // Fade-in: evita "pop" na borda
      layer.layer.style.opacity = '0';
      layer.layer.style.transition = 'opacity 0.35s ease';
      requestAnimationFrame(() => {
        layer.layer.style.opacity = '1';
      });

      const depotSide = i % 4;
      const depot: Vec2 =
        depotSide === 0 ? { x: 36, y: b.height - 36 }
        : depotSide === 1 ? { x: b.width - 36, y: b.height - 36 }
        : depotSide === 2 ? { x: 36, y: 36 }
        : { x: b.width - 36, y: 36 };

      this.helpers.push({
        role,
        layer,
        body,
        profile: { ...BASE_PROFILE, maxSpeed: ROLE_SPEED[role] },
        phase: 'enter',
        phaseAt: this.time,
        emitAt: 0,
        seed: i * 1.7 + 0.4,
        depot,
      });
    }
  }

  /** Dispensa a equipe: todos voam para fora de cena com sparkle. */
  dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    for (const h of this.helpers) {
      if (h.phase === 'leave') continue;
      h.phase = 'leave';
      h.phaseAt = this.time;
      this.emit('sparkle', h.body.pos.x, h.body.pos.y, 8);
    }
  }

  /** true quando a equipe já foi dispensada e todos saíram de cena. */
  get finished(): boolean {
    return this.dismissed && this.helpers.length === 0;
  }

  update(dt: number): void {
    if (this.destroyed || this.helpers.length === 0) return;
    this.time += dt;
    const ctx = this.opts.ctx;
    const task = resolvePoint(ctx.target ?? ctx.anchor, ctx, {
      x: ctx.bounds.width / 2,
      y: ctx.bounds.height / 2,
    });

    for (let i = this.helpers.length - 1; i >= 0; i--) {
      const h = this.helpers[i]!;
      if (h.phase === 'enter' && this.time - h.phaseAt > 1.1) h.phase = 'work';

      const goal = this.goalFor(h, task);

      if (h.phase === 'leave') {
        this.stepLeave(h, goal, dt);
        if (this.outside(h.body.pos)) {
          this.emit('sparkle', clampIn(h.body.pos.x, ctx.bounds.width), clampIn(h.body.pos.y, ctx.bounds.height), 6);
          h.layer.destroy();
          this.helpers.splice(i, 1);
        }
        continue;
      }

      const force = arrive(h.body.pos, h.body.vel, goal, h.profile.maxSpeed, h.profile.arriveRadius);
      const m = Math.min(ctx.bounds.width, ctx.bounds.height) * 0.06 + 20;
      const avoid = avoidEdges(h.body.pos, h.body.vel, ctx.bounds.width, ctx.bounds.height, m, 0.7);
      stepBody(h.body, { x: force.x + avoid.x, y: force.y + avoid.y }, h.profile, dt, ctx.bounds);

      h.layer.setPosition(h.body.pos.x, h.body.pos.y, buzzOffset(h.body, h.profile), 0, 0);
      h.layer.setOrientation(h.body.rot, h.body.flip, bodyScale(h.body), 0);
      h.layer.setFrame(h.body.frame);

      this.emitRole(h, task);
    }
  }

  /** Destroi as camadas (idempotente). */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const h of this.helpers) h.layer.destroy();
    this.helpers = [];
  }

  /** Alvo do auxiliar conforme papel e fase. */
  private goalFor(h: Helper, task: Vec2): Vec2 {
    const ctx = this.opts.ctx;

    if (h.phase === 'enter') return task;

    if (h.phase === 'leave') {
      // Direção para fora: radial a partir do centro do container
      const cx = ctx.bounds.width / 2;
      const cy = ctx.bounds.height / 2;
      let dx = h.body.pos.x - cx;
      let dy = h.body.pos.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      return { x: h.body.pos.x + dx * 420, y: h.body.pos.y + dy * 420 };
    }

    const t = this.time;
    switch (h.role) {
      case 'batedora': {
        // Órbita ampla mapeando a tarefa
        const a = t * 1.25 + h.seed;
        return { x: task.x + Math.cos(a) * 150, y: task.y + Math.sin(a) * 88 };
      }
      case 'construtora': {
        // Shuttle depósito ↔ tarefa (ciclo de 2s×1.25)
        const cycle = (t * 0.4 + h.seed) % 2;
        const u = cycle < 1 ? cycle : 2 - cycle;
        const e = u * u * (3 - 2 * u); // smoothstep
        return { x: lerp(h.depot.x, task.x, e), y: lerp(h.depot.y, task.y, e) };
      }
      case 'sentinela': {
        // Patrulha retangular ao redor da tarefa
        const rx = Math.min(132, ctx.bounds.width * 0.24);
        const ry = Math.min(84, ctx.bounds.height * 0.2);
        const p = ((t * 0.5 + h.seed) % 1) * 4;
        if (p < 1) return { x: task.x - rx + p * 2 * rx, y: task.y - ry };
        if (p < 2) return { x: task.x + rx, y: task.y - ry + (p - 1) * 2 * ry };
        if (p < 3) return { x: task.x + rx - (p - 2) * 2 * rx, y: task.y + ry };
        return { x: task.x - rx, y: task.y + ry - (p - 3) * 2 * ry };
      }
      case 'mensageira': {
        // Corre entre a abelha-chefe e a tarefa
        const u = 0.5 + 0.5 * Math.sin(t * 1.1 + h.seed);
        return { x: lerp(ctx.body.pos.x, task.x, u), y: lerp(ctx.body.pos.y, task.y, u) };
      }
      case 'analisadora': {
        // Radar par acima do alvo
        return {
          x: task.x + Math.cos(t * 2.6 + h.seed) * 34,
          y: task.y - 96 + Math.sin(t * 3.4 + h.seed) * 10,
        };
      }
    }
  }

  /** Partículas de papel (marca a missão em andamento). */
  private emitRole(h: Helper, task: Vec2): void {
    if (this.time < h.emitAt) return;
    switch (h.role) {
      case 'batedora':
        h.emitAt = this.time + 0.13;
        this.emit('trail', h.body.pos.x, h.body.pos.y, 1);
        break;
      case 'construtora': {
        // Só carrega na ida (depósito → tarefa): ciclo < 1
        const cycle = (this.time * 0.4 + h.seed) % 2;
        if (cycle < 1) {
          h.emitAt = this.time + 0.15;
          this.emit('pollen', h.body.pos.x, h.body.pos.y, 1);
        } else {
          h.emitAt = this.time + 0.25;
        }
        break;
      }
      case 'sentinela':
        h.emitAt = this.time + 1.4;
        this.emit('sparkle', h.body.pos.x, h.body.pos.y, 2);
        break;
      case 'mensageira':
        h.emitAt = this.time + 0.2;
        this.emit('trail', h.body.pos.x, h.body.pos.y, 1);
        break;
      case 'analisadora':
        h.emitAt = this.time + 0.8;
        this.emit('sparkle', task.x, task.y, 3);
        break;
    }
  }

  /**
   * Saída de cena: integração manual SEM clamp de bounds (o stepBody
   * normal jamais deixaria o auxiliar sair do container).
   */
  private stepLeave(h: Helper, goal: Vec2, dt: number): void {
    const k = 1 - Math.exp(-5 * dt);
    // Converge a velocidade para a direção desejada (voo decidido, sem colisão)
    const tx = goal.x - h.body.pos.x;
    const ty = goal.y - h.body.pos.y;
    const d = Math.hypot(tx, ty) || 1;
    const dvx = (tx / d) * h.profile.maxSpeed - h.body.vel.x;
    const dvy = (ty / d) * h.profile.maxSpeed - h.body.vel.y;
    h.body.vel.x += dvx * k;
    h.body.vel.y += dvy * k;
    h.body.pos.x += h.body.vel.x * dt;
    h.body.pos.y += h.body.vel.y * dt;

    const alpha = Math.atan2(h.body.vel.y, h.body.vel.x);
    h.body.rot = expDamp(h.body.rot, normAngle(alpha), 6, dt);
    h.body.flapPhase = (h.body.flapPhase + h.profile.flapHz * dt) % 1;
    h.body.frame = FLAP_CYCLE[Math.floor(h.body.flapPhase * FLAP_CYCLE.length) % FLAP_CYCLE.length]!;

    h.layer.setPosition(h.body.pos.x, h.body.pos.y, buzzOffset(h.body, h.profile), 0, 0);
    h.layer.setOrientation(h.body.rot, h.body.flip, bodyScale(h.body), 0);
    h.layer.setFrame(h.body.frame);
  }

  private outside(p: Vec2): boolean {
    const b = this.opts.ctx.bounds;
    return p.x < -70 || p.x > b.width + 70 || p.y < -70 || p.y > b.height + 70;
  }

  private emit(kind: 'pollen' | 'sparkle' | 'trail', x: number, y: number, n: number): void {
    this.opts.ctx.emitParticles?.(kind, x, y, n);
  }
}

function clampIn(v: number, max: number): number {
  return Math.max(24, Math.min(max - 24, v));
}
