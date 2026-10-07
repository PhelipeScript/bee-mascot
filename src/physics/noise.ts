/**
 * Ruído value-noise 2D + fBm (2 oitavas), com seed.
 *
 * Por que não Perlin puro? Para flutuação de mascote, value-noise com
 * smootherstep já produz curvas orgânicas indistinguíveis de Perlin, em
 * ~40 linhas e sem tabela de gradientes — e é determinístico por seed,
 * o que mantém a "personalidade" da abelha consistente entre execuções.
 */

function hash(ix: number, iy: number, seed: number): number {
  // Hash inteiro → [0,1). Determinístico e rápido (mulberry-ish).
  let h = ix * 374761393 + iy * 668265263 + seed * 1442695040;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Value-noise em [-1, 1]. */
export function noise2(x: number, y: number, seed = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smootherstep(x - x0);
  const fy = smootherstep(y - y0);

  const v00 = hash(x0, y0, seed);
  const v10 = hash(x0 + 1, y0, seed);
  const v01 = hash(x0, y0 + 1, seed);
  const v11 = hash(x0 + 1, y0 + 1, seed);

  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return (top + (bottom - top) * fy) * 2 - 1;
}

/** fBm com 2 oitavas — camada grossa (orgânica) + fina (instabilidade). */
export function fbm2(x: number, y: number, seed = 0): number {
  return noise2(x, y, seed) * 0.68 + noise2(x * 2.7, y * 2.7, seed + 7) * 0.32;
}
