/* 히어로 배경: 서로에게 손을 뻗는 두 손을 검은 LED 하프톤(가로 주사선의 점)으로 매 프레임 그린다.
 * 손 사진 한 장(2×2 시트)을 밝기 원본으로 쓰고, 손마다 천천히 다가가고·숨 쉬고·기울며,
 * 주기적으로 점 하나하나가 흩어지며 다른 자세로 바뀌었다가 돌아온다. 영상이나 GIF가 아니다. */
(() => {
  'use strict';
  const SHEET_URL = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261030_025250_100df7b8-31fd-4614-aa4a-c1b7d5b6b273.png&w=1600&q=85';
  // 시트 안의 손 위치 [x, y, w, h] (시트 너비·높이 대비)
  const SRC = {
    LA: [0, .06, .47, .40],   // 왼손, 검지로 가리킴 (자세 A)
    RA: [.53, .06, .47, .40], // 오른손, 검지로 가리킴 (자세 A)
    LB: [0, .55, .47, .40],   // 왼손, 손가락을 편 채 뻗음 (자세 B)
    RB: [.53, .55, .47, .40], // 오른손, 손바닥을 위로 (자세 B)
  };
  const LOOP = 20;
  const LEVELS = [0, .26, .52, .78, 1];
  const INK = '#0d0d0d';

  const cv = document.getElementById('dots');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mixAt = (t, on, off, dur) => smooth(on, on + dur, t) * (1 - smooth(off, off + dur, t));

  let W = 0, H = 0, DPR = 1, step = 7, rowStep = 14, cols = 0, rows = 0, R = 3, portrait = false;
  let seeds = null, fA = null, fB = null, tiles = null;

  function field() {
    const c = document.createElement('canvas'); c.width = cols; c.height = rows;
    return { c, x: c.getContext('2d', { willReadFrequently: true }) };
  }

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
    fA = field(); fB = field();
  }

  function sliceTiles(img) {
    const out = {};
    for (const [k, [x, y, w, h]] of Object.entries(SRC)) {
      const sw = w * img.naturalWidth, sh = h * img.naturalHeight;
      const c = document.createElement('canvas'); c.width = 420; c.height = Math.round(420 * sh / sw);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      g.drawImage(img, x * img.naturalWidth, y * img.naturalHeight, sw, sh, 0, 0, c.width, c.height);
      out[k] = c;
    }
    return out;
  }

  // 손 하나를 필드(점 하나 = 픽셀 하나)에 현재 변환으로 그린다
  function place(g, tile, left, t) {
    const a = 2 * Math.PI * t / LOOP, ph = left ? 0 : Math.PI;
    const hw = W * (portrait ? .66 : .53), hh = hw * (.40 * 1520) / (.47 * 2688);
    const cy = H * (portrait ? .66 : .54);
    const reach = (.035 * Math.sin(a + ph) + .012 * Math.sin(2 * a + 1.3 + ph)) * W;
    const sc = 1 + .07 * Math.sin(a + .9 + ph);
    const rot = (left ? 1 : -1) * .045 * Math.sin(a + 2.1 + ph);
    const x = left ? reach - W * .045 : W - hw + W * .045 - reach;
    const px = left ? 0 : W;
    g.save();
    g.setTransform(cols / W, 0, 0, rows / H, 0, 0);
    g.translate(px, cy); g.rotate(rot); g.scale(sc, sc); g.translate(-px, -cy);
    g.drawImage(tile, x, cy - hh / 2, hw, hh);
    g.restore();
  }

  function render(tt) {
    const t = ((tt % LOOP) + LOOP) % LOOP;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!tiles) return;
    for (const f of [fA, fB]) { f.x.setTransform(1, 0, 0, 1, 0, 0); f.x.fillStyle = '#fff'; f.x.fillRect(0, 0, cols, rows); }
    place(fA.x, tiles.LA, true, t); place(fA.x, tiles.RA, false, t);
    place(fB.x, tiles.LB, true, t); place(fB.x, tiles.RB, false, t);
    const dA = fA.x.getImageData(0, 0, cols, rows).data, dB = fB.x.getImageData(0, 0, cols, rows).data;

    const mL = mixAt(t, 6.2, 14.6, 1.6), mR = mixAt(t, 2.4, 10.4, 1.6);
    const tick = Math.floor(t * 7);
    const qzW = portrait ? .44 : .2, qzC = portrait ? .33 : .385;
    ctx.fillStyle = INK; ctx.beginPath();
    for (let j = 0; j < rows; j++) {
      const shift = hash(j, tick) > .965 ? Math.round((hash(tick, j) - .5) * 8) : 0;   // 가끔 줄 하나가 옆으로 밀림
      const y = (j + .5) * rowStep;
      const ey = ((j + .5) * rowStep / H - qzC) / .085;
      for (let i = 0; i < cols; i++) {
        const si = Math.min(cols - 1, Math.max(0, i - shift));
        const seed = seeds[j * cols + i];
        const m = i < cols / 2 ? mL : mR;
        const d = seed < m ? dB : dA;
        let v = (1 - d[(j * cols + si) * 4] / 255 - .16) / .42;
        if (v <= 0) continue;
        if (v > 1) v = 1;
        if (m > .001 && m < .999) {          // 자세가 바뀌는 경계: 깜박이며 성기게
          const gap = Math.abs(seed - m);
          if (gap < .12) { v *= gap / .12; if (hash(i + tick, j) <= .4) v *= .3; }
        }
        v *= .86 + .14 * Math.sin(t * 3.2 + seed * 40);
        const cx = Math.abs((i + .5) / cols - .5);
        v *= smooth(.035, .11, cx);                          // 손끝은 서로 닿기 전에 흩어짐
        v *= smooth(.85, 1.25, Math.hypot(cx / qzW, ey));   // 제목 주변은 비워 둠
        let lv = 0;
        for (let k = LEVELS.length - 1; k > 0; k--) if (v >= LEVELS[k] - .13) { lv = k; break; }
        if (!lv) continue;
        const r = lv === 1 ? R * .38 : R * LEVELS[lv];
        const x = (i + .5) * step;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832);
      }
    }
    ctx.fill();
  }
  window.__render = render;

  // 화면에 보일 때만 돌린다
  let visible = true, t0 = performance.now(), raf = 0;
  const loop = (now) => { raf = 0; if (!visible) return; render((now - t0) / 1000); if (!REDUCE) raf = requestAnimationFrame(loop); };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(cv);
  new ResizeObserver(() => { resize(); kick(); }).observe(cv);
  resize();

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.onload = () => { try { tiles = sliceTiles(img); cv.classList.add('ready'); kick(); } catch (e) { console.warn('hands: 이미지를 읽을 수 없음', e); } };
  img.onerror = () => console.warn('hands: 손 이미지를 불러오지 못함');
  img.src = SHEET_URL;
})();
