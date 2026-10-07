/**
 * Ingestão dos 4 sprites SVG.
 *
 * Os arquivos originais vêm do Illustrator/Figma com convenções perigosas para
 * injeção em página de terceiros:
 *   - id global duplicado ("lalala") em todos os frames;
 *   - classes genéricas (.cls-1 … .cls-6) que colidiriam com o CSS do host;
 *   - <style> embutido repetido em cada arquivo.
 *
 * Estratégia: um único stylesheet é extraído, **escopado** sob `.bee-mascot`
 * (specificity 0,2,0 — ganha de regras soltas do host) e injetado UMA vez no
 * documento. Os frames perdem o <style> interno e o id, ficando leves e
 * compartilháveis entre instâncias.
 */

import raw0 from './assets/abelha-01.svg?raw';
import raw1 from './assets/abelha-02.svg?raw';
import raw2 from './assets/abelha-03.svg?raw';
import raw3 from './assets/abelha-04.svg?raw';

/** Sprite SVG bruto (string) — formato aceito pela API pública. */
export type RawSprite = string;

/** Sprites padrão embutidas no bundle (a API permite sobrescrever). */
export const DEFAULT_SPRITES: RawSprite[] = [raw0, raw1, raw2, raw3];

const STYLE_TAG_ID = 'bee-mascot-style';

export interface PreparedSprites {
  /** Markup dos 4 frames, sem <style> e sem ids globais. */
  frames: string[];
  /** CSS escopado sob `.bee-mascot`, pronto para injeção. */
  scopedCss: string;
  /** CSS original (sem escopo) — usado ao serializar um frame isolado p/ favicon. */
  rawCss: string;
}

const XML_DECL = /^\s*<\?xml[^>]*\?>\s*/;
const STYLE_BLOCK = /<style>[\s\S]*?<\/style>/i;
const GLOBAL_ID = /\s*id="[^"]*"/g;

/** Escopa seletor simples tipo `.cls-N` sob a raiz do mascote. */
function scopeCss(css: string): string {
  return css.replace(/(^|[,{\s])(\.cls-\d)/g, '$1.bee-mascot $2');
}

function stripFrame(raw: string): string {
  return raw
    .replace(XML_DECL, '')
    .replace(STYLE_BLOCK, '')
    .replace(GLOBAL_ID, '');
}

/** Prepara os 4 frames + stylesheet escopado. Pura — pode ser cacheada. */
export function prepareSprites(rawSprites: RawSprite[] = DEFAULT_SPRITES): PreparedSprites {
  if (rawSprites.length < 4) {
    throw new Error('[bee-mascot] são necessários 4 sprites (frames de voo).');
  }
  const first = rawSprites[0]!;
  const styleMatch = first.match(STYLE_BLOCK);
  const cssBody = styleMatch
    ? styleMatch[0].replace(/^<style>|<\/style>$/gi, '')
    : '';
  const scopedCss = scopeCss(cssBody);
  return {
    frames: rawSprites.slice(0, 4).map(stripFrame),
    scopedCss,
    rawCss: cssBody,
  };
}

/**
 * Injeta (uma única vez) o stylesheet dos frames no <head>.
 * Seguro para múltiplas instâncias e hot-reload. O CSS estrutural do
 * componente vive em render/styles.ts (regras .bee-anim/.bee-frame).
 */
export function ensureStyle(prepared: PreparedSprites): void {
  if (document.getElementById(STYLE_TAG_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_TAG_ID;
  el.textContent = prepared.scopedCss;
  document.head.appendChild(el);
}

/**
 * Serializa UM frame como SVG autocontido (com <style> embutido).
 * Necessário para rasterizar no canvas do favicon, onde o CSS do documento
 * não acompanha o blob.
 */
export function frameToStandaloneSvg(prepared: PreparedSprites, frame: number): string {
  const markup = prepared.frames[frame % prepared.frames.length]!;
  // Reinsere a classe raiz + style inline: ao carregar como <img>/Image,
  // o seletor `.bee-mascot .cls-N` passa a valer dentro do próprio SVG.
  return markup.replace(
    /<svg([^>]*)>/,
    `<svg$1 class="bee-mascot"><style>${prepared.rawCss}</style>`,
  );
}
