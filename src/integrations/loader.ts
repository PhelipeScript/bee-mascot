/**
 * Loading indicator (global ou local) que substitui o spinner tradicional.
 *
 * Cria um overlay e uma instância PRÓPRIA do mascote dentro dele — um bee
 * extra por loader é barato (o rAF é compartilhado) e mostra que múltiplas
 * instâncias convivem bem.
 *
 * API:
 *   const loader = createBeeLoader(bee, { label: 'Salvando…' });
 *   loader.start(); loader.setProgress(0.42); loader.done();
 */

import { createBeeMascot } from '../core/bee';
import type { BeeMascot } from '../core/bee';

export interface LoaderOptions {
  /** Onde o overlay vive. Padrão: document.body (loader global). */
  container?: HTMLElement;
  /** Texto exibido. Padrão: 'Carregando…'. */
  label?: string;
  /** Fecha e destrói o overlay após done(). Padrão: true. */
  autoClose?: boolean;
  /** Millis antes de auto-remover após done(). Padrão: 1300. */
  closeDelay?: number;
  /**
   * Duração mínima total em ms: `done()` só fecha o overlay depois de
   * cumprir isso (segura a barra em 100% + mensagem de sucesso).
   * Padrão: 3500 — loaders muito rápidos parecem "sumiram".
   */
  minDurationMs?: number;
}

export interface BeeLoader {
  /** Mostra o overlay e coloca a abelha em modo loading. */
  start(): void;
  /** Progresso 0..1 (undefined = indeterminado). */
  setProgress(progress: number | undefined): void;
  /** Conclui: overlay some e a abelha comemora. */
  done(message?: string): void;
  /** Fecha sem cerimônia. */
  destroy(): void;
}

export function createBeeLoader(host: BeeMascot | null, options: LoaderOptions = {}): BeeLoader {
  const container = options.container ?? document.body;
  const label = options.label ?? 'Carregando…';
  const autoClose = options.autoClose ?? true;
  const closeDelay = options.closeDelay ?? 1300;
  const minDurationMs = options.minDurationMs ?? 3500;
  const isGlobal = container === document.body;

  const overlay = document.createElement('div');
  overlay.className = 'bee-loader';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  if (isGlobal) overlay.classList.add('bee-loader--global');
  overlay.style.position = isGlobal ? 'fixed' : 'absolute';
  overlay.style.inset = isGlobal ? '0' : '0';
  overlay.style.zIndex = isGlobal ? '9999' : '5';
  if (!isGlobal && getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  overlay.innerHTML = `
    <div class="bee-loader__scrim"></div>
  <div class="bee-loader__stage" aria-hidden="true"></div>
    <div class="bee-loader__meta">
      <span class="bee-loader__label"></span>
      <span class="bee-loader__pct"></span>
    </div>
    <div class="bee-loader__track"><div class="bee-loader__bar"></div></div>
  `;
  const labelEl = overlay.querySelector<HTMLElement>('.bee-loader__label')!;
  const pctEl = overlay.querySelector<HTMLElement>('.bee-loader__pct')!;
  const barEl = overlay.querySelector<HTMLElement>('.bee-loader__bar')!;
  const stageEl = overlay.querySelector<HTMLElement>('.bee-loader__stage')!;
  labelEl.textContent = label;

  container.appendChild(overlay);

  // Instância dedicada do mascote dentro do overlay
  const localBee: BeeMascot = createBeeMascot({
    container: stageEl,
    size: 84,
    initialState: 'loading',
    quality: 'medium',
    zIndex: 2,
  });

  let progress: number | undefined;
  let closed = false;
  let startedAt = 0;
  let finishScheduled = false;

  const render = (): void => {
    if (progress === undefined) {
      barEl.style.width = '100%';
      barEl.classList.add('bee-loader__bar--indeterminate');
      pctEl.textContent = '';
    } else {
      const p = Math.max(0, Math.min(1, progress));
      barEl.classList.remove('bee-loader__bar--indeterminate');
      barEl.style.width = `${(p * 100).toFixed(1)}%`;
      pctEl.textContent = `${Math.round(p * 100)}%`;
    }
  };
  render();

  /** Fecha o overlay de fato (esconde, celebra e agenda o destroy). */
  function finish(): void {
    if (closed) return;
    finishScheduled = false;
    overlay.classList.remove('is-visible');
    overlay.classList.add('is-done');
    localBee.celebrate({ duration: 900 });
    host?.celebrate({ duration: 1600 });
    if (autoClose) {
      window.setTimeout(destroy, closeDelay);
    }
  }

  function destroy(): void {
    if (closed) return;
    closed = true;
    finishScheduled = false;
    localBee.destroy();
    overlay.remove();
  }

  return {
    start() {
      startedAt = performance.now();
      overlay.classList.add('is-visible');
      localBee.setState('loading', { progress });
      host?.setState('loading', { progress });
    },
    setProgress(p) {
      progress = p;
      render();
      localBee.setProgress(p);
      host?.setProgress(p);
    },
    done(message) {
      if (closed || finishScheduled) return;
      if (message) labelEl.textContent = message;
      // Segura o overlay em 100% até a duração mínima cumprir
      const wait = Math.max(0, minDurationMs - (performance.now() - startedAt));
      if (wait > 0) {
        finishScheduled = true;
        window.setTimeout(finish, wait);
        return;
      }
      finish();
    },
    destroy,
  };
}
