# 🐝 BeeMascot

Mascote abelha animado, production-ready: **4 sprites SVG + física de forças realista + FSM de 10 estados + integrações web** (favicon animado, loaders, tour guiado, reações de feedback, enxame de auxiliares, easter egg). Zero dependências de runtime, **~20 KB gzip**, ESM + tipos.

```bash
npm install
npm run dev        # demo completa em http://localhost:5173
```

## Recursos

- **Física de verdade** — Euler semi-implícito: thrust, arrasto exponencial, arrive sem overshoot, wander por value-noise fBm, clamps de velocidade. Nada de CSS keyframes: a abelha reage ao mundo.
- **FSM com blend** — 10 estados interpolam um *perfil de energia* (velocidade/força/flap) em ~280 ms: transições nunca cortam o momentum. Estados efêmeros (`celebrate`, `callHelp`) auto-retornam ao estado anterior.
- **Enxame de auxiliares** — `callHelp()` convoca 3–5 abelhas com papéis distintos (batedora, construtora, sentinela, mensageira, analisadora) que executam a tarefa e voam embora.
- **Render SVG + transform via rAF** — nitidez vetorial em qualquer DPI, 3 níveis de transform (translate / orient / frame), writes deduplicados.
- **Partículas** — canvas com pool fixo (GC zero no hot path) e 3 qualidades.
- **Integrações prontas** — favicon animado, loader (global/local), guide de onboarding, reações `data-bee`, easter egg, anunciador `aria-live`.
- **Acessibilidade** — `prefers-reduced-motion` respeitado (render estático), `role="img"` + rótulos, pausa com `visibilitychange`/`IntersectionObserver`.

## Uso rápido

```ts
import { createBeeMascot } from '@sistema/bee-mascot';

const bee = createBeeMascot({
  container: document.querySelector('#stage')!, // position !== static
  size: 96,               // presets: 48 · 64 · 96 · 128 · 160
  initialState: 'idle',
  quality: 'high',        // 'low' | 'medium' | 'high'
});

bee.setState('followTarget', { target: 'mouse' });
bee.celebrate();                          // auto-retorna após 3200 ms
bee.callHelp({ target: '#tarefa' });      // enxame 3–5 auxiliares (auto-retorna)
bee.setState('loading', { progress: 0.4 });
bee.setSize(128);                         // redimensiona em runtime
bee.on('statechange', ({ from, to }) => console.log(from, '→', to));
```

> Os estilos do componente são injetados pelo próprio JS — não há CSS separado para importar.

## Estados

| Estado | Comportamento |
| --- | --- |
| `idle` | wander orgânico (ruído fBm + hover) |
| `followTarget` | segue `'mouse'`, `HTMLElement` ou ponto `{x,y}` |
| `loading` | órbitas de carregamento; `progress` 0..1 vira anel |
| `celebrate` | euforia + partículas; **auto-retorna** ao estado anterior |
| `callHelp` | convoca 3–5 auxiliares com papéis; **auto-retorna** (padrão 7000 ms) |
| `thinking` | voo lento com micro-pausas |
| `logoMode` | órbita miúda ancorada (dock/companheiro) |
| `faviconMode` | estática no centro — gera frames do favicon |
| `guide` | hovera ao lado do elemento em destaque (onboarding) |
| `sleep` | voa até o percho, pousa e fecha as asas |

## API (`BeeMascot`)

| Método | Descrição |
| --- | --- |
| `setState(state, opts?)` | transição com blend (`target`, `anchor`, `progress`, `duration` **em ms**, `helpers`) |
| `getState()` | estado atual |
| `setTarget(t)` | ponto, elemento ou `'mouse'` |
| `celebrate(opts?)` | efêmero com auto-retorno (`intensity: 'low'\|'medium'\|'high'`) |
| `callHelp(opts?)` | enxame de auxiliares; `helpers: 3..5` (padrão conforme qualidade) |
| `setLoading(p?)` / `setProgress(p)` | modo carregamento, progresso 0..1 ou indeterminado |
| `dock(el)` / `undock()` | ancora/solta no elemento (modo companheiro) |
| `setSize(size)` | redimensiona (presets: 48 · 64 · 96 · 128 · 160) |
| `react(kind)` | `'success'` (salto+sparkle) · `'error'` (susto) · `'info'` |
| `on(event, cb)` | assina eventos; retorna a função de cancelamento |
| `pause()` / `resume()` | congela/retoma a física |
| `setQuality(q)` / `setTheme(t)` | troca em runtime |
| `destroy()` | remove do DOM e limpa listeners/rAF |
| `element` · `getPosition()` | nó raiz do layer · posição atual |

**Eventos:** `statechange`, `frame`, `rest`, `arrived`, `click` (com `interactive: true`), `react`, `error`.

## Integrações

### Favicon animado

```ts
import { createFavicon } from '@sistema/bee-mascot';

const favicon = createFavicon(bee, { size: 64 }); // rasteriza frames em PNG
```

### Loader (substitui o spinner)

```ts
import { createBeeLoader } from '@sistema/bee-mascot';

const loader = createBeeLoader(bee, {
  label: 'Salvando…',
  minDurationMs: 3500,    // overlay fica ao menos isso (padrão 3500)
});
loader.start();
loader.setProgress(0.42);   // barra + % + anel da abelha
loader.done('Pronto!');     // segura em 100% até minDurationMs, depois some + celebra
```

### Tour / onboarding

```ts
import { createGuide } from '@sistema/bee-mascot';

const guide = createGuide(bee, {
  steps: [
    { target: '#hero', title: 'Bem-vindo', text: '…' },
    { target: '#estados', title: 'Estados', text: '…' },
  ],
  onEnd: () => console.log('tour fechado'),
});
guide.start();              // ring + card; ESC encerra
```

### Reações (delegação, funciona em DOM dinâmico)

```ts
import { attachReactions } from '@sistema/bee-mascot';

attachReactions(bee);
```

```html
<button data-bee="success">Salvar</button>
<button data-bee="error">Simular falha</button>
<form data-bee-form>…</form> <!-- loading → sucesso -->
```

### Easter egg + acessibilidade

```ts
import { attachEasterEgg, createAnnouncer } from '@sistema/bee-mascot';

attachEasterEgg(bee, { selector: '.logo' });   // 5 cliques 🎉

const { announce } = createAnnouncer();        // região aria-live oculta
bee.on('statechange', ({ to }) => announce(`Mascote mudou para ${to}`));
```

## Qualidade e performance

| Qualidade | Partículas | Uso |
| --- | --- | --- |
| `low` | desligado | devices fracos / battery saver |
| `medium` | pool 90 | padrão |
| `high` | pool 200 + additive glow | desktop |

- Um único rAF compartilhado entre todas as instâncias (cada abelha extra é barata).
- Pausa automática: aba oculta, container fora da viewport, `prefers-reduced-motion`.
- `callHelp` respeita a qualidade: **low 3 · medium 4 · high 5** auxiliares (ou `helpers` explícito); com `prefers-reduced-motion` não convoca equipe.
- Bundle: **~20 KB gzip** com sprites embutidos (`?raw`), sem dependências.

## Scripts

```bash
npm run dev        # demo (Vite)
npm run build      # build da demo → dist/
npm run build:lib  # build da lib → dist-lib/ (bee-mascot.js + index.d.ts)
npm run typecheck  # tsc --noEmit
```

## Estrutura

```
src/
├─ sprites.ts          # ingestão ?raw, escopo de CSS, namespacing
├─ physics/            # vec2, noise (fBm), steering, body (integrador)
├─ states/             # profiles (perfis de energia), behaviors, machine (FSM)
├─ render/             # layer (SVG+transform), particles (canvas), styles
├─ integrations/       # favicon, loader, guide, reactions, easterEgg, a11y
├─ core/loop.ts        # rAF compartilhado    core/bee.ts  # composição + API
├─ core/swarm.ts       # enxame de auxiliares (callHelp)
├─ index.ts            # entry da lib
└─ main.ts + demo/     # página de demonstração
```

### Contratos de física

- Forças em **px/s²**, velocidades em **px/s** (perfil documentado em `states/profiles.ts`).
- Integração Euler semi-implícito com `dt` clampado em 50 ms — estável em qualquer refresh rate.
- Transições interpolam o perfil completo (`lerpProfile`), nunca teleportam.

## Demo

`npm run dev` abre a demonstração completa: telemetria ao vivo (estado/FPS/velocidade/posição), grid clicável dos 10 estados, e cards de integração — favicon, loader local/global, formulário com reações, dock, tour, controles de qualidade/tamanho/tema/a11y e o card do `callHelp` (equipe de auxiliares ao vivo).
