/**
 * Demo BeeMascot — wiring de TODAS as integrações numa página só.
 *
 * Estrutura da página:
 *  - #bee-viewport: layer fixo de viewport (container da abelha principal)
 *  - instância extra no header (logoMode) — prova de múltiplos contextos
 *  - integrações: favicon, loaders, reações, tour, dock, easter egg, a11y
 */

import './demo/demo.css';
import {
  createBeeMascot,
  createFavicon,
  createBeeLoader,
  createGuide,
  attachReactions,
  attachEasterEgg,
  createAnnouncer,
  prefersReducedMotion,
} from './index';
import type { BeeLoader } from './index';
import type { BeeState } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`[demo] elemento não encontrado: ${sel}`);
  return el;
}

function toast(message: string): void {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-visible');
  window.clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(window.setTimeout(() => el.classList.remove('is-visible'), 3200));
}

// ---------------------------------------------------------------------------
// 1. Instância principal (layer fixo de viewport) + instância de logo
// ---------------------------------------------------------------------------
const stage = $('#bee-viewport');
const bee = createBeeMascot({
  container: stage,
  size: 96,
  initialState: 'idle',
  quality: 'high',
  theme: 'dark',
  interactive: true,
});

const logoBee = createBeeMascot({
  container: $('#logo-bee'),
  size: 42,
  initialState: 'logoMode',
  quality: 'low',
  theme: 'dark',
});

// ---------------------------------------------------------------------------
// 2. Favicon dinâmico + prévia na página
// ---------------------------------------------------------------------------
const favicon = createFavicon(bee, { size: 64 });
const faviconImg = $('#favicon-img') as HTMLImageElement;
const faviconState = $('#favicon-state');

window.setInterval(() => {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (link?.href && link.href !== faviconImg.src) faviconImg.src = link.href;
  faviconState.textContent = bee.getState();
}, 350);

// ---------------------------------------------------------------------------
// 3. Reações ([data-bee] + forms) e easter egg
// ---------------------------------------------------------------------------
const detachReactions = attachReactions(bee);
attachEasterEgg(bee, {
  target: '[data-bee-logo]',
  onTrigger: () => toast('🐝 Modo festa! Você encontrou o easter egg.'),
});

// Clique simples no logo: reage a instância local e comemora a principal
$<HTMLAnchorElement>('[data-bee-logo]').addEventListener('click', (e) => {
  e.preventDefault();
  logoBee.react('success');
  bee.celebrate({ duration: 2600 });
  toast('Oi! O logo também é uma abelha viva.');
});

// ---------------------------------------------------------------------------
// 4. Tour / onboarding (4 passos)
// ---------------------------------------------------------------------------
const guide = createGuide(
  bee,
  [
    {
      target: '#hero-actions',
      title: 'Controles do voo',
      text: 'Estes botões mudam o estado da abelha. "Seguir o mouse" ativa o arrive com espaço pessoal.',
    },
    {
      target: '#card-favicon',
      title: 'Favicon vivo',
      text: 'O ícone da aba é rasterizado do frame atual e muda junto com o estado.',
    },
    {
      target: '#card-reactions',
      title: 'Reações de feedback',
      text: 'Sucesso, erro e formulários disparam forças de reação sem interromper o estado atual.',
    },
    {
      target: '#state-grid',
      title: 'Todos os estados',
      text: 'Clique em qualquer card para forçar o estado — a transição interpola o perfil de energia.',
    },
  ],
  { onEnd: () => toast('Tour concluído! Explore os cards à vontade.') },
);

// ---------------------------------------------------------------------------
// 5. Grid de estados
// ---------------------------------------------------------------------------
interface StateDef {
  id: BeeState;
  title: string;
  desc: string;
}

const STATE_DEFS: StateDef[] = [
  { id: 'idle', title: 'idle / wander', desc: 'Ruído fBm + pausas — voo orgânico quando ociosa.' },
  { id: 'followTarget', title: 'followTarget', desc: 'Arrive no mouse com offset e personal space.' },
  { id: 'loading', title: 'loading', desc: 'Órbita vira anel de progresso (0..1).' },
  { id: 'celebrate', title: 'celebrate', desc: 'Loops de lissajous + pólen. Auto-retorna.' },
  { id: 'callHelp', title: 'callHelp', desc: 'Chama 3–5 auxiliares com papéis. Auto-retorna.' },
  { id: 'thinking', title: 'thinking', desc: 'Deriva lenta, waypoints e "olhadas".' },
  { id: 'logoMode', title: 'logoMode', desc: 'Órbita miúda ancorada no elemento escolhido.' },
  { id: 'faviconMode', title: 'faviconMode', desc: 'Centro absoluto, só asas batem.' },
  { id: 'guide', title: 'guide', desc: 'Paira ao lado do elemento em destaque.' },
  { id: 'sleep', title: 'sleep', desc: 'Pousa no canto e fecha as asas.' },
];

const grid = $('#state-grid');
for (const def of STATE_DEFS) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'state-card';
  btn.dataset.state = def.id;
  btn.innerHTML = `<strong>${def.title}</strong><span>${def.desc}</span>`;
  btn.addEventListener('click', () => gotoState(def.id, btn));
  grid.appendChild(btn);
}

let loadingTimer = 0;
function stopLoadingSim(): void {
  window.clearInterval(loadingTimer);
  loadingTimer = 0;
}

function gotoState(id: BeeState, source: HTMLElement): void {
  stopLoadingSim();
  switch (id) {
    case 'followTarget':
      bee.setState('followTarget', { target: 'mouse' });
      break;
    case 'celebrate':
      bee.celebrate();
      break;
    case 'callHelp':
      bee.callHelp({ target: source });
      break;
    case 'loading': {
      // Progresso realista 0→1 em ~6s (micro-stalls + desaceleração)
      bee.setState('loading');
      let p = 0;
      bee.setProgress(0);
      loadingTimer = window.setInterval(() => {
        if (Math.random() < 0.12) return; // stall: rede "pensando"
        p = Math.min(1, p + (0.055 - p * 0.035) + Math.random() * 0.012);
        bee.setProgress(p);
        if (p >= 1) {
          stopLoadingSim();
          bee.setProgress(undefined);
          bee.setState('idle');
          bee.celebrate({ duration: 1800 }); // tarefa concluída 🎉
        }
      }, 240);
      break;
    }
    case 'guide':
      bee.setState('guide', { target: source });
      break;
    case 'logoMode':
      bee.setState('logoMode', { anchor: source });
      break;
    default:
      bee.setState(id);
  }
}

// ---------------------------------------------------------------------------
// 6. Ações do hero
// ---------------------------------------------------------------------------
$('#hero-actions').addEventListener('click', (e) => {
  const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'tour') {
    guide.start();
    return;
  }
  gotoState(action as BeeState, $('#hero-actions'));
});

// ---------------------------------------------------------------------------
// 7. Loaders (local e global)
// ---------------------------------------------------------------------------
let activeLoader: BeeLoader | null = null;

function runLoader(container: HTMLElement | undefined, label: string): void {
  activeLoader?.destroy();
  const loader = createBeeLoader(null, {
    ...(container ? { container } : {}),
    label,
    minDurationMs: 4500,
  });
  activeLoader = loader;
  loader.start();
  let p = 0;
  const id = window.setInterval(() => {
    if (Math.random() < 0.1) return; // micro-stall
    p = Math.min(1, p + 0.016 + Math.random() * 0.03);
    loader.setProgress(p);
    if (p >= 1) {
      window.clearInterval(id);
      window.setTimeout(() => loader.done('Pronto!'), 220);
    }
  }, 150);
}

$('#btn-local-loader').addEventListener('click', () =>
  runLoader($('#local-loader-stage'), 'Carregando dados locais…'),
);
$('#btn-global-loader').addEventListener('click', () =>
  runLoader(undefined, 'Preparando o mel…'),
);

// ---------------------------------------------------------------------------
// 8. Dock (modo companheiro)
// ---------------------------------------------------------------------------
$('#btn-dock').addEventListener('click', () => {
  bee.dock($('#dock-pad'));
  toast('Abelha convidada: ela vai orbitar o painel.');
});
$('#btn-undock').addEventListener('click', () => bee.undock());

// ---------------------------------------------------------------------------
// 8b. callHelp (enxame de auxiliares)
// ---------------------------------------------------------------------------
$('#btn-callhelp').addEventListener('click', () => {
  bee.callHelp({ target: $('#card-callhelp') });
  toast('Equipe a caminho: 3–5 abelhas auxiliares.');
});
window.setInterval(() => {
  $('#helper-count').textContent = `${document.querySelectorAll('[data-helper]').length} auxiliares`;
}, 350);

// ---------------------------------------------------------------------------
// 9. Tour (dois gatilhos)
// ---------------------------------------------------------------------------
$('#btn-tour').addEventListener('click', () => guide.start());

// ---------------------------------------------------------------------------
// 10. Qualidade / tema / anúncios aria-live
// ---------------------------------------------------------------------------
$('#sel-quality').addEventListener('change', (e) => {
  const q = (e.target as HTMLSelectElement).value as 'low' | 'medium' | 'high';
  bee.setQuality(q);
  $('#t-quality').textContent = q;
  toast(`Qualidade: ${q}`);
});

$('#sel-size').addEventListener('change', (e) => {
  const size = Number((e.target as HTMLSelectElement).value);
  bee.setSize(size);
  toast(`Tamanho: ${size}px`);
});

$('#sel-theme').addEventListener('change', (e) => {
  const t = (e.target as HTMLSelectElement).value as 'auto' | 'light' | 'dark';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  bee.setTheme(t);
  logoBee.setTheme(t);
  toast(`Tema: ${t}`);
});

const announcer = createAnnouncer();
let detachAnnounce: (() => void) | null = null;
$('#chk-announce').addEventListener('change', (e) => {
  const on = (e.target as HTMLInputElement).checked;
  if (on && !detachAnnounce) {
    detachAnnounce = bee.on('statechange', ({ to }) => announcer.announce(`Mascote mudou para ${to}`));
    announcer.announce('Anúncios de estado ativados.');
  } else if (!on && detachAnnounce) {
    detachAnnounce();
    detachAnnounce = null;
  }
});

// ---------------------------------------------------------------------------
// 11. Telemetria + chips + FPS
// ---------------------------------------------------------------------------
const stateChip = $('#state-chip');
const stateChipText = $('#state-chip-text');

bee.on('statechange', ({ from, to }) => {
  if (from === 'loading' && to !== 'loading') stopLoadingSim();
  stateChip.dataset.state = to;
  stateChipText.textContent = to;
  document.body.dataset.beeState = to;
});

let lastPos = bee.getPosition();
let speed = 0;
window.setInterval(() => {
  const pos = bee.getPosition();
  speed = Math.hypot(pos.x - lastPos.x, pos.y - lastPos.y) * 5; // intervalo 200ms
  lastPos = pos;
  $('#t-state').textContent = bee.getState();
  $('#t-frame').textContent = bee.element.dataset.frame ?? '0';
  $('#t-speed').textContent = `${speed.toFixed(0)} px/s`;
  $('#t-pos').textContent = `${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}`;
}, 200);

// FPS (rAF próprio, independente do loop do mascote)
let frames = 0;
let fpsLast = performance.now();
function countFrame(): void {
  frames++;
  requestAnimationFrame(countFrame);
}
requestAnimationFrame(countFrame);
window.setInterval(() => {
  const now = performance.now();
  const fps = Math.round((frames * 1000) / (now - fpsLast));
  frames = 0;
  fpsLast = now;
  $('#t-fps').textContent = String(fps);
  $('#fps-chip').textContent = `${fps} fps`;
}, 700);

// ---------------------------------------------------------------------------
// 12. Nota de movimento reduzido
// ---------------------------------------------------------------------------
const reduced = prefersReducedMotion();
$('#reduced-note').textContent = reduced
  ? 'prefers-reduced-motion: ATIVO — a abelha nasce estática (frame de repouso), sem rAF.'
  : 'prefers-reduced-motion: inativo — animação completa habilitada.';

// ---------------------------------------------------------------------------
// Estado inicial da demo: abelha livre no hero
// ---------------------------------------------------------------------------
bee.setState('idle');
window.addEventListener(
  'beforeunload',
  () => {
    favicon.destroy();
    detachReactions();
    guide.end();
    logoBee.destroy();
    bee.destroy();
  },
  { once: true },
);

console.info(
  '%c🐝 BeeMascot demo',
  'color:#29c4f4;font-weight:bold',
  '\nAPI: window.bee  ·  clique 5× no logo para o easter egg',
);
// Exposta p/ inspeção no console (documentação viva)
(window as unknown as { bee: typeof bee }).bee = bee;
