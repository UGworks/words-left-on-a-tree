/* 히어로 배경: 작품의 새(접힌 선으로 된 새)가 날아가는 모습을 검은 LED 하프톤(가로 주사선의 점)으로 매 프레임 그린다.
 * 작품에서 새는 관객이 쓴 말을 물고 빈 가지로 날아간다. 여기서는 몇 마리가 서로 다른 깊이로 화면을 가로지른다.
 * 가까운 새는 크고 빠르고, 먼 새는 작고 느리다. 날갯짓하다 가끔 활공하고, 몇 줄이 옆으로 밀리는 글리치가 지나간다.
 * 24초마다 같은 장면으로 돌아오며, window.__render(t)로 시간을 직접 지정할 수 있다. */
(() => {
  'use strict';
  const LOOP = 24;
  const LEVELS = [0, .26, .52, .78, 1];
  const INK = '#0d0d0d';
  const TAU = Math.PI * 2;

  const cv = document.getElementById('dots');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // 새마다: 높이, 위아래 흔들림, 크기(깊이), 한 루프 동안 화면을 건너는 횟수, 날갯짓 횟수, 위상
  // 건너는 횟수·날갯짓 횟수를 정수로 두어 24초 루프가 끊김 없이 이어짐
  const BIRDS = [
    { y: .64, amp: .040, s: 1.55, cross: 2, flap: 44, ph: .10, bob: 2 },
    { y: .24, amp: .030, s: 1.05, cross: 1, flap: 52, ph: .55, bob: 1 },
    { y: .78, amp: .030, s: .80, cross: 1, flap: 58, ph: .30, bob: 2 },
    { y: .19, amp: .020, s: .62, cross: 1, flap: 64, ph: .82, bob: 3 },
    { y: .45, amp: .035, s: .92, cross: 1, flap: 56, ph: .02, bob: 1 },
    { y: .70, amp: .025, s: .58, cross: 1, flap: 66, ph: .66, bob: 2 },
  ];

  let W = 0, H = 0, DPR = 1, step = 7, rowStep = 14, cols = 0, rows = 0, R = 3, portrait = false;
  let seeds = null, field = null, fx = null;

  function resize() {
    const r = cv.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    step = Math.max(5, W / 205); rowStep = step * 2.05;
    cols = Math.ceil(W / step); rows = Math.ceil(H / rowStep);
    R = step * .46; portrait = H > W;
    seeds = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) seeds[j * cols + i] = .55 * hash(i, j) + .45 * hash(j * 3.1, 7.7);
    field = document.createElement('canvas'); field.width = cols; field.height = rows;
    fx = field.getContext('2d', { willReadFrequently: true });
  }

  // 작품의 새와 같은 모양: 몸통 선, 꼬리, 두 날개 (f: 0 내림 ~ 1 올림)
  function drawBird(g, x, y, s, f, tilt) {
    const U = W / 175 * s;
    g.save(); g.translate(x, y); g.rotate(tilt); g.scale(U, U);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const tip1 = [-12 + f * 2, -4 - 21 * f + (1 - f) * 6], tip2 = [4 + f * 4, -3 - 15 * f + (1 - f) * 5];
    // 먼 날개: 옅은 면
    g.fillStyle = '#b4b4b4'; g.beginPath(); g.moveTo(1, -1); g.lineTo(tip2[0], tip2[1]); g.lineTo(8, -2); g.closePath(); g.fill();
    // 가까운 날개: 조금 짙은 면 + 테두리
    g.fillStyle = '#8a8a8a'; g.beginPath(); g.moveTo(-3, 0); g.lineTo(tip1[0], tip1[1]); g.lineTo(5, -2); g.closePath(); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 2.9;
    g.beginPath(); g.moveTo(-3, 0); g.lineTo(tip1[0], tip1[1]); g.lineTo(5, -2); g.stroke();
    g.lineWidth = 2.2; g.beginPath(); g.moveTo(1, -1); g.lineTo(tip2[0], tip2[1]); g.lineTo(8, -2); g.stroke();
    // 몸통과 꼬리
    g.lineWidth = 3.4; g.beginPath(); g.moveTo(-16, 5); g.lineTo(10, -3); g.lineTo(17, -2); g.moveTo(-16, 5); g.lineTo(-7, 1.5); g.stroke();
    g.restore();
  }

  function render(tt) {
    const t = ((tt % LOOP) + LOOP) % LOOP;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // 1) 점 하나 = 픽셀 하나인 작은 밭에 새를 그림
    fx.setTransform(1, 0, 0, 1, 0, 0); fx.fillStyle = '#fff'; fx.fillRect(0, 0, cols, rows);
    fx.setTransform(cols / W, 0, 0, rows / H, 0, 0);
    const order = BIRDS.map((b, k) => [b.s, k]).sort((a, b) => a[0] - b[0]);   // 먼 새부터
    for (const [, k] of order) {
      const b = BIRDS[k], span = 1.5;
      const u = ((t / LOOP) * b.cross + b.ph) % 1;                 // 0 → 1: 왼쪽 밖에서 오른쪽 밖으로
      const x = (u * span - .25) * W;
      const yy = (portrait ? .1 + b.y * .8 : b.y) * H;
      const bob = Math.sin(TAU * (t / LOOP * b.bob) + k * 1.7);
      const y = yy + b.amp * H * bob;
      const vy = b.amp * H * Math.cos(TAU * (t / LOOP * b.bob) + k * 1.7) * TAU * b.bob / LOOP;
      const vx = span * W * b.cross / LOOP;
      const glide = smooth(.35, .8, Math.sin(TAU * (t / LOOP * 2) + k * 2.3));   // 가끔 날개를 편 채 활공
      const flap = .5 + .5 * Math.sin(TAU * (t / LOOP) * b.flap + k);
      const f = flap * (1 - glide) + .34 * glide;
      const tilt = Math.max(-.35, Math.min(.35, Math.atan2(vy, vx))) * .8;
      drawBird(fx, x, y, b.s * (portrait ? 1.35 : 1), f, tilt);
    }
    const d = fx.getImageData(0, 0, cols, rows).data;

    // 2) 밝기 → 다섯 크기의 점
    const tick = Math.floor(t * 7);
    // 제목·부제·버튼이 들어가는 타원 (가로 반지름 qzW, 세로 중심 qzC, 세로 반지름 qzH)
    const qzW = portrait ? .46 : .25, qzC = portrait ? .3 : .38, qzH = portrait ? .17 : .225;
    ctx.fillStyle = INK; ctx.beginPath();
    for (let j = 0; j < rows; j++) {
      const shift = hash(j, tick) > .965 ? Math.round((hash(tick, j) - .5) * 8) : 0;   // 가끔 줄 하나가 옆으로 밀림
      const y = (j + .5) * rowStep;
      const ey = ((j + .5) * rowStep / H - qzC) / qzH;
      for (let i = 0; i < cols; i++) {
        const si = Math.min(cols - 1, Math.max(0, i - shift));
        let v = (1 - d[(j * cols + si) * 4] / 255 - .16) / .42;
        if (v <= 0) continue;
        if (v > 1) v = 1;
        const seed = seeds[j * cols + i];
        v *= .86 + .14 * Math.sin(t * 3.2 + seed * 40);
        const cx = Math.abs((i + .5) / cols - .5);
        v *= smooth(.78, 1.12, Math.hypot(cx / qzW, ey));   // 제목 주변은 비워 둠 (새가 글 뒤로 지나가듯)
        let lv = 0;
        for (let k = LEVELS.length - 1; k > 0; k--) if (v >= LEVELS[k] - .13) { lv = k; break; }
        if (!lv) continue;
        const r = lv === 1 ? R * .38 : R * LEVELS[lv];
        const x = (i + .5) * step;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
    }
    ctx.fill();
  }
  window.__render = render;

  // 화면에 보일 때만 돌림. 움직임 줄이기 설정이면 한 장면에 멈춤
  let visible = true, t0 = performance.now(), raf = 0;
  const loop = (now) => { raf = 0; if (!visible) return; render(REDUCE ? 6 : (now - t0) / 1000); if (!REDUCE) raf = requestAnimationFrame(loop); };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(cv);
  new ResizeObserver(() => { resize(); kick(); }).observe(cv);
  resize();
  cv.classList.add('ready');
  kick();
})();
