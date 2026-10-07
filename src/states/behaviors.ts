/**
 * Comportamentos (behaviors) — um por estado da FSM.
 *
 * Cada behavior devolve a FORÇA resultante (px/s², massa 1) para o integrador.
 * Estado interno (waypoints, timers) vive em closures criadas por instância —
 * duas abelhas na mesma página não compartilham "memória" de voo.
 *
 * Forças SEMPRE presentes (somadas na máquina):
 *   - avoidEdges (nunca bate na borda)
 *   - noise de flutuação é aplicado no RENDER (offset cosmético), não na
 *     física, para não corromper velocity/orientação.
 */

import type { Vec2 } from '../physics/vec2';
import { dist, normAngle } from '../physics/vec2';
import { arrive, wander, avoidEdges, personalSpace, flee } from '../physics/steering';
import { fbm2, noise2 } from '../physics/noise';
import { expDamp } from '../physics/vec2';
import type { BeeContext } from './context';
import { resolvePoint, elementCenter } from './context';
import type { SetStateOptions } from '../types';

export interface Behavior {
  enter?(ctx: BeeContext, options?: SetStateOptions): void;
  exit?(ctx: BeeContext): void;
  update(ctx: BeeContext, dt: number): Vec2;
}

const center = (ctx: BeeContext): Vec2 => ({
  x: ctx.bounds.width / 2,
  y: ctx.bounds.height / 2,
});

/** Somador vetorial leve (sem alocação por força). */
function sum(...forces: Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (let i = 0; i < forces.length; i++) {
    x += forces[i]!.x;
    y += forces[i]!.y;
  }
  return { x, y };
}

function edge(ctx: BeeContext): Vec2 {
  const m = Math.min(ctx.bounds.width, ctx.bounds.height) * 0.14 + 34;
  return avoidEdges(ctx.body.pos, ctx.body.vel, ctx.bounds.width, ctx.bounds.height, m);
}

// ---------------------------------------------------------------------------
// idle / wander
// ---------------------------------------------------------------------------
export function idleBehavior(seed: number): Behavior {
  return {
    update(ctx) {
      // "Energia" do ruído oscila (~cada 10s): momentos de zumbir rápido e
      // de pairar — é o que dá impressão de decisão/vida.
      const pulse = 0.5 + 0.5 * fbm2(ctx.time * 0.1, 9.5, seed);
      const energy = 0.3 + pulse * 0.7;
      return sum(
        wander(ctx.time, seed, ctx.profile.thrust * 0.5 * energy),
        edge(ctx),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// followTarget
// ---------------------------------------------------------------------------
export function followBehavior(): Behavior {
  return {
    update(ctx) {
      const target = resolvePoint(ctx.target ?? ctx.mouse, ctx, center(ctx));
      // Offset: paira ao lado do alvo, nunca em cima (o mouse precisa ser visível)
      const goal = { x: target.x + 76, y: target.y - 58 };
      const forces = [
        arrive(ctx.body.pos, ctx.body.vel, goal, ctx.profile.maxSpeed, ctx.profile.arriveRadius),
        wander(ctx.time * 1.6, ctx.body.seed, ctx.profile.thrust * 0.1),
        edge(ctx),
      ];
      // Personal space: se o cursor invadir, recua — abelhas têm espaço pessoal.
      if (ctx.mouse) forces.push(personalSpace(ctx.body.pos, ctx.mouse, 64, ctx.profile.maxSpeed * 6));
      return sum(...forces);
    },
  };
}

// ---------------------------------------------------------------------------
// loading — órbita vira "anel de progresso" quando há progresso
// ---------------------------------------------------------------------------
export function loadingBehavior(): Behavior {
  let trailAt = 0;
  return {
    enter() {
      trailAt = 0;
    },
    update(ctx) {
      const anchor = resolvePoint(ctx.anchor, ctx, center(ctx));
      const radius = Math.min(64, Math.min(ctx.bounds.width, ctx.bounds.height) * 0.22) + 16;
      const angle =
        ctx.progress !== undefined
          ? -Math.PI / 2 + ctx.progress * Math.PI * 2 // cabeça do arco = progresso
          : ctx.time * 2.6; // indeterminado: giro contínuo
      const goal = {
        x: anchor.x + Math.cos(angle) * radius,
        y: anchor.y + Math.sin(angle) * radius * 0.62, // elipse = perspectiva
      };
      // Rastro de pólen marca o caminho percorrido (qualidade alta)
      if (ctx.emitParticles && ctx.time - trailAt > 0.07) {
        trailAt = ctx.time;
        ctx.emitParticles('trail', ctx.body.pos.x, ctx.body.pos.y, 1);
      }
      return sum(
        arrive(ctx.body.pos, ctx.body.vel, goal, ctx.profile.maxSpeed, ctx.profile.arriveRadius),
        edge(ctx),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// celebrate — loops de lissajous + explosão de partículas
// ---------------------------------------------------------------------------
export function celebrateBehavior(): Behavior {
  let sparkleAt = 0;
  return {
    enter(ctx) {
      sparkleAt = 0;
      const density = ctx.party ? 3 : 1;
      ctx.emitParticles?.('sparkle', ctx.body.pos.x, ctx.body.pos.y, 18 * density);
      ctx.emitParticles?.('pollen', ctx.body.pos.x, ctx.body.pos.y, 8 * density);
      // Impulso de partida: "arranca" em vez de iniciar do zero
      const dir = ctx.body.seed % 2 === 0 ? 1 : -1;
      ctx.body.vel.x += 150 * dir;
      ctx.body.vel.y -= 90;
    },
    update(ctx, dt) {
      void dt;
      const anchor = resolvePoint(ctx.anchor, ctx, center(ctx));
      const w = Math.min(ctx.bounds.width * 0.3, 210);
      const h = Math.min(ctx.bounds.height * 0.32, 150);
      // Lissajous: trajetória fechada e periódica → "loops" naturais
      const goal = {
        x: anchor.x + Math.sin(ctx.time * 3.3) * w,
        y: anchor.y + Math.sin(ctx.time * 4.7 + 1.3) * h * 0.8,
      };
      const density = ctx.party ? 3 : 1;
      if (ctx.emitParticles && ctx.time - sparkleAt > 0.05) {
        sparkleAt = ctx.time;
        ctx.emitParticles('sparkle', ctx.body.pos.x, ctx.body.pos.y, 2 * density);
        ctx.emitParticles('pollen', ctx.body.pos.x, ctx.body.pos.y, density);
      }
      return sum(
        arrive(ctx.body.pos, ctx.body.vel, goal, ctx.profile.maxSpeed, ctx.profile.arriveRadius),
        edge(ctx),
      );
    },
    exit(ctx) {
      ctx.party = false;
    },
  };
}

// ---------------------------------------------------------------------------
// thinking — deriva lenta, pausas e "olhadas" para os lados
// ---------------------------------------------------------------------------
export function thinkingBehavior(seed: number): Behavior {
  let waypoint: Vec2 | null = null;
  let nextAt = 0;
  return {
    enter() {
      waypoint = null;
      nextAt = 0;
    },
    update(ctx) {
      const speed = Math.hypot(ctx.body.vel.x, ctx.body.vel.y);
      if (!waypoint || ctx.time > nextAt) {
        const wanderRange = 150;
        // Ponto aleatório (ruído determinístico por tempo+seed) perto da posição
        waypoint = {
          x: ctx.body.pos.x + noise2(ctx.time * 0.37, 1.7, seed) * wanderRange,
          y: ctx.body.pos.y + noise2(4.2, ctx.time * 0.37, seed) * wanderRange * 0.7,
        };
        // Ocasionalmente "congega" para raciocinar
        const pauseRoll = noise2(ctx.time * 0.53, 8.1, seed);
        nextAt = ctx.time + (pauseRoll > 0.35 ? 1.6 + pauseRoll : 0.7 + pauseRoll);
      }
      const speedLow = speed < 16;
      // Com velocidade baixa, o corpo "procura" olhando para os lados
      ctx.rotBias = speedLow ? normAngle(Math.sin(ctx.time * 1.7) * 0.5) : 0;
      return sum(
        arrive(ctx.body.pos, ctx.body.vel, waypoint, ctx.profile.maxSpeed, ctx.profile.arriveRadius),
        edge(ctx),
      );
    },
    exit(ctx) {
      ctx.rotBias = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// logoMode / dock — órbita miúda e previsível em volta da âncora
// ---------------------------------------------------------------------------
export function orbitBehavior(speed = 1.15): Behavior {
  return {
    update(ctx) {
      const anchor = resolvePoint(ctx.anchor, ctx, center(ctx));
      const hostMin = Math.min(ctx.bounds.width, ctx.bounds.height);
      const radius = Math.max(8, Math.min(30, hostMin * 0.16));
      const angle = ctx.time * speed + ctx.body.seed;
      const goal = {
        x: anchor.x + Math.cos(angle) * radius,
        y: anchor.y + Math.sin(angle) * radius * 0.55,
      };
      return sum(
        arrive(ctx.body.pos, ctx.body.vel, goal, ctx.profile.maxSpeed, ctx.profile.arriveRadius),
        edge(ctx),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// faviconMode — centro absoluto, praticamente estático (só asas batem)
// ---------------------------------------------------------------------------
export function faviconBehavior(): Behavior {
  return {
    update(ctx) {
      const c = center(ctx);
      return arrive(ctx.body.pos, ctx.body.vel, c, ctx.profile.maxSpeed, ctx.profile.arriveRadius);
    },
  };
}

// ---------------------------------------------------------------------------
// guide — aponta/hovera ao lado do elemento em destaque
// ---------------------------------------------------------------------------
export function guideBehavior(): Behavior {
  return {
    update(ctx) {
      if (!ctx.guideTarget) {
        // Sem alvo de guia, degrada para um wander suave (nunca parada seca)
        return wander(ctx.time, ctx.body.seed, ctx.profile.thrust * 0.4);
      }
      const el = ctx.guideTarget;
      const c = elementCenter(el, ctx);
      const r = el.getBoundingClientRect();
      const host = ctx.hostEl.getBoundingClientRect();
      // Fica à direita do elemento (ou à esquerda se não couber)
      const side = r.right - host.left < ctx.bounds.width - 96 ? 1 : -1;
      const goal = {
        x: c.x + side * (r.width / 2 + 58),
        y: c.y - 14 + Math.sin(ctx.time * 2.4) * 7,
      };
      return sum(
        arrive(ctx.body.pos, ctx.body.vel, goal, ctx.profile.maxSpeed, ctx.profile.arriveRadius),
        wander(ctx.time * 1.4, ctx.body.seed, ctx.profile.thrust * 0.1),
        edge(ctx),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// sleep — voa até o percho, pousa e fecha as asas
// ---------------------------------------------------------------------------
export function sleepBehavior(): Behavior {
  return {
    enter(ctx) {
      ctx.landT = 0;
      ctx.freezeFrame = null;
    },
    update(ctx, dt) {
      const perch = resolvePoint(
        ctx.anchor,
        ctx,
        { x: ctx.bounds.width - 78, y: ctx.bounds.height - 66 },
      );
      const d = dist(ctx.body.pos, perch);
      const speed = Math.hypot(ctx.body.vel.x, ctx.body.vel.y);
      const landed = d < 16 && speed < 14;

      // Pose de pouso: escala encolhe levemente, asas congelam fechadas
      ctx.landT = expDamp(ctx.landT, landed ? 1 : 0, 2.6, dt);
      ctx.freezeFrame = ctx.landT > 0.8 ? 3 : null;

      if (landed) {
        // Freio ativo: drena o residual de velocidade (não usa arrasto padrão)
        return { x: -ctx.body.vel.x * 7, y: -ctx.body.vel.y * 7 };
      }
      return arrive(ctx.body.pos, ctx.body.vel, perch, ctx.profile.maxSpeed, 40);
    },
    exit(ctx) {
      ctx.landT = 0;
      ctx.freezeFrame = null;
    },
  };
}

// ---------------------------------------------------------------------------
// callHelp — chama a equipe, buzina e supervisiona a tarefa
// ---------------------------------------------------------------------------
export function callHelpBehavior(seed: number): Behavior {
  let signalAt = 0;
  return {
    enter(ctx) {
      signalAt = 0;
      // Buzina de chamada: explosão de sparkle atraindo atenção da equipe
      ctx.emitParticles?.('sparkle', ctx.body.pos.x, ctx.body.pos.y, 16);
      ctx.emitParticles?.('pollen', ctx.body.pos.x, ctx.body.pos.y, 6);
      const dir = seed % 2 === 0 ? 1 : -1;
      ctx.body.vel.x += 120 * dir;
      ctx.body.vel.y -= 70;
    },
    update(ctx) {
      const task = resolvePoint(ctx.target ?? ctx.anchor, ctx, center(ctx));
      // Supervisão: órbita média ao redor da tarefa enquanto a equipe trabalha
      const angle = ctx.time * 1.9 + ctx.body.seed;
      const goal = {
        x: task.x + Math.cos(angle) * 96,
        y: task.y + Math.sin(angle) * 56,
      };
      // Sinalização periódica para a equipe (brilho curto)
      if (ctx.emitParticles && ctx.time - signalAt > 0.6) {
        signalAt = ctx.time;
        ctx.emitParticles('sparkle', ctx.body.pos.x, ctx.body.pos.y, 2);
      }
      // "Olha" para a tarefa enquanto supervisiona
      ctx.rotBias = normAngle(Math.sin(ctx.time * 2.2) * 0.4);
      return sum(
        arrive(ctx.body.pos, ctx.body.vel, goal, ctx.profile.maxSpeed, ctx.profile.arriveRadius),
        wander(ctx.time * 1.5, ctx.body.seed, ctx.profile.thrust * 0.08),
        edge(ctx),
      );
    },
    exit(ctx) {
      ctx.rotBias = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Reações efêmeras (fora da FSM): susto em erros, "oi" em cliques
// ---------------------------------------------------------------------------
export function startleForce(ctx: BeeContext, from: Vec2, remaining: number): Vec2 {
  void remaining;
  return flee(ctx.body.pos, from, ctx.profile.maxSpeed);
}
