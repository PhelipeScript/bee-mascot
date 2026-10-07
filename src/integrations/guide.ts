/**
 * Guia de onboarding/tutorial.
 *
 * A abelha voa até cada elemento (estado 'guide') enquanto um ring de
 * destaque + card explicativo acompanham o alvo. O ring/card usam
 * position:fixed (coords de viewport) — funcionam para alvos fora do
 * container da abelha; a abelha em si voa dentro dos limites do container
 * (em integrações reais, use um layer fixo de viewport como container).
 */

import type { BeeMascot } from '../core/bee';

export interface GuideStep {
  /** Seletor CSS ou elemento direto. */
  target: string | HTMLElement;
  title: string;
  text?: string;
}

export interface BeeGuide {
  start(): void;
  next(): void;
  prev(): void;
  end(): void;
  readonly current: number;
  readonly running: boolean;
}

export function createGuide(
  bee: BeeMascot,
  steps: GuideStep[],
  options: { onEnd?: () => void } = {},
): BeeGuide {
  let index = -1;
  let running = false;

  const ring = document.createElement('div');
  ring.className = 'bee-guide-ring';
  ring.setAttribute('aria-hidden', 'true');

  const card = document.createElement('div');
  card.className = 'bee-guide-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Tour guiado');
  card.innerHTML = `
    <div class="bee-guide-card__step"></div>
    <strong class="bee-guide-card__title"></strong>
    <p class="bee-guide-card__text"></p>
    <div class="bee-guide-card__actions">
      <button type="button" class="bee-btn bee-btn--ghost" data-guide="back">Voltar</button>
      <button type="button" class="bee-btn bee-btn--primary" data-guide="next">Avançar</button>
    </div>
  `;
  document.body.append(ring, card);

  const titleEl = card.querySelector<HTMLElement>('.bee-guide-card__title')!;
  const textEl = card.querySelector<HTMLElement>('.bee-guide-card__text')!;
  const stepEl = card.querySelector<HTMLElement>('.bee-guide-card__step')!;
  const backBtn = card.querySelector<HTMLButtonElement>('[data-guide="back"]')!;
  const nextBtn = card.querySelector<HTMLButtonElement>('[data-guide="next"]')!;

  function resolveTarget(step: GuideStep): HTMLElement | null {
    if (typeof step.target !== 'string') return step.target;
    return document.querySelector<HTMLElement>(step.target);
  }

  function place(el: HTMLElement): void {
    const r = el.getBoundingClientRect();
    const pad = 8;
    ring.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
    ring.style.width = `${r.width + pad * 2}px`;
    ring.style.height = `${r.height + pad * 2}px`;
    ring.classList.add('is-visible');

    // Card abaixo do alvo (ou acima se não couber)
    const below = r.bottom + 18;
    const cardH = card.offsetHeight || 170;
    const top = below + cardH > window.innerHeight ? Math.max(12, r.top - cardH - 18) : below;
    const left = Math.min(
      Math.max(12, r.left + r.width / 2 - (card.offsetWidth || 280) / 2),
      window.innerWidth - ((card.offsetWidth || 280) + 12),
    );
    card.style.transform = `translate(${left}px, ${top}px)`;
  }

  function show(i: number): void {
    const step = steps[i];
    if (!step) return end();
    index = i;
    const el = resolveTarget(step);
    if (!el) {
      // Alvo ausente: pula para o próximo (nunca quebra o tour)
      const next = i + 1;
      if (next < steps.length) show(next);
      else end();
      return;
    }
    stepEl.textContent = `${i + 1} / ${steps.length}`;
    titleEl.textContent = step.title;
    textEl.textContent = step.text ?? '';
    backBtn.disabled = i === 0;
    nextBtn.textContent = i === steps.length - 1 ? 'Concluir' : 'Avançar';
    card.classList.add('is-visible');
    bee.setState('guide', { target: el });
    // Traz o alvo para a viewport (o ring/card são fixed e acompanham no scroll)
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    place(el);
    window.setTimeout(() => running && index === i && place(el), 420);
  }

  function end(): void {
    running = false;
    index = -1;
    ring.classList.remove('is-visible');
    card.classList.remove('is-visible');
    bee.setState('idle');
    options.onEnd?.();
  }

  const onResize = (): void => {
    if (!running || index < 0) return;
    const step = steps[index];
    if (step) {
      const el = resolveTarget(step);
      if (el) place(el);
    }
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onResize, { passive: true });

  backBtn.addEventListener('click', () => show(index - 1));
  nextBtn.addEventListener('click', () => {
    if (index >= steps.length - 1) end();
    else show(index + 1);
  });
  // ESC encerra
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && running) end();
  };
  window.addEventListener('keydown', onKey);

  return {
    start() {
      if (steps.length === 0) return;
      running = true;
      show(0);
    },
    next: () => show(index + 1),
    prev: () => show(index - 1),
    end() {
      if (running) end();
    },
    get current() {
      return index;
    },
    get running() {
      return running;
    },
  };
}
