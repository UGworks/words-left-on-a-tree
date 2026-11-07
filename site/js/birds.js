/* 히어로 배경: 작품의 새(접힌 선으로 된 새)가 날아가는 모습을 아스키 글자로 매 프레임 그린다.
 * 작품에서 새는 관객이 쓴 말을 물고 빈 가지로 날아간다. 여기서는 몇 마리가 서로 다른 깊이로 화면을 가로지른다.
 * 칸마다 먹의 양으로 글자의 밀도(. : = + * # @)를 고르고, 선이 지나는 칸은 그 방향대로 - | / \ 를 쓴다.
 * 가까운 새는 크고 빠르고, 먼 새는 작고 느리다. 날갯짓하다 가끔 활공하고, 몇 줄이 옆으로 밀리는 글리치가 지나간다.
 * 24초마다 같은 장면으로 돌아오며, window.__render(t)로 시간을 직접 지정할 수 있다. */
(() => {
  'use strict';
  const LOOP = 24;
  const INK = '#0d0d0d';
  const TAU = Math.PI * 2;
  const RAMP = '.:-=+*x#%@';              // 옅음 → 짙음
  const SCR = '/\\|-+*#=<>~^';            // 글리치 때 잠깐 섞이는 글자
  const SS = 3;                            // 한 칸을 3×3으로 나눠 읽어 선의 방향을 잰다
  const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

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

  let W = 0, H = 0, DPR = 1, cw = 8, chh = 15, cols = 0, rows = 0, FW = 0, FH = 0, portrait = false;
  let seeds = null, field = null, fx = null, GL = null, gw = 0, gh = 0;

  function resize() {
    const r = cv.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cw = Math.max(7.5, W / 150); chh = cw * 1.8;
    cols = Math.ceil(W / cw); rows = Math.ceil(H / chh);
    FW = cols * SS; FH = rows * SS; portrait = H > W;
    seeds = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) seeds[j * cols + i] = .55 * hash(i, j) + .45 * hash(j * 3.1, 7.7);
    field = document.createElement('canvas'); field.width = FW; field.height = FH;
    fx = field.getContext('2d', { willReadFrequently: true });
    // 글자마다 한 번 그려 둔 비트맵을 찍는다 (fillText를 매 칸 부르면 느림)
    GL = new Map(); gw = Math.ceil(cw * DPR * 1.3); gh = Math.ceil(chh * DPR);
    for (const c of new Set(RAMP + SCR + '-|/\\')) {
      const g = document.createElement('canvas'); g.width = gw; g.height = gh;
      const x = g.getContext('2d'); x.font = `700 ${(chh * .82 * DPR).toFixed(1)}px ${FONT}`;
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = INK; x.fillText(c, gw / 2, gh / 2 + DPR * .5);
      GL.set(c, g);
    }
  }

  // 작품의 새와 같은 모양: 몸통 선, 꼬리, 두 날개 (f: 0 내림 ~ 1 올림)
  function drawBird(g, x, y, s, f, tilt) {
    const U = W / 175 * s;
    g.save(); g.translate(x, y); g.rotate(tilt); g.scale(U, U);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const tip1 = [-12 + f * 2, -4 - 21 * f + (1 - f) * 6], tip2 = [4 + f * 4, -3 - 15 * f + (1 - f) * 5];
    // 먼 날개: 옅은 면
    g.fillStyle = '#a0a0a0'; g.beginPath(); g.moveTo(1, -1); g.lineTo(tip2[0], tip2[1]); g.lineTo(8, -2); g.closePath(); g.fill();
    // 가까운 날개: 조금 짙은 면 + 테두리
    g.fillStyle = '#6e6e6e'; g.beginPath(); g.moveTo(-3, 0); g.lineTo(tip1[0], tip1[1]); g.lineTo(5, -2); g.closePath(); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(-3, 0); g.lineTo(tip1[0], tip1[1]); g.lineTo(5, -2); g.stroke();
    g.lineWidth = 1.9; g.beginPath(); g.moveTo(1, -1); g.lineTo(tip2[0], tip2[1]); g.lineTo(8, -2); g.stroke();
    // 몸통과 꼬리
    g.lineWidth = 2.8; g.beginPath(); g.moveTo(-16, 5); g.lineTo(10, -3); g.lineTo(17, -2); g.moveTo(-16, 5); g.lineTo(-7, 1.5); g.stroke();
    g.restore();
  }

  function render(tt) {
    const t = ((tt % LOOP) + LOOP) % LOOP;
    // 1) 칸 하나 = 3×3 픽셀인 작은 밭에 새를 그림
    fx.setTransform(1, 0, 0, 1, 0, 0); fx.fillStyle = '#fff'; fx.fillRect(0, 0, FW, FH);
    fx.setTransform(FW / W, 0, 0, FH / H, 0, 0);
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
    const d = fx.getImageData(0, 0, FW, FH).data;
    const dk = (X, Y) => 1 - d[(Y * FW + X) * 4] / 255;              // 먹의 양 0~1

    // 2) 칸마다 먹의 양 → 글자 밀도, 선의 결 → - | / \
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    const tick = Math.floor(t * 7);
    // 제목·부제·버튼이 들어가는 타원 (가로 반지름 qzW, 세로 중심 qzC, 세로 반지름 qzH)
    const qzW = portrait ? .46 : .25, qzC = portrait ? .3 : .38, qzH = portrait ? .17 : .225;
    const n = SS * SS;
    for (let j = 0; j < rows; j++) {
      const glitch = hash(j, tick) > .965;
      const shift = glitch ? Math.round((hash(tick, j) - .5) * 8) : 0;   // 가끔 줄 하나가 옆으로 밀림
      const ey = ((j + .5) * chh / H - qzC) / qzH;
      for (let i = 0; i < cols; i++) {
        const si = Math.min(cols - 1, Math.max(0, i - shift));
        let s = 0, jxx = 0, jyy = 0, jxy = 0;
        const x0 = si * SS, y0 = j * SS;
        for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) {
          const X = x0 + xx, Y = y0 + yy; s += dk(X, Y);
          if (X > 0 && X < FW - 1 && Y > 0 && Y < FH - 1) {
            const gx = dk(X + 1, Y) - dk(X - 1, Y), gy = dk(X, Y + 1) - dk(X, Y - 1);
            jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;
          }
        }
        let v = (s / n - .08) / .6;
        if (v <= 0) continue;
        v = v > 1 ? 1 : Math.pow(v, .75);
        const seed = seeds[j * cols + i];
        v *= .86 + .14 * Math.sin(t * 3.2 + seed * 40);
        const cx = Math.abs((i + .5) / cols - .5);
        v *= smooth(.78, 1.12, Math.hypot(cx / qzW, ey));   // 제목 주변은 비워 둠 (새가 글 뒤로 지나가듯)
        if (v < .06) continue;
        let ch;
        const tr = jxx + jyy, coh = tr > 1e-4 ? Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / tr : 0;
        if (coh > .6 && tr > .08 && v < .8) {
          let deg = ((.5 * Math.atan2(2 * jxy, jxx - jyy) + Math.PI / 2) * 180 / Math.PI) % 180; if (deg < 0) deg += 180;
          ch = deg < 22.5 || deg >= 157.5 ? '-' : deg < 67.5 ? '\\' : deg < 112.5 ? '|' : '/';
        } else ch = RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))];
        if (glitch && hash(i * 1.3, tick + j) < .45) ch = SCR[(hash(i, j + tick) * SCR.length) | 0];
        ctx.globalAlpha = Math.min(1, .62 + v * .5);
        ctx.drawImage(GL.get(ch), Math.round((i + .5) * cw * DPR - gw / 2), Math.round((j + .5) * chh * DPR - gh / 2));
      }
    }
    ctx.globalAlpha = 1;
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
