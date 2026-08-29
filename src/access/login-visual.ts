export const loginVisualStyles = String.raw`
:root {
  color-scheme: light;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  background: #e7e8eb;
  color: #242529;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --page: #e7e8eb;
  --text: #242529;
  --secondary: #666870;
  --tertiary: #85878f;
  --glass-top: rgb(255 255 255 / 58%);
  --glass-middle: rgb(248 249 252 / 24%);
  --glass-bottom: rgb(236 238 243 / 38%);
  --glass-line: rgb(255 255 255 / 82%);
  --glass-line-dim: rgb(61 63 70 / 11%);
  --glass-shadow: rgb(52 54 62 / 17%);
  --control: rgb(248 248 250 / 72%);
  --control-hover: rgb(255 255 255 / 88%);
  --control-line: rgb(76 78 86 / 20%);
  --focus: rgb(56 57 62 / 28%);
  --button: #292a2e;
  --button-hover: #17181b;
  --button-text: #fafafa;
  --error: #a33f49;
  --error-bg: rgb(255 238 240 / 82%);
  --error-line: rgb(163 63 73 / 22%);
  --notice: #765927;
  --notice-bg: rgb(255 247 225 / 82%);
  --notice-line: rgb(118 89 39 / 22%);
  --ease-out: cubic-bezier(.2, .78, .2, 1);
}

* { box-sizing: border-box; }
html { min-width: 280px; min-height: 100%; }
body {
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0;
  overflow: hidden auto;
  background:
    radial-gradient(circle at 17% 18%, rgb(255 255 255 / 70%), transparent 36%),
    linear-gradient(135deg, #e2e3e7 0%, var(--page) 52%, #dfe0e4 100%);
  color: var(--text);
}

button, input { -webkit-appearance: none; appearance: none; font: inherit; }
button { border: 0; }
::selection { background: rgb(53 54 59 / 16%); color: var(--text); }

.visual-scene {
  position: fixed;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.ripple-distortion-canvas {
  width: 100%;
  height: 100%;
  display: block;
  opacity: .96;
  filter: saturate(.78) contrast(.98);
}

.visual-scene::before,
.visual-scene::after {
  position: absolute;
  inset: 0;
  content: "";
}

.visual-scene::before {
  background:
    radial-gradient(circle at 16% 12%, rgb(255 255 255 / 22%), transparent 34%),
    linear-gradient(90deg, transparent 0 50%, rgb(231 232 235 / 7%) 70%, rgb(231 232 235 / 15%) 100%);
}

.visual-scene::after {
  opacity: .15;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.86' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
}

.access-layout {
  position: relative;
  z-index: 1;
  width: min(1080px, calc(100% - 48px));
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
  align-items: center;
  gap: clamp(42px, 8vw, 112px);
  padding: max(38px, env(safe-area-inset-top)) 0 max(38px, env(safe-area-inset-bottom));
}

.access-context {
  max-width: 500px;
  align-self: center;
  padding: 20px 0 18px;
  animation: context-enter 720ms var(--ease-out) both;
}

.wordmark,
.panel-wordmark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--secondary);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .16em;
}

.wordmark-mark {
  min-width: 44px;
  border: 1px solid rgb(55 56 61 / 22%);
  border-radius: 8px;
  padding: 5px 8px 4px;
  background: rgb(255 255 255 / 26%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 54%);
  color: var(--text);
  font-size: 11px;
  letter-spacing: .08em;
  text-align: center;
}

.scene-kicker {
  margin: clamp(62px, 12vh, 118px) 0 13px;
  color: var(--tertiary);
  font-size: 11px;
  font-weight: 620;
  letter-spacing: .15em;
}

.scene-title {
  max-width: 9ch;
  margin: 0;
  color: var(--text);
  font-size: clamp(42px, 5.6vw, 68px);
  font-weight: 660;
  line-height: .98;
  letter-spacing: -.055em;
  text-wrap: balance;
}

.scene-copy {
  max-width: 31em;
  margin: 24px 0 0;
  color: var(--secondary);
  font-size: 14px;
  line-height: 1.7;
  text-wrap: pretty;
}

.security-notes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 28px;
}

.security-notes span {
  border: 1px solid rgb(65 66 72 / 14%);
  border-radius: 9px;
  padding: 7px 10px;
  background: rgb(255 255 255 / 28%);
  color: var(--secondary);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 46%);
  font-size: 11px;
  line-height: 1;
}

.login-panel {
  position: relative;
  isolation: isolate;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--glass-line);
  border-radius: 28px;
  padding: 34px;
  background:
    radial-gradient(circle at 8% 0%, rgb(255 255 255 / 56%), transparent 38%),
    linear-gradient(148deg, var(--glass-top) 0%, var(--glass-middle) 48%, var(--glass-bottom) 100%);
  box-shadow:
    inset 1px 1px 0 rgb(255 255 255 / 82%),
    inset -1px -1px 0 var(--glass-line-dim),
    inset 0 18px 42px rgb(255 255 255 / 8%),
    0 2px 5px rgb(44 45 52 / 5%),
    0 28px 72px var(--glass-shadow);
  -webkit-backdrop-filter: saturate(1.38) contrast(1.025) blur(26px);
  backdrop-filter: saturate(1.38) contrast(1.025) blur(26px);
  animation: panel-enter 620ms var(--ease-out) 60ms both;
}

.login-panel::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(ellipse 82% 40% at 16% -5%, rgb(255 255 255 / 44%), transparent 68%),
    radial-gradient(ellipse 58% 28% at 92% 108%, rgb(74 76 84 / 8%), transparent 74%);
  pointer-events: none;
  content: "";
}

.login-panel::after {
  position: absolute;
  z-index: 2;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(142deg, rgb(255 255 255 / 92%), rgb(255 255 255 / 16%) 37%, rgb(255 255 255 / 42%) 66%, rgb(48 50 57 / 14%));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  content: "";
}

.login-panel > * {
  position: relative;
  z-index: 1;
}

.panel-wordmark { display: none; margin-bottom: 30px; }
.login-header { display: grid; gap: 0; margin-bottom: 28px; }
.login-kicker {
  margin: 0 0 11px;
  color: var(--tertiary);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .17em;
}

h1 {
  margin: 0;
  color: var(--text);
  font-size: 30px;
  font-weight: 660;
  line-height: 1.15;
  letter-spacing: -.035em;
}

.login-header > p:last-child,
.help {
  margin: 10px 0 0;
  color: var(--secondary);
  font-size: 13px;
  line-height: 1.6;
}

.message {
  position: relative;
  margin: 0 0 18px;
  border: 1px solid;
  border-radius: 13px;
  padding: 11px 12px 11px 36px;
  font-size: 12px;
  line-height: 1.5;
}

.message::before {
  position: absolute;
  top: 12px;
  left: 13px;
  width: 13px;
  height: 13px;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  content: "!";
}

.error { border-color: var(--error-line); background: var(--error-bg); color: var(--error); }
.notice { border-color: var(--notice-line); background: var(--notice-bg); color: var(--notice); }

.password-label {
  display: grid;
  margin-bottom: 10px;
  color: var(--text);
  font-size: 12px;
  font-weight: 620;
}

.password-control {
  position: relative;
  display: grid;
  align-items: center;
  border: 1px solid var(--control-line);
  border-radius: 14px;
  background: var(--control);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 72%),
    0 1px 2px rgb(37 38 43 / 4%);
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    box-shadow 220ms ease,
    transform 220ms var(--ease-out);
}

.password-control:hover { border-color: rgb(68 69 75 / 34%); background: var(--control-hover); }
.password-control:focus-within {
  border-color: rgb(53 54 59 / 48%);
  background: var(--control-hover);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 86%),
    0 0 0 4px var(--focus),
    0 8px 24px rgb(48 49 55 / 8%);
  transform: translateY(-1px);
}

input {
  width: 100%;
  height: 52px;
  min-width: 0;
  margin: 0;
  border: 0;
  border-radius: inherit;
  outline: 0;
  padding: 0 50px 0 15px;
  background: transparent;
  color: var(--text);
  caret-color: var(--text);
  font-size: 15px;
  line-height: 1;
}

input::placeholder { color: var(--tertiary); opacity: .84; }
input:disabled { color: var(--tertiary); cursor: not-allowed; }

.password-toggle {
  position: absolute;
  right: 6px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: transparent;
  color: var(--tertiary);
  cursor: pointer;
  transition: color 160ms ease, background-color 160ms ease, transform 160ms var(--ease-out);
}

.password-toggle:hover:not(:disabled) { background: rgb(53 54 59 / 7%); color: var(--text); }
.password-toggle:active:not(:disabled) { transform: scale(.94); }
.password-toggle:disabled { cursor: not-allowed; opacity: .45; }
.password-toggle:focus-visible { outline: 2px solid var(--text); outline-offset: 1px; }

.eye-glyph {
  position: relative;
  width: 18px;
  height: 12px;
  display: block;
  border: 1.5px solid currentColor;
  border-radius: 70% 28% 70% 28%;
  transform: rotate(45deg);
}

.eye-glyph::after {
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: currentColor;
  content: "";
}

.password-toggle[aria-pressed="true"] .eye-glyph::before {
  position: absolute;
  top: 4px;
  left: -3px;
  width: 22px;
  height: 1.5px;
  background: currentColor;
  transform: rotate(-45deg);
  content: "";
}

.submit-button {
  position: relative;
  width: 100%;
  height: 50px;
  overflow: hidden;
  margin: 18px 0 0;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 14px;
  padding: 0 18px;
  background: var(--button);
  color: var(--button-text);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 13%),
    0 1px 2px rgb(0 0 0 / 13%),
    0 10px 24px rgb(35 36 41 / 16%);
  font-size: 14px;
  font-weight: 650;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color 180ms ease,
    box-shadow 220ms ease,
    transform 180ms var(--ease-out);
}

.submit-button::after {
  position: absolute;
  top: -120%;
  left: -32%;
  width: 30%;
  height: 340%;
  opacity: 0;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 20%), transparent);
  transform: rotate(19deg) translateX(-220%);
  transition: opacity 180ms ease, transform 720ms var(--ease-out);
  content: "";
}

button:hover:not(:disabled) { background-color: var(--button-hover); }
.submit-button:hover:not(:disabled) {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 16%),
    0 2px 3px rgb(0 0 0 / 16%),
    0 14px 30px rgb(35 36 41 / 21%);
  transform: translateY(-1px);
}
.submit-button:hover:not(:disabled)::after { opacity: 1; transform: rotate(19deg) translateX(620%); }
.submit-button:active:not(:disabled) { transform: translateY(1px) scale(.992); }
.submit-button:focus-visible { outline: 2px solid var(--text); outline-offset: 3px; }
.submit-button:disabled { background: #a7a8ad; color: #eeeef0; box-shadow: none; cursor: not-allowed; }

.help {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 20px;
  color: var(--tertiary);
  font-size: 11px;
  text-align: center;
}

.help::before {
  width: 6px;
  height: 6px;
  border: 1px solid currentColor;
  border-radius: 50%;
  content: "";
}

@keyframes panel-enter {
  from { opacity: 0; transform: translate3d(0, 18px, 0) scale(.975); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}

@keyframes context-enter {
  from { opacity: 0; transform: translate3d(-12px, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --page: #111215;
    --text: #f0f0f2;
    --secondary: #b7b8be;
    --tertiary: #85868e;
    --glass-top: rgb(68 69 75 / 46%);
    --glass-middle: rgb(34 35 40 / 24%);
    --glass-bottom: rgb(20 21 25 / 42%);
    --glass-line: rgb(255 255 255 / 18%);
    --glass-line-dim: rgb(0 0 0 / 28%);
    --glass-shadow: rgb(0 0 0 / 46%);
    --control: rgb(17 18 21 / 50%);
    --control-hover: rgb(26 27 31 / 66%);
    --control-line: rgb(255 255 255 / 14%);
    --focus: rgb(255 255 255 / 15%);
    --button: #f0f0f2;
    --button-hover: #ffffff;
    --button-text: #1d1e22;
    --error: #ff9aa3;
    --error-bg: rgb(86 34 42 / 58%);
    --error-line: rgb(255 154 163 / 24%);
    --notice: #e0c188;
    --notice-bg: rgb(82 65 32 / 56%);
    --notice-line: rgb(224 193 136 / 23%);
  }
  body {
    background:
      radial-gradient(circle at 16% 16%, rgb(57 49 44 / 44%), transparent 38%),
      linear-gradient(135deg, #101114 0%, var(--page) 54%, #17181c 100%);
  }
  ::selection { background: rgb(255 255 255 / 18%); }
  .ripple-distortion-canvas { opacity: .98; filter: saturate(.82) contrast(1.03); }
  .visual-scene::before {
    background:
      radial-gradient(circle at 16% 12%, rgb(94 82 74 / 12%), transparent 36%),
      linear-gradient(90deg, transparent 0 50%, rgb(17 18 21 / 5%) 70%, rgb(17 18 21 / 18%) 100%);
  }
  .visual-scene::after { opacity: .22; }
  .wordmark-mark, .security-notes span { border-color: rgb(255 255 255 / 13%); background: rgb(255 255 255 / 5%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 7%); }
  .login-panel { box-shadow: inset 1px 1px 0 rgb(255 255 255 / 16%), inset -1px -1px 0 rgb(0 0 0 / 28%), inset 0 18px 42px rgb(255 255 255 / 3%), 0 2px 5px rgb(0 0 0 / 18%), 0 30px 82px var(--glass-shadow); }
  .login-panel::before { background: radial-gradient(ellipse 82% 40% at 16% -5%, rgb(255 255 255 / 13%), transparent 68%), radial-gradient(ellipse 58% 28% at 92% 108%, rgb(0 0 0 / 18%), transparent 74%); }
  .login-panel::after { background: linear-gradient(142deg, rgb(255 255 255 / 28%), rgb(255 255 255 / 5%) 37%, rgb(255 255 255 / 13%) 66%, rgb(0 0 0 / 34%)); }
  .password-control { box-shadow: inset 0 1px 0 rgb(255 255 255 / 7%), 0 1px 2px rgb(0 0 0 / 12%); }
  .password-control:hover { border-color: rgb(255 255 255 / 22%); }
  .password-control:focus-within { border-color: rgb(255 255 255 / 34%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 9%), 0 0 0 4px var(--focus), 0 10px 30px rgb(0 0 0 / 22%); }
  .password-toggle:hover:not(:disabled) { background: rgb(255 255 255 / 8%); }
  .submit-button { border-color: rgb(255 255 255 / 72%); box-shadow: inset 0 1px 0 #fff, 0 2px 3px rgb(0 0 0 / 24%), 0 12px 28px rgb(0 0 0 / 28%); }
  .submit-button::after { background: linear-gradient(90deg, transparent, rgb(255 255 255 / 58%), transparent); }
  .submit-button:disabled { background: #55565c; border-color: #55565c; color: #96979d; }
}

@media (max-width: 760px) {
  body { overflow-y: auto; }
  .access-layout {
    width: min(100% - 28px, 430px);
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    padding: max(28px, env(safe-area-inset-top)) 0 max(28px, env(safe-area-inset-bottom));
  }
  .access-context { display: none; }
  .panel-wordmark { display: inline-flex; }
  .login-panel { border-radius: 24px; padding: 30px 26px; }
  .visual-scene::before {
    background:
      linear-gradient(180deg, transparent 0 24%, rgb(231 232 235 / 56%) 49%, rgb(231 232 235 / 92%) 76%),
      radial-gradient(circle at 50% 22%, transparent 0 18%, rgb(231 232 235 / 74%) 55%);
  }
}

@media (max-width: 380px) {
  .access-layout { width: calc(100% - 20px); }
  .login-panel { border-radius: 21px; padding: 26px 20px; }
  .panel-wordmark { margin-bottom: 25px; }
  h1 { font-size: 27px; }
}

@media (prefers-reduced-transparency: reduce) {
  .login-panel { background: #f7f7f9; -webkit-backdrop-filter: none; backdrop-filter: none; }
  .password-control { background: #fff; }
  @media (prefers-color-scheme: dark) {
    .login-panel { background: #25262b; }
    .password-control { background: #17181b; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .access-context, .login-panel { animation: none; }
  .password-control, .password-toggle, .submit-button, .submit-button::after { transition-duration: .01ms; }
}
`

export const loginVisualScript = String.raw`
(() => {
  const password = document.querySelector('[data-password-input]')
  const toggle = document.querySelector('[data-password-toggle]')
  if (password instanceof HTMLInputElement && toggle instanceof HTMLButtonElement) {
    toggle.addEventListener('click', () => {
      const visible = password.type === 'text'
      password.type = visible ? 'password' : 'text'
      toggle.setAttribute('aria-pressed', String(!visible))
      toggle.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码')
      password.focus({ preventScroll: true })
      password.setSelectionRange(password.value.length, password.value.length)
    })
  }

  const canvas = document.querySelector('[data-ripple-distortion]')
  if (!(canvas instanceof HTMLCanvasElement)) return
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
  if (gl === null) {
    document.documentElement.dataset.rippleFallback = 'true'
    return
  }

  const screenVertexSource = [
    'attribute vec2 position;',
    'void main(){gl_Position=vec4(position,0.0,1.0);}'
  ].join('\n')
  const brushVertexSource = [
    'attribute vec2 position;',
    'attribute vec2 uv;',
    'attribute float opacity;',
    'varying vec2 vUv;',
    'varying float vOpacity;',
    'void main(){vUv=uv;vOpacity=opacity;gl_Position=vec4(position,0.0,1.0);}'
  ].join('\n')
  const brushFragmentSource = [
    'precision highp float;',
    'varying vec2 vUv;',
    'varying float vOpacity;',
    'uniform float uRings;',
    'const float PI=3.141592653589793;',
    'const float EDGE=0.006737947;',
    'void main(){',
    'vec2 p=vUv*2.0-1.0;',
    'float radiusSquared=dot(p,p);',
    'if(radiusSquared>1.0)discard;',
    'float brush=(exp(-radiusSquared*5.0)-EDGE)/(1.0-EDGE);',
    'brush*=0.55+0.45*cos(sqrt(radiusSquared)*PI*2.0*uRings);',
    'gl_FragColor=vec4(vec3(brush*vOpacity*vOpacity),1.0);',
    '}'
  ].join('\n')
  const compositeFragmentSource = [
    'precision highp float;',
    'uniform float uTime;',
    'uniform vec2 uResolution;',
    'uniform vec2 uTexel;',
    'uniform sampler2D uDisplacement;',
    'uniform float uDark;',
    'uniform float uStrength;',
    'uniform float uSwirl;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
    'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(17.7,9.2);a*=0.5;}return v;}',
    'vec3 surface(vec2 uv,float dark){',
    'vec2 p=(uv-0.5)*vec2(uResolution.x/uResolution.y,1.0);',
    'float drift=fbm(p*2.15+vec2(uTime*0.012,-uTime*0.009));',
    'float fine=fbm(p*5.2+vec2(-uTime*0.007,uTime*0.011));',
    'float fold=0.5+0.5*sin(p.y*7.4+p.x*2.2+drift*4.1);',
    'float contour=pow(1.0-abs(fold*2.0-1.0),7.0)*(0.34+0.66*fine);',
    'float vignette=1.0-smoothstep(0.12,1.15,length(p*vec2(0.74,1.0)));',
    'vec3 lightBase=mix(vec3(0.825,0.833,0.848),vec3(0.955,0.958,0.966),0.36+0.45*drift+0.11*vignette);',
    'lightBase-=vec3(0.065,0.058,0.050)*contour*0.34;',
    'vec3 darkBase=mix(vec3(0.035,0.037,0.043),vec3(0.125,0.116,0.111),0.25+0.62*drift);',
    'darkBase+=vec3(0.12,0.075,0.045)*contour*0.16;',
    'return mix(lightBase,darkBase,dark);',
    '}',
    'void main(){',
    'vec2 uv=gl_FragCoord.xy/uResolution.xy;',
    'float amount=texture2D(uDisplacement,uv).r;',
    'float theta=amount*uSwirl*6.283185307179586;',
    'vec2 direction=vec2(sin(theta),cos(theta));',
    'vec2 warped=uv+direction*amount*uStrength;',
    'vec3 color=surface(warped,uDark);',
    'float edgeX=texture2D(uDisplacement,uv+vec2(uTexel.x,0.0)).r-texture2D(uDisplacement,uv-vec2(uTexel.x,0.0)).r;',
    'float edgeY=texture2D(uDisplacement,uv+vec2(0.0,uTexel.y)).r-texture2D(uDisplacement,uv-vec2(0.0,uTexel.y)).r;',
    'vec3 normal=normalize(vec3(-edgeX*26.0,-edgeY*26.0,1.0));',
    'vec3 light=normalize(vec3(-0.35,0.55,1.0));',
    'float glint=pow(max(dot(normal,light),0.0),22.0);',
    'float flatGlint=pow(max(light.z,0.0),22.0);',
    'vec3 highlight=mix(vec3(0.98,0.97,0.95),vec3(0.82,0.55,0.34),uDark);',
    'color+=highlight*clamp((glint-flatGlint)/max(1.0-flatGlint,0.0001),0.0,1.0)*0.16;',
    'gl_FragColor=vec4(color,1.0);',
    '}'
  ].join('\n')

  const shader = (type, source) => {
    const value = gl.createShader(type)
    if (value === null) return null
    gl.shaderSource(value, source)
    gl.compileShader(value)
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
      gl.deleteShader(value)
      return null
    }
    return value
  }
  const program = (vertexSource, fragmentSource) => {
    const vertex = shader(gl.VERTEX_SHADER, vertexSource)
    const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource)
    const value = gl.createProgram()
    if (vertex === null || fragment === null || value === null) return null
    gl.attachShader(value, vertex)
    gl.attachShader(value, fragment)
    gl.linkProgram(value)
    if (!gl.getProgramParameter(value, gl.LINK_STATUS)) {
      gl.deleteProgram(value)
      return null
    }
    return value
  }
  const brushProgram = program(brushVertexSource, brushFragmentSource)
  const compositeProgram = program(screenVertexSource, compositeFragmentSource)
  const displacementTexture = gl.createTexture()
  const displacementFramebuffer = gl.createFramebuffer()
  const screenBuffer = gl.createBuffer()
  const brushBuffer = gl.createBuffer()
  if (brushProgram === null || compositeProgram === null || displacementTexture === null || displacementFramebuffer === null || screenBuffer === null || brushBuffer === null) {
    document.documentElement.dataset.rippleFallback = 'true'
    return
  }

  const rippleConfig = Object.freeze({
    maxWaves: 100,
    brushSize: 150,
    strength: 0.2,
    swirl: 1,
    rings: 4,
    spread: 5,
    fade: 3,
    spacing: 15,
    qualityScale: 0.4,
    ambientDelayMin: 1800,
    ambientDelayMax: 3200
  })

  gl.bindBuffer(gl.ARRAY_BUFFER, screenBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const waveLimit = rippleConfig.maxWaves
  const floatsPerVertex = 5
  const verticesPerWave = 6
  const waveVertices = new Float32Array(waveLimit * verticesPerWave * floatsPerVertex)
  gl.bindBuffer(gl.ARRAY_BUFFER, brushBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, waveVertices.byteLength, gl.DYNAMIC_DRAW)

  gl.bindTexture(gl.TEXTURE_2D, displacementTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindFramebuffer(gl.FRAMEBUFFER, displacementFramebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, displacementTexture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  const brushAttributes = {
    position: gl.getAttribLocation(brushProgram, 'position'),
    uv: gl.getAttribLocation(brushProgram, 'uv'),
    opacity: gl.getAttribLocation(brushProgram, 'opacity')
  }
  const brushUniforms = { rings: gl.getUniformLocation(brushProgram, 'uRings') }
  const compositeAttributes = { position: gl.getAttribLocation(compositeProgram, 'position') }
  const compositeUniforms = {
    time: gl.getUniformLocation(compositeProgram, 'uTime'),
    resolution: gl.getUniformLocation(compositeProgram, 'uResolution'),
    texel: gl.getUniformLocation(compositeProgram, 'uTexel'),
    displacement: gl.getUniformLocation(compositeProgram, 'uDisplacement'),
    dark: gl.getUniformLocation(compositeProgram, 'uDark'),
    strength: gl.getUniformLocation(compositeProgram, 'uStrength'),
    swirl: gl.getUniformLocation(compositeProgram, 'uSwirl')
  }
  const darkMode = matchMedia('(prefers-color-scheme: dark)')
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const waves = Array.from({ length: rippleConfig.maxWaves }, () => ({ x: 0, y: 0, scale: 1.5, target: 1.5, size: 1, opacity: 0 }))
  let waveCursor = 0
  let lastPointerX = Number.NaN
  let lastPointerY = Number.NaN
  let ambientSeeded = false
  let nextAmbientAt = performance.now() + 700
  let previousFrameAt = 0
  let viewportWidth = 1
  let viewportHeight = 1
  let fieldWidth = 1
  let fieldHeight = 1
  let frame = 0
  let startedAt = performance.now()
  let visible = !document.hidden

  const setWave = (x, y, power) => {
    const wave = waves[waveCursor]
    waveCursor = (waveCursor + 1) % waveLimit
    wave.x = x
    wave.y = y
    wave.scale = 1.5 * power
    wave.target = 1.5 * rippleConfig.spread * power
    wave.size = rippleConfig.brushSize
    wave.opacity = 1
  }

  const resize = () => {
    const scale = Math.min(devicePixelRatio || 1, 1.35)
    viewportWidth = Math.max(1, innerWidth)
    viewportHeight = Math.max(1, innerHeight)
    const width = Math.max(1, Math.round(viewportWidth * scale))
    const height = Math.max(1, Math.round(viewportHeight * scale))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      fieldWidth = Math.max(2, Math.round(viewportWidth * rippleConfig.qualityScale))
      fieldHeight = Math.max(2, Math.round(viewportHeight * rippleConfig.qualityScale))
      gl.bindTexture(gl.TEXTURE_2D, displacementTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fieldWidth, fieldHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }
  }

  const writeVertex = (offset, x, y, u, v, opacity) => {
    waveVertices[offset] = x
    waveVertices[offset + 1] = y
    waveVertices[offset + 2] = u
    waveVertices[offset + 3] = v
    waveVertices[offset + 4] = opacity
  }

  const updateWaveGeometry = delta => {
    const growth = reducedMotion.matches ? 0 : 1 - Math.exp(-delta * 1.09)
    const decay = reducedMotion.matches ? 0 : Math.exp((-delta * Math.log(500)) / rippleConfig.fade)
    let vertexCount = 0
    for (const wave of waves) {
      if (wave.opacity <= 0) continue
      wave.opacity *= decay
      wave.scale += (wave.target - wave.scale) * growth
      if (wave.opacity < 0.002) {
        wave.opacity = 0
        continue
      }
      const half = wave.scale * wave.size * 0.5
      const centerX = wave.x / viewportWidth * 2 - 1
      const centerY = wave.y / viewportHeight * 2 - 1
      const halfX = half / viewportWidth * 2
      const halfY = half / viewportHeight * 2
      const left = centerX - halfX
      const right = centerX + halfX
      const bottom = centerY - halfY
      const top = centerY + halfY
      let offset = vertexCount * floatsPerVertex
      writeVertex(offset, left, bottom, 0, 0, wave.opacity); offset += floatsPerVertex
      writeVertex(offset, right, bottom, 1, 0, wave.opacity); offset += floatsPerVertex
      writeVertex(offset, left, top, 0, 1, wave.opacity); offset += floatsPerVertex
      writeVertex(offset, left, top, 0, 1, wave.opacity); offset += floatsPerVertex
      writeVertex(offset, right, bottom, 1, 0, wave.opacity); offset += floatsPerVertex
      writeVertex(offset, right, top, 1, 1, wave.opacity)
      vertexCount += verticesPerWave
    }
    return vertexCount
  }

  const renderDisplacement = vertexCount => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, displacementFramebuffer)
    gl.viewport(0, 0, fieldWidth, fieldHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (vertexCount > 0) {
      gl.useProgram(brushProgram)
      gl.uniform1f(brushUniforms.rings, rippleConfig.rings)
      gl.bindBuffer(gl.ARRAY_BUFFER, brushBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, waveVertices.subarray(0, vertexCount * floatsPerVertex))
      const stride = floatsPerVertex * Float32Array.BYTES_PER_ELEMENT
      gl.enableVertexAttribArray(brushAttributes.position)
      gl.vertexAttribPointer(brushAttributes.position, 2, gl.FLOAT, false, stride, 0)
      gl.enableVertexAttribArray(brushAttributes.uv)
      gl.vertexAttribPointer(brushAttributes.uv, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT)
      gl.enableVertexAttribArray(brushAttributes.opacity)
      gl.vertexAttribPointer(brushAttributes.opacity, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount)
      gl.disable(gl.BLEND)
    }
  }

  const renderComposite = time => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(compositeProgram)
    gl.bindBuffer(gl.ARRAY_BUFFER, screenBuffer)
    gl.enableVertexAttribArray(compositeAttributes.position)
    gl.vertexAttribPointer(compositeAttributes.position, 2, gl.FLOAT, false, 0, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, displacementTexture)
    gl.uniform1i(compositeUniforms.displacement, 0)
    gl.uniform1f(compositeUniforms.time, time)
    gl.uniform2f(compositeUniforms.resolution, canvas.width, canvas.height)
    gl.uniform2f(compositeUniforms.texel, 1 / fieldWidth, 1 / fieldHeight)
    gl.uniform1f(compositeUniforms.dark, darkMode.matches ? 1 : 0)
    gl.uniform1f(compositeUniforms.strength, rippleConfig.strength)
    gl.uniform1f(compositeUniforms.swirl, rippleConfig.swirl)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const draw = now => {
    resize()
    const time = (now - startedAt) * 0.001
    if (!reducedMotion.matches && !ambientSeeded) {
      setWave(viewportWidth * 0.22, viewportHeight * 0.62, 0.78)
      setWave(viewportWidth * 0.71, viewportHeight * 0.31, 0.66)
      ambientSeeded = true
    }
    if (!reducedMotion.matches && now >= nextAmbientAt) {
      setWave(
        viewportWidth * (0.08 + Math.random() * 0.84),
        viewportHeight * (0.12 + Math.random() * 0.76),
        0.68 + Math.random() * 0.22
      )
      nextAmbientAt = now + rippleConfig.ambientDelayMin + Math.random() * (rippleConfig.ambientDelayMax - rippleConfig.ambientDelayMin)
    }
    const delta = previousFrameAt ? Math.min(0.05, (now - previousFrameAt) / 1000) : 0
    previousFrameAt = now
    const vertexCount = updateWaveGeometry(delta)
    renderDisplacement(vertexCount)
    renderComposite(time)
  }
  const animate = now => {
    frame = 0
    draw(now)
    if (visible && !reducedMotion.matches) frame = requestAnimationFrame(animate)
  }
  const start = () => {
    if (frame !== 0) return
    frame = requestAnimationFrame(animate)
  }
  const renderStatic = () => {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
    draw(performance.now())
  }
  addEventListener('pointermove', event => {
    if (reducedMotion.matches) return
    const x = event.clientX
    const y = viewportHeight - event.clientY
    if (!Number.isFinite(lastPointerX) || !Number.isFinite(lastPointerY)) {
      setWave(x, y, 1)
      lastPointerX = x
      lastPointerY = y
      return
    }
    const distance = Math.hypot(x - lastPointerX, y - lastPointerY)
    if (distance <= rippleConfig.spacing) return
    setWave(x, y, 1)
    lastPointerX = x
    lastPointerY = y
  }, { passive: true })
  addEventListener('pointerleave', () => {
    lastPointerX = Number.NaN
    lastPointerY = Number.NaN
  }, { passive: true })
  addEventListener('resize', reducedMotion.matches ? renderStatic : start, { passive: true })
  darkMode.addEventListener('change', reducedMotion.matches ? renderStatic : start)
  reducedMotion.addEventListener('change', event => { if (event.matches) renderStatic(); else { startedAt = performance.now(); start() } })
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden
    if (visible) start()
    else if (frame !== 0) { cancelAnimationFrame(frame); frame = 0 }
  })
  if (reducedMotion.matches) renderStatic(); else start()
})()
`
