/* 설치 배치도의 짧은 반복 애니메이션 (10초).
 * 평면도: 한 사람이 멀리서 다가온다. 점선(인식 시작)을 넘으면 점선이 밝아지고, 바로 앞 선에 닿으면 그 선도 밝아진다.
 * 정면도: 사람이 인식되는 순간 새 한 마리가 화면 오른쪽에서 날아와 카메라 위에 내려앉아 빛난다.
 * 카메라에서는 몇 초마다 옅은 파문이 부채꼴 안으로 퍼진다. 움직임 줄이기 설정이면 새가 내려앉은 장면에 멈춘다. */
(() => {
  'use strict';
  const svg = document.querySelector('.plan svg');
  if (!svg) return;
  const $ = id => document.getElementById(id);
  const visitor = $('planVisitor'), bird = $('planBird'), wing = $('planWing'), glow = $('planGlow');
  const near = $('planNear'), far = $('planFar'), ring = $('planRing');
  if (!visitor || !bird || !near || !far || !ring) return;

  const LOOP = 10, CX = 651, CY = 537, SPAN = 37;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // 걸음: 천천히 출발해 천천히 멈춤
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const polar = (r, deg) => { const a = deg * Math.PI / 180; return [CX + r * Math.sin(a), CY + r * Math.cos(a)]; };
  const arc = r => { const [x0, y0] = polar(r, -SPAN), [x1, y1] = polar(r, SPAN); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 0 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };

  function render(tt) {
    const t = ((tt % LOOP) + LOOP) % LOOP;
    // 1) 사람: 0.6초부터 6.2초까지 멀리(330)에서 바로 앞(82)으로, 8.4초부터 사라짐
    const u = easeInOut(smooth(.6, 6.2, t));
    const r = lerp(330, 82, u), deg = lerp(22, 3, u);
    const vis = smooth(.2, 1, t) * (1 - smooth(8.4, 9.4, t));
    const [vx, vy] = polar(r, deg);
    visitor.setAttribute('transform', `translate(${vx.toFixed(1)} ${vy.toFixed(1)})`);
    visitor.setAttribute('opacity', vis.toFixed(3));

    // 2) 두 선의 반응: 점선을 넘으면(인식 시작) 점선이, 바로 앞에 오면 실선이 밝아짐
    const fLit = smooth(252, 226, r) * vis, nLit = smooth(116, 92, r) * vis;
    far.setAttribute('opacity', (.55 + .45 * fLit).toFixed(3));
    far.setAttribute('stroke-width', (1.6 + .8 * fLit).toFixed(2));
    near.setAttribute('opacity', (.55 + .45 * nLit).toFixed(3));
    near.setAttribute('stroke-width', (2.5 + 1 * nLit).toFixed(2));

    // 3) 새: 인식되면 화면 오른쪽에서 날아와 카메라 위(화면 아래 가운데)에 내려앉음
    const p = easeOut(smooth(240, 96, r));
    const bx = lerp(1040, 700, p), by = lerp(150, 262, p) + Math.sin(t * 2.4) * 3 * (1 - nLit);
    const bVis = smooth(0, .12, smooth(250, 226, r)) * vis;
    const flap = (.5 + .5 * Math.sin(t * 15)) * (1 - nLit) + .12 * nLit;   // 앉으면 날개를 접음
    const tip = [-12 + flap * 2, -4 - 21 * flap + (1 - flap) * 6];
    wing.setAttribute('d', `M-3 0L${tip[0].toFixed(1)} ${tip[1].toFixed(1)}L5-2`);
    bird.setAttribute('transform', `translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(1.7)`);
    bird.setAttribute('opacity', bVis.toFixed(3));
    glow.setAttribute('opacity', (.22 * nLit * (.85 + .15 * Math.sin(t * 3))).toFixed(3));

    // 4) 카메라의 파문: 3.3초마다 한 번, 부채꼴 끝까지 퍼지며 옅어짐
    const k = (t % 3.3) / 2.6;
    if (k < 1) { ring.setAttribute('d', arc(24 + 234 * easeOut(k))); ring.setAttribute('opacity', (.45 * (1 - k)).toFixed(3)); }
    else ring.setAttribute('opacity', '0');
  }
  window.__plan = render;

  // 좁은 화면에서는 배치도를 옆으로 밀어 볼 수 있게 두되, 처음엔 가운데(카메라 쪽)가 보이게 맞춤
  const sc = svg.parentElement;
  const center = () => { if (sc.scrollWidth > sc.clientWidth) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; };
  center(); new ResizeObserver(center).observe(sc);

  if (REDUCE) { render(7); return; }
  let visible = false, raf = 0, t0 = performance.now();
  const loop = now => { raf = 0; if (!visible) return; render((now - t0) / 1000); raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(svg);
  render(0);
})();
