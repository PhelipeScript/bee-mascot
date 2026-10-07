/**
 * Reações de feedback — a abelha responde a cliques/formulários/erros.
 *
 * Delegação em um único listener (funciona para DOM injetado depois):
 *
 *   <button data-bee="success">Salvar</button>   → pulo + brilho
 *   <button data-bee="error">Falhar</button>     → susto + tremor
 *   <button data-bee="info">Info</button>        → tiquetaque
 *   <form data-bee-form>…</form>                 → loading → sucesso
 */

import type { BeeMascot } from '../core/bee';

const REACTIONS = new Set(['success', 'error', 'info']);

export interface ReactionOptions {
  /** Duração simulada do envio de formulário (ms). Padrão: 1600. */
  formDuration?: number;
}

export function attachReactions(
  bee: BeeMascot,
  root: ParentNode = document,
  options: ReactionOptions = {},
): () => void {
  const formDuration = options.formDuration ?? 1600;
  let formTimer = 0;

  const onClick = (e: Event): void => {
    const target = (e.target as Element | null)?.closest?.('[data-bee]');
    if (!target) return;
    const kind = target.getAttribute('data-bee');
    if (kind && REACTIONS.has(kind)) {
      bee.react(kind as 'success' | 'error' | 'info');
    } else if (kind === 'celebrate') {
      bee.celebrate();
    } else if (kind) {
      // data-bee="idle|loading|thinking|…" → transição direta de estado
      bee.setState(kind as never);
    }
  };

  const onSubmit = (e: Event): void => {
    const form = e.target as HTMLFormElement;
    if (!form.matches('[data-bee-form]')) return;
    e.preventDefault();
    window.clearInterval(formTimer);
    bee.setLoading(0);
    let p = 0;
    // Progresso "fake" com easing desacelerado — parece trabalho de verdade
    const started = performance.now();
    const step = (): void => {
      const t = Math.min(1, (performance.now() - started) / formDuration);
      p = 1 - (1 - t) ** 2;
      bee.setProgress(p);
      if (t >= 1) {
        window.clearInterval(formTimer);
        bee.setProgress(undefined);
        bee.setState('idle');
        bee.react(form.dataset.beeResult === 'error' ? 'error' : 'success');
      }
    };
    formTimer = window.setInterval(step, 90);
    step();
  };

  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit, true);
  return () => {
    window.clearInterval(formTimer);
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit, true);
  };
}
