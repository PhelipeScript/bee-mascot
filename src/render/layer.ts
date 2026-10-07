/**
 * Camada de render — DOM/SVG com transforms via rAF.
 *
 * Por que SVG+transform e não canvas?
 *  - nitidez vetorial em qualquer DPI (sprite 128→260px continua limpa);
 *  - acessibilidade (role/aria) e clique por elemento reais;
 *  - transforms são compostos pela GPU sem re-layout (will-change: transform);
 *  - theming via CSS variables, idêntico ao resto do sistema.
 *
 * Estrutura de transforms (3 níveis, responsabilidades separadas):
 *   .bee-anim   → translate3d (física: posição + buzz + flutuação)
 *   .bee-tilt   → rotate/flip/scale (orientação + perspectiva + pose)
 *   .bee-frame-N→ o sprite visível (troca por atributo data-frame)
 */

import type { PreparedSprites } from '../sprites';
import { ensureStyle } from '../sprites';
import { COMPONENT_CSS } from './styles';

export class BeeLayer {
  /** Layer externo (inserido no container). */
  readonly layer: HTMLDivElement;
  /** Nó que recebe translate (posição física). */
  private anim: HTMLDivElement;
  /** Nó que recebe rotate/scale/flip (orientação). */
  private tilt: HTMLDivElement;
  private size: number;
  private lastFrame = -1;

  constructor(prepared: PreparedSprites, container: HTMLElement, size: number, zIndex: number) {
    ensureStyle(prepared);
    injectComponentCss();

    this.size = size;

    this.layer = document.createElement('div');
    this.layer.className = 'bee-mascot';
    this.layer.style.zIndex = String(zIndex);
    this.layer.setAttribute('aria-hidden', 'true');

    this.anim = document.createElement('div');
    this.anim.className = 'bee-anim';
    this.tilt = document.createElement('div');
    this.tilt.className = 'bee-tilt';

    // Os 4 frames: markup pré-normalizado (sem <style>/ids globais)
    const frag = document.createDocumentFragment();
    prepared.frames.forEach((markup, i) => {
      const holder = document.createElement('div');
      holder.innerHTML = markup;
      const svg = holder.firstElementChild as SVGElement | null;
      if (!svg) return;
      svg.classList.add('bee-frame', `bee-frame-${i}`);
      frag.appendChild(svg);
    });

    this.tilt.appendChild(frag);
    this.anim.appendChild(this.tilt);
    this.layer.appendChild(this.anim);
    container.appendChild(this.layer);

    this.setSize(size);
    this.setFrame(0);
  }

  setSize(size: number): void {
    this.size = size;
    this.layer.style.setProperty('--bee-size', `${size}px`);
  }

  /** Posição física → translate (offset centraliza o sprite no ponto). */
  setPosition(x: number, y: number, buzzY: number, hoverX: number, hoverY: number): void {
    const half = this.size / 2;
    this.anim.style.transform = `translate3d(${(x + hoverX - half).toFixed(2)}px, ${(y + buzzY + hoverY - half).toFixed(2)}px, 0)`;
  }

  /** Orientação → rotate/flip/scale. */
  setOrientation(rotation: number, flip: 1 | -1, scale: number, land: number): void {
    // land (0..1) encolhe levemente a pose pousada
    const s = scale * (1 - land * 0.07);
    const flipStr = flip === -1 ? 'scaleX(-1) ' : '';
    this.tilt.style.transform = `${flipStr}rotate(${rotation.toFixed(3)}rad) scale(${s.toFixed(4)})`;
  }

  /** Troca o frame visível (0..3) — só escreve no DOM quando muda. */
  setFrame(frame: number): void {
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    this.layer.dataset.frame = String(frame);
  }

  /** Torna a abelha clicável (modo interativo). */
  setInteractive(on: boolean): void {
    this.layer.classList.toggle('bee-interactive', on);
  }

  /** Raio aproximado do "corpo" para hit-testing. */
  get sizePx(): number {
    return this.size;
  }

  /** Nó animado (posicionamento) — usado p/ listeners de clique. */
  get animElement(): HTMLDivElement {
    return this.anim;
  }

  destroy(): void {
    this.layer.remove();
  }
}

let componentCssInjected = false;
function injectComponentCss(): void {
  if (componentCssInjected) return;
  componentCssInjected = true;
  const el = document.createElement('style');
  el.id = 'bee-mascot-component';
  el.textContent = COMPONENT_CSS;
  document.head.appendChild(el);
}
