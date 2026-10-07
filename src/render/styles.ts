/**
 * Estilos do componente — injetados UMA vez como <style>, sem arquivo CSS
 * externo. Assim quem importa o módulo não precisa lembrar de importar CSS
 * (o bundle é só JS), múltiplas instâncias não duplicam regras, e tudo que
 * as integrações criam (loader, guide) já vem estilizado e nomeado com
 * prefixo `bee-` para não colidir com o host.
 */

export const COMPONENT_CSS = `
:root{
  --bee-accent:#29c4f4; --bee-accent-soft:#9cdcf8; --bee-deep:#00364e;
  --bee-surface:#ffffff; --bee-ink:#0b1f2a; --bee-line:rgba(0,54,78,.14);
  --bee-shadow:0 18px 44px rgba(0,54,78,.18);
}
/* ---------- layer + sprite ---------- */
.bee-mascot{position:absolute;inset:0;pointer-events:none;overflow:visible;contain:layout style}
.bee-anim{position:absolute;left:0;top:0;width:var(--bee-size,96px);height:var(--bee-size,96px);
  will-change:transform;transform-origin:50% 50%;pointer-events:none}
.bee-tilt{position:relative;width:100%;height:100%;transform-origin:50% 50%;pointer-events:none}
.bee-frame{position:absolute;inset:0;width:100%;height:100%;display:none;overflow:visible}
.bee-mascot[data-frame="0"] .bee-frame-0,
.bee-mascot[data-frame="1"] .bee-frame-1,
.bee-mascot[data-frame="2"] .bee-frame-2,
.bee-mascot[data-frame="3"] .bee-frame-3{display:block}
.bee-layer-particles{position:absolute;inset:0;pointer-events:none}
.bee-interactive .bee-anim{pointer-events:auto;cursor:pointer}
@media (prefers-reduced-motion: reduce){.bee-anim{transition:none!important}}

/* ---------- a11y ---------- */
.bee-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* ---------- loader ---------- */
.bee-loader{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:12px;opacity:0;visibility:hidden;
  transition:opacity .32s ease,visibility .32s ease}
.bee-loader.is-visible{opacity:1;visibility:visible}
.bee-loader__scrim{position:absolute;inset:0;background:rgba(3,20,29,.42);backdrop-filter:blur(7px)}
.bee-loader--global .bee-loader__scrim{background:rgba(3,20,29,.55)}
.bee-loader__stage{position:relative;width:190px;height:150px}
.bee-loader__meta{position:relative;display:flex;gap:10px;align-items:baseline;
  font:600 13px/1.2 system-ui,sans-serif;color:var(--bee-accent-soft)}
.bee-loader__label{color:#eaf8ff;letter-spacing:.02em}
.bee-loader__pct{font-variant-numeric:tabular-nums;min-width:3.5ch;text-align:right;opacity:.85}
.bee-loader__track{position:relative;width:min(300px,72%);height:6px;border-radius:99px;
  background:rgba(156,220,248,.22);overflow:hidden}
.bee-loader__bar{height:100%;width:0;border-radius:99px;
  background:linear-gradient(90deg,var(--bee-accent),var(--bee-accent-soft));
  transition:width .18s ease}
.bee-loader__bar--indeterminate{animation:bee-loader-slide 1.1s ease-in-out infinite}
@keyframes bee-loader-slide{
  0%{width:12%;transform:translateX(-100%)}
  50%{width:55%;transform:translateX(40%)}
  100%{width:12%;transform:translateX(760%)}
}
@media (prefers-reduced-motion: reduce){
  .bee-loader__bar--indeterminate{animation-duration:2.4s}
}

/* ---------- guide / onboarding ---------- */
.bee-guide-ring{position:fixed;left:0;top:0;box-sizing:border-box;border:2.5px solid var(--bee-accent);
  border-radius:14px;pointer-events:none;opacity:0;z-index:9998;
  box-shadow:0 0 0 4px rgba(41,196,244,.18),0 0 26px rgba(41,196,244,.45);
  transition:transform .4s cubic-bezier(.22,1,.36,1),width .4s cubic-bezier(.22,1,.36,1),
    height .4s cubic-bezier(.22,1,.36,1),opacity .3s}
.bee-guide-ring.is-visible{opacity:1}
.bee-guide-card{position:fixed;left:0;top:0;width:min(300px,calc(100vw - 24px));box-sizing:border-box;
  background:var(--bee-surface);color:var(--bee-ink);border:1px solid var(--bee-line);
  border-radius:16px;padding:14px 16px 12px;box-shadow:var(--bee-shadow);z-index:9998;
  opacity:0;visibility:hidden;transition:transform .4s cubic-bezier(.22,1,.36,1),opacity .3s,visibility .3s}
.bee-guide-card.is-visible{opacity:1;visibility:visible}
.bee-guide-card__step{display:inline-block;font:700 11px/1 system-ui,sans-serif;letter-spacing:.08em;
  color:var(--bee-deep);background:rgba(41,196,244,.16);border-radius:99px;padding:5px 9px;margin-bottom:8px}
.bee-guide-card__title{display:block;font:700 15px/1.3 system-ui,sans-serif;margin-bottom:5px}
.bee-guide-card__text{margin:0 0 12px;font:400 13px/1.5 system-ui,sans-serif;opacity:.78}
.bee-guide-card__actions{display:flex;gap:8px;justify-content:flex-end}
.bee-guide-card .bee-btn{font:600 12.5px/1 system-ui,sans-serif;border-radius:9px;padding:9px 14px;
  border:1px solid var(--bee-line);background:transparent;color:var(--bee-ink);cursor:pointer;
  transition:transform .15s ease,background .15s ease}
.bee-guide-card .bee-btn:hover{transform:translateY(-1px)}
.bee-guide-card .bee-btn:disabled{opacity:.4;cursor:default;transform:none}
.bee-guide-card .bee-btn--primary{background:var(--bee-deep);border-color:var(--bee-deep);color:#eaf8ff}
.bee-guide-card .bee-btn--ghost:hover{background:rgba(0,54,78,.06)}
`;
