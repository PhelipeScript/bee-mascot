/**
 * createBeeMascot — composição e API pública.
 *
 * Orçamento por frame (hot path, sem alocação):
 *   1. força = FSM.update (behavior + blend de perfil)
 *   2. stepBody (Euler semi-implícito)
 *   3. offsets cosméticos (hover noise + buzz)
 *   4. writes de transform (1..2 por frame, só se mudaram)
 *   5. partículas (só se ativas)
 */

import type {
  BeeEvents,
  BeeMascot,
  BeeOptions,
  BeePoint,
  BeeState,
  BeeTarget,
  CelebrationOptions,
  Quality,
  SetStateOptions,
  Theme,
} from '../types';

export type { BeeMascot, BeeState, BeeOptions, BeeEvents } from '../types';
import { Emitter } from './emitter';
import { subscribe } from './loop';
import { prepareSprites, DEFAULT_SPRITES } from '../sprites';
import type { PreparedSprites } from '../sprites';
import { createBody, stepBody, buzzOffset, bodyScale } from '../physics/body';
import type { Body } from '../physics/body';
import { fbm2 } from '../physics/noise';
import { resolvePoint } from '../states/context';
import type { BeeContext } from '../states/context';
import { StateMachine } from '../states/machine';
import type { Behavior } from '../states/behaviors';
import {
  idleBehavior,
  followBehavior,
  loadingBehavior,
  celebrateBehavior,
  callHelpBehavior,
  thinkingBehavior,
  orbitBehavior,
  faviconBehavior,
  guideBehavior,
  sleepBehavior,
} from '../states/behaviors';
import { BeeLayer } from '../render/layer';
import { ParticleSystem } from '../render/particles';
import { Swarm, helpersForQuality } from './swarm';

type ResolvedOptions = Required<
  Pick<BeeOptions, 'container' | 'initialState' | 'quality' | 'theme' | 'size' | 'zIndex' | 'interactive'>
> & { reducedMotion: boolean };

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function resolveOptions(o: BeeOptions): ResolvedOptions {
  const mq = typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia(REDUCED_MOTION_QUERY)
    : null;
  return {
    container: o.container,
    initialState: o.initialState ?? 'idle',
    quality: o.quality ?? 'high',
    theme: o.theme ?? 'auto',
    size: o.size ?? 96,
    zIndex: o.zIndex ?? 10,
    interactive: o.interactive ?? false,
    reducedMotion: o.reducedMotion ?? (mq?.matches ?? false),
  };
}

function themeOf(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  if (typeof window === 'undefined' || !('matchMedia' in window)) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function createBeeMascot(options: BeeOptions): BeeMascot {
  const opts = resolveOptions(options);
  const spritesRaw = options.sprites ?? DEFAULT_SPRITES;
  const container = opts.container;
  const computed = getComputedStyle(container);
  if (computed.position === 'static') {
    container.style.position = 'relative'; // host precisa ancorar o layer
  }

  const prepared: PreparedSprites = prepareSprites(spritesRaw);
  const emitter = new Emitter<BeeEvents>();

  const seed = Math.floor(Math.random() * 1e6);
  const bounds = { width: container.clientWidth || 600, height: container.clientHeight || 400 };

  // --- camada + partículas -------------------------------------------------
  const layer = new BeeLayer(prepared, container, opts.size, opts.zIndex);
  layer.setInteractive(opts.interactive);
  const particles = new ParticleSystem(container, opts.quality);
  particles.setTheme(themeOf(opts.theme));
  particles.resize(bounds.width, bounds.height);

  // --- corpo + contexto ----------------------------------------------------
  const body: Body = createBody(bounds.width / 2, bounds.height / 2, seed);
  const ctx: BeeContext = {
    hostEl: container,
    body,
    bounds,
    profile: { maxSpeed: 0, thrust: 0, flapHz: 0, noiseAmp: 0, buzzAmp: 0, drag: 1, arriveRadius: 0 },
    time: 0,
    mouse: null,
    target: null,
    anchor: null,
    guideTarget: null,
    progress: undefined,
    rotBias: 0,
    landT: 0,
    freezeFrame: null,
    emitParticles: opts.quality === 'low' ? null : (k, x, y, n) => particles.emit(k, x, y, n),
    quality: opts.quality,
    theme: opts.theme,
    state: opts.initialState,
    previousState: null,
    party: false,
  };

  // --- behaviors + FSM -----------------------------------------------------
  const behaviors: Record<BeeState, Behavior> = {
    idle: idleBehavior(seed),
    followTarget: followBehavior(),
    loading: loadingBehavior(),
    celebrate: celebrateBehavior(),
    callHelp: callHelpBehavior(seed),
    thinking: thinkingBehavior(seed),
    logoMode: orbitBehavior(1.5),
    faviconMode: faviconBehavior(),
    guide: guideBehavior(),
    sleep: sleepBehavior(),
  };

  let reaction: { kind: 'success' | 'error' | 'info'; until: number; origin: BeePoint } | null = null;

  // Enxame de auxiliares (callHelp) — criado/demitido nas transições.
  let swarm: Swarm | null = null;

  const machine = new StateMachine(opts.initialState, {
    behaviors,
    onTransition(from, to) {
      // Limpeza de intenção ao sair de estados com "modo"
      if (from === 'loading') ctx.progress = undefined;
      if (to === 'callHelp') {
        swarm?.destroy();
        swarm = null;
        if (!opts.reducedMotion) {
          swarm = new Swarm({
            ctx,
            prepared,
            container,
            size: opts.size,
            zIndex: Math.max(1, opts.zIndex - 1),
          });
          swarm.spawn(machine.options?.helpers ?? helpersForQuality(ctx.quality));
        }
      } else if (from === 'callHelp') {
        swarm?.dismiss(); // voam para fora de cena; loop destrói quando saírem
      }
      emitter.emit('statechange', { from, to });
      layer.layer.setAttribute('aria-label', ariaLabelFor(to));
    },
    overrideForce(c, dt) {
      if (!reaction) return null;
      if (c.time > reaction.until) {
        reaction = null;
        return null;
      }
      // Reação = força de flee + tremor, SEM trocar de estado (preserva FSM)
      const t = 1 - (reaction.until - c.time) / 0.85;
      const away = { x: c.body.pos.x - reaction.origin.x, y: c.body.pos.y - reaction.origin.y };
      const d = Math.hypot(away.x, away.y) || 1;
      const urgency = Math.max(0, 1 - t) * (reaction.kind === 'error' ? 2400 : 900);
      const shake = reaction.kind === 'error' ? Math.sin(c.time * 48) * 600 : 0;
      void dt;
      return { x: (away.x / d) * urgency + shake, y: (away.y / d) * urgency - (reaction.kind === 'success' ? 500 : 0) };
    },
  });
  ctx.state = machine.current;

  // --- listeners de ambiente ----------------------------------------------
  let paused = opts.reducedMotion;
  let destroyed = false;
  let offscreen = false;
  let docHidden = false;

  const onPointer = (e: MouseEvent | TouchEvent): void => {
    const r = container.getBoundingClientRect();
    const point = 'touches' in e
      ? e.touches[0] ?? e.changedTouches[0]
      : e;
    if (!point) return;
    ctx.mouse = { x: point.clientX - r.left, y: point.clientY - r.top };
  };
  window.addEventListener('mousemove', onPointer, { passive: true });
  window.addEventListener('touchmove', onPointer, { passive: true });

  const resize = (): void => {
    bounds.width = container.clientWidth || bounds.width;
    bounds.height = container.clientHeight || bounds.height;
    particles.resize(bounds.width, bounds.height);
    body.pos.x = Math.min(body.pos.x, bounds.width);
    body.pos.y = Math.min(body.pos.y, bounds.height);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        offscreen = !entries[0]?.isIntersecting;
        paused = opts.reducedMotion || offscreen || docHidden;
      }, { rootMargin: '80px' })
    : null;
  io?.observe(container);

  const onVisibility = (): void => {
    docHidden = document.hidden;
    paused = opts.reducedMotion || offscreen || docHidden;
  };
  document.addEventListener('visibilitychange', onVisibility);

  // --- clique interativo ---------------------------------------------------
  const onClick = (e: MouseEvent): void => {
    const r = container.getBoundingClientRect();
    emitter.emit('click', { x: e.clientX - r.left, y: e.clientY - r.top });
  };
  if (opts.interactive) layer.animElement.addEventListener('click', onClick);

  // --- loop ----------------------------------------------------------------
  let lastArrived = false;

  const unsubscribe = subscribe((rawDt) => {
    if (destroyed || paused) return;
    const dt = Math.min(rawDt, 0.05);
    ctx.time += dt;

    // Blend + behavior → força
    ctx.profile = machine.profile;
    const force = machine.update(ctx, dt);

    // Integração física
    const { frameChanged, justRested, speedNorm } = stepBody(body, force, machine.profile, dt, bounds);
    if (frameChanged) emitter.emit('frame', { index: body.frame });
    if (justRested) emitter.emit('rest', { x: body.pos.x, y: body.pos.y });

    // Offsets cosméticos: flutuação (ruído) + buzz (bater de asas)
    const amp = machine.profile.noiseAmp;
    const hoverX = fbm2(ctx.time * 0.45, 1.7, seed) * amp * 0.5;
    const hoverY = fbm2(ctx.time * 0.52, 9.3, seed) * amp * 0.42;
    const buzz = buzzOffset(body, machine.profile);

    // Writes (DOM já deduplica transforms iguais, mas evitamos trabalho extra)
    layer.setPosition(body.pos.x, body.pos.y, buzz, hoverX, hoverY);
    layer.setOrientation(body.rot + ctx.rotBias, body.flip, bodyScale(body) * (1 - speedNorm * 0.02), ctx.landT);
    layer.setFrame(ctx.freezeFrame ?? body.frame);

    // Evento 'arrived' (uma vez por aproximação)
    const goal = resolvePoint(ctx.target ?? ctx.guideTarget, ctx, body.pos);
    const d = Math.hypot(goal.x - body.pos.x, goal.y - body.pos.y);
    const near = d < machine.profile.arriveRadius && speedNorm < 0.06;
    if (near && !lastArrived && (machine.current === 'followTarget' || machine.current === 'guide')) {
      emitter.emit('arrived', { x: body.pos.x, y: body.pos.y });
    }
    lastArrived = d > machine.profile.arriveRadius * 1.4;

    // Enxame de auxiliares (callHelp): avança e se desfaz ao terminar
    if (swarm) {
      swarm.update(dt);
      if (swarm.finished) {
        swarm.destroy();
        swarm = null;
      }
    }

    if (particles.enabled) particles.update(dt);
  });

  // --- estado inicial ------------------------------------------------------
  behaviors[opts.initialState].enter?.(ctx);
  layer.layer.setAttribute('role', 'img');
  layer.layer.setAttribute('aria-label', ariaLabelFor(opts.initialState));
  if (opts.reducedMotion) renderStatic();

  /** Render único para prefers-reduced-motion: parado, frame fechado, sutil. */
  function renderStatic(): void {
    layer.setPosition(bounds.width * 0.5, bounds.height * 0.5, 0, 0, 0);
    layer.setOrientation(0, 1, 1, 0);
    layer.setFrame(0);
  }

  // --- API pública ---------------------------------------------------------
  function setState(state: BeeState, o?: SetStateOptions): void {
    if (o?.target !== undefined) {
      ctx.target = o.target;
      if (state === 'guide' && typeof o.target !== 'string' && 'getBoundingClientRect' in o.target) {
        ctx.guideTarget = o.target as HTMLElement;
      } else if (state === 'followTarget') {
        ctx.guideTarget = null;
      }
    }
    if (o?.anchor !== undefined) ctx.anchor = o.anchor;
    if (state === 'loading' && o?.progress !== undefined) ctx.progress = o.progress;
    machine.setState(ctx, state, o);
    if (opts.reducedMotion) renderStatic();
  }

  const api: BeeMascot = {
    setState,
    getState: () => machine.current,
    setTarget(target: BeeTarget) {
      ctx.target = target;
      const s = machine.current;
      if (s === 'idle' || s === 'followTarget') {
        setState('followTarget', { target });
      } else if (s === 'guide' && target !== 'mouse' && 'getBoundingClientRect' in target) {
        ctx.guideTarget = target;
      }
    },
    celebrate(o?: CelebrationOptions) {
      ctx.party = o?.intensity === 'high';
      setState('celebrate', { ...o, duration: o?.duration ?? 3200 });
    },
    callHelp(o?: SetStateOptions) {
      setState('callHelp', { duration: 7000, ...o });
    },
    setLoading(progress?: number) {
      setState('loading');
      if (progress !== undefined) ctx.progress = progress;
    },
    setProgress(progress: number | undefined) {
      ctx.progress = progress;
    },
    dock(element: HTMLElement) {
      ctx.anchor = element;
      setState('logoMode', { anchor: element });
    },
    undock() {
      ctx.anchor = null;
      setState('idle');
    },
    react(kind) {
      reaction = {
        kind,
        until: ctx.time + (kind === 'info' ? 0.35 : 0.85),
        origin: ctx.mouse ?? { ...body.pos },
      };
      if (kind === 'success') {
        // Salto para cima + brilho (física, sem trocar de estado)
        body.vel.y -= 170;
        body.vel.x += (Math.random() - 0.5) * 140;
        ctx.emitParticles?.('sparkle', body.pos.x, body.pos.y, 12);
      } else if (kind === 'error') {
        body.kick = 0.22;
        ctx.emitParticles?.('trail', body.pos.x, body.pos.y, 6);
      } else {
        body.kick = 0.1;
      }
      emitter.emit('react', { kind });
    },
    on: (event, cb) => emitter.on(event, cb),
    pause() {
      paused = true;
    },
    resume() {
      paused = opts.reducedMotion || offscreen || docHidden;
    },
    setQuality(q: Quality) {
      ctx.quality = q;
      particles.resizePool(q);
      ctx.emitParticles = q === 'low' ? null : (k, x, y, n) => particles.emit(k, x, y, n);
    },
    setTheme(t: Theme) {
      ctx.theme = t;
      particles.setTheme(themeOf(t));
    },
    setSize(size: number) {
      if (!Number.isFinite(size) || size <= 0) return;
      layer.setSize(Math.round(size));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('mousemove', onPointer);
      window.removeEventListener('touchmove', onPointer);
      if (opts.interactive) layer.animElement.removeEventListener('click', onClick);
      emitter.clear();
      swarm?.destroy();
      swarm = null;
      particles.destroy();
      layer.destroy();
    },
    get element() {
      return layer.layer;
    },
    getPosition: () => ({ x: body.pos.x, y: body.pos.y }),
  };

  return api;
}

function ariaLabelFor(state: BeeState): string {
  const labels: Record<BeeState, string> = {
    idle: 'Mascote abelha em voo',
    followTarget: 'Mascote abelha seguindo o ponteiro',
    loading: 'Mascote abelha carregando',
    celebrate: 'Mascote abelha comemorando',
    callHelp: 'Mascote abelha chamando a equipe de ajuda',
    thinking: 'Mascote abelha pensando',
    logoMode: 'Mascote abelha (logo)',
    faviconMode: 'Mascote abelha (ícone)',
    guide: 'Mascote abelha guiando um tour',
    sleep: 'Mascote abelha dormindo',
  };
  return labels[state];
}
