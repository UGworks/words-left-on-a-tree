/* 말을 걸어 두는 나무 — 3D 오프닝
 *
 * 작품의 시뮬레이션(나무 노드, 말 사슬, 새, 전구)은 그대로 두고, 그 상태를 읽어 3D로 다시 그리는 겹 캔버스.
 * 뿌리·줄기 클로즈업에서 나무를 오빗으로 훑으며 줌아웃해 정면 풀샷에 정착한다.
 * 그동안 장면은 아스키, 걸린 말은 실제 글자로 3D 위치에 맞춰 그린다.
 * 정면에 닿는 순간 투영이 원래 2D 화면과 정확히 겹치도록 초점거리를 맞춰 두었고,
 * 거기서 글자 칸이 줄 단위로 흩어지며 원래 화면(가는 선, 전구)이 드러난다. 이후엔 원래 렌더러만 돈다.
 *
 * ?noopening 으로 끔 · 화면 아래 '오프닝 다시' 버튼 또는 window.playOpening()으로 다시 재생
 */
(() => {
  'use strict';
  if (/[?&]noopening/.test(location.search)) return;
  const inner = document.getElementById('inner');
  if (!inner || typeof N === 'undefined') return;

  // ------------------------------------------------ 타임라인 (초)
  const T_MOVE0 = 1.0, T_MOVE1 = 13.0;        // 카메라 이동
  const T_FLAT0 = 10.4, T_FLAT1 = 13.0;       // 깊이를 접어 원래 2D 화면과 겹치게
  const T_DIS0 = 13.0, T_DIS1 = 15.4;         // 아스키 → 원래 화면
  const T_END = 15.6;

  const ov = document.createElement('canvas');
  ov.id = 'op3d'; ov.setAttribute('aria-hidden', 'true'); ov.style.pointerEvents = 'none';
  inner.appendChild(ov);
  const ctx = ov.getContext('2d');
  const lum = document.createElement('canvas'), lx = lum.getContext('2d', { willReadFrequently: true });
  const acc = document.createElement('canvas'), ax = acc.getContext('2d', { willReadFrequently: true });

  const OP = { start: null, active: true };
  window.playOpening = () => { OP.start = null; OP.active = true; ov.style.display = 'block'; };
  window.seekOpening = (t) => { OP.active = true; ov.style.display = 'block'; OP.start = performance.now() - t * 1000; OP.hold = null; };
  window.holdOpening = (t) => { window.seekOpening(t); OP.hold = t; };   // 점검용: 한 시점에 멈춤
  const bar = document.querySelector('.stage-bar');
  if (bar) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.textContent = '오프닝 다시'; b.addEventListener('click', () => window.playOpening()); bar.appendChild(b); }

  // ------------------------------------------------ 수학
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hs = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax_ = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = s => ((ax_ * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax_ * s + 2 * bx) * s + cx;
    return x => { x = clamp(x, 0, 1); let s = x; for (let i = 0; i < 8; i++) { const d = dX(s); if (Math.abs(d) < 1e-6) break; s -= (X(s) - x) / d; } return Y(clamp(s, 0, 1)); };
  }
  const eMove = bezier(.42, 0, .12, 1);   // 천천히 출발해 길게 감속하며 정착
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  // 월드(4000×1000, y 아래) → 3D(밑동이 원점, y 위)
  const CX = WW / 2, YC = GROUND - WH / 2, D = 2000;

  // ------------------------------------------------ 나무의 깊이: 큰 가지마다 앞뒤로 다른 기울기, 곁가지는 조금씩 비껴감
  let Z = new Float32Array(0), SL = new Float32Array(0), slopeFor = null;
  function initSlopes() {
    Z = new Float32Array(N.length); SL = new Float32Array(N.length); slopeFor = N;
    for (let i = 0; i < N.length; i++) {
      const n = N[i], p = n.p < 0 ? null : N[n.p];
      if (!p || n.kind === 'trunk') { SL[i] = 0; continue; }
      if (p.kind === 'trunk') SL[i] = (hs(n.limb * 3.7, 1.3) * 2 - 1) * 1.15;
      else if (n.kind === 'whip') SL[i] = SL[n.p] * .5;
      else if (Math.abs(n.rel) > .25) SL[i] = SL[n.p] + (hs(i * 1.3, 9.1) - .5) * 1.3;
      else SL[i] = SL[n.p];
    }
  }
  function computeZ() {
    if (slopeFor !== N || Z.length !== N.length) initSlopes();
    for (let i = 0; i < N.length; i++) { const n = N[i]; Z[i] = (n.p < 0 || n.kind === 'trunk') ? 0 : Z[n.p] + Math.abs(n.x1 - n.x0) * SL[i]; }
  }

  // ------------------------------------------------ 카메라
  let W = 0, H = 0, FP = 1, C, Rv, Uv, Fv, ZS = 1;
  function trunkX(y3) {   // 높이 y3(3D)에서 줄기 축의 x
    if (!TRUNK.length) return 0;
    const yw = GROUND - y3; let best = N[TRUNK[0]];
    for (const i of TRUNK) { const n = N[i]; if (n.y1 <= yw && n.y0 >= yw) { const s = (n.y0 - yw) / Math.max(1e-3, n.y0 - n.y1); return lerp(n.x0, n.x1, s) - CX; } if (Math.abs(n.y1 - yw) < Math.abs(best.y1 - yw)) best = n; }
    return best.x1 - CX;
  }
  function camera(t) {
    const u = eMove((t - T_MOVE0) / (T_MOVE1 - T_MOVE0));
    const az = lerp(-2.5, 0, u) + .025 * Math.sin(t * .35) * (1 - u);
    const ur = sm(.08, 1, u);
    const r = 260 * Math.exp(Math.log(D / 260) * ur);     // 지수형 줌아웃
    const cy = lerp(40, YC, sm(.03, .95, u));
    const ty = lerp(75, YC, sm(0, .9, u));
    const tx = lerp(trunkX(ty), 0, ur);
    const tgt = [tx, ty, 0];
    C = [tx + Math.sin(az) * r, cy, Math.cos(az) * r];
    Fv = norm([tgt[0] - C[0], tgt[1] - C[1], tgt[2] - C[2]]); Rv = norm(cross(Fv, [0, 1, 0])); Uv = cross(Rv, Fv);
  }
  function proj(x3, y3, z3) {
    const dx = x3 - C[0], dy = y3 - C[1], dz = z3 - C[2];
    const z = dx * Fv[0] + dy * Fv[1] + dz * Fv[2];
    if (z < 10) return null;
    return [W / 2 + (dx * Rv[0] + dy * Rv[1] + dz * Rv[2]) * FP / z, H / 2 - (dx * Uv[0] + dy * Uv[1] + dz * Uv[2]) * FP / z, z];
  }
  const P3 = (x, y, z) => proj(x - CX, GROUND - y, z * ZS);
  const fog = z => clamp(1.25 - z / 5200, .32, 1);

  // ------------------------------------------------ 밝기 버퍼에 선 (밝기·굵기 단계별로 묶어 한 번에)
  let LW = 0, LH = 0, cols = 0, rows = 0, cw = 8, chh = 14, seeds = null;
  const SS = 4, NB = 10;
  let bk;
  const reset = () => { bk = [...Array(NB)].map(() => []); };
  function seg(q0, q1, a, wW) {
    if (!q0 || !q1) return;
    const z = (q0[2] + q1[2]) / 2, al = a * fog(z), b = clamp(Math.round(al * (NB - 1)), 0, NB - 1);
    if (b > 0) bk[b].push(q0[0], q0[1], q1[0], q1[1], Math.max(.55, wW * FP / z * LW / W));
  }
  function line(pts, a, wW) { for (let i = 1; i < pts.length; i++) seg(pts[i - 1], pts[i], a, wW); }
  function flush(g, rgb) {
    const sx = LW / W, sy = LH / H; g.lineCap = 'round';
    for (let b = 1; b < NB; b++) {
      const arr = bk[b]; if (!arr.length) continue;
      const byW = new Map();
      for (let i = 0; i < arr.length; i += 5) { const wk = Math.min(6, Math.round(arr[i + 4] * 2) / 2); let p = byW.get(wk); if (!p) { p = new Path2D(); byW.set(wk, p); } p.moveTo(arr[i] * sx, arr[i + 1] * sy); p.lineTo(arr[i + 2] * sx, arr[i + 3] * sy); }
      g.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${b / (NB - 1)})`;
      for (const [wk, p] of byW) { g.lineWidth = wk; g.stroke(p); }
    }
  }
  function dot(g, q, rW, rgb, a) {
    if (!q) return; const rr = Math.max(.6, rW * FP / q[2] * LW / W);
    g.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * fog(q[2])})`; g.beginPath(); g.arc(q[0] * LW / W, q[1] * LH / H, rr, 0, 6.2832); g.fill();
  }

  // ------------------------------------------------ 장면 → 버퍼
  const hwT = u => (44 + 11 * Math.sin(u * 5.2 + .6) + 70 * Math.pow(1 - u, 6)) * (1 + Math.max(0, u - .8) * 2.2);
  function trunkAxis(u) {   // 원래 drawKinetic의 축과 같은 곡선 (월드 좌표)
    const T = TRUNK.map(i => N[i]), M = T.length;
    const f = Math.min(M - 1e-4, Math.max(0, u * M)), j = Math.floor(f), s = f - j, n = T[j], q = 1 - s;
    return [q * q * n.x0 + 2 * s * q * n.cx + s * s * n.x1, q * q * n.y0 + 2 * s * q * n.cy + s * s * n.y1];
  }
  function drawScene(t) {
    lx.globalCompositeOperation = 'source-over'; lx.fillStyle = '#000'; lx.fillRect(0, 0, LW, LH);
    ax.globalCompositeOperation = 'source-over'; ax.fillStyle = '#000'; ax.fillRect(0, 0, LW, LH);
    lx.globalCompositeOperation = 'lighter'; ax.globalCompositeOperation = 'lighter';
    reset();
    // 가지: 2차 곡선
    for (let i = 0; i < N.length; i++) {
      const n = N[i]; if (n.kind === 'trunk') continue;
      const z0 = n.p < 0 ? 0 : Z[n.p], z1 = Z[i], zc = (z0 + z1) / 2, pts = [];
      for (let k = 0; k <= 3; k++) { const s = k / 3, q = 1 - s; pts.push(P3(q * q * n.x0 + 2 * q * s * n.cx + s * s * n.x1, q * q * n.y0 + 2 * q * s * n.cy + s * s * n.y1, q * q * z0 + 2 * q * s * zc + s * s * z1)); }
      line(pts, n.kind === 'whip' ? .34 : .55, n.kind === 'whip' ? 1.6 : 2.2);
    }
    // 계보선 다발 (원래 데이터 트리의 가닥과 같은 퍼짐)
    for (const g of LINEAGE) {
      const ch = g.chain, pts = [P3(N[ch[0]].x0 + g.off * 70, N[ch[0]].y0, 0)];
      for (let j = 0; j < ch.length; j++) {
        const n = N[ch[j]], tr = n.kind === 'trunk', wdt = tr ? 120 - j * 9 : 7 + 30 * Math.exp(-(n.ft - 1) / 5);
        const sp = tr ? .5 * wdt * Math.sin(g.off * Math.PI * 2 + j * .62) : g.off * wdt;
        pts.push(P3(n.x1 - Math.sin(n.ang) * sp, n.y1 + Math.cos(n.ang) * sp, Z[ch[j]] + (tr ? Math.cos(g.off * Math.PI * 2 + j * .62) * wdt * .5 : 0)));
      }
      line(pts, .13, 1.1);
    }
    // 줄기: 여러 가닥의 띠가 감겨 오름 (진짜 3D 나선)
    if (TRUNK.length) {
      const spin = S.t * .05;
      for (let k = 0; k < 14; k++) {
        const ph = k / 14 * Math.PI * 2, turns = k % 4 === 3 ? -.85 : 1.15 + (k % 3) * .12, amp = .9 + .08 * hs(k, 2), pts = [];
        for (let i = 0; i <= 48; i++) { const u = i / 48, a = ph + u * turns * Math.PI * 2 + spin, c = trunkAxis(u), r = hwT(u) * amp; pts.push(P3(c[0] + Math.cos(a) * r, c[1], Math.sin(a) * r)); }
        line(pts, .5, 1.8);
      }
      for (const u of [.08, .13, .18, .3, .36, .55, .6, .65, .7]) {
        const c = trunkAxis(u), r = hwT(u) * 1.02, pts = [];
        for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2; pts.push(P3(c[0] + Math.cos(a) * r, c[1], Math.sin(a) * r)); }
        line(pts, .42, 1.2);
      }
      // 뿌리 다리: 밑동에서 사방으로 무릎처럼 꺾여 땅을 짚음
      const bx = N[TRUNK[0]].x0;
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2 + hs(k, 5) * .4, kn = 40 + hs(k, 6) * 70, rr = 90 + hs(k, 7) * 160, h = 18 + hs(k, 8) * 34, pts = [];
        for (let i = 0; i <= 12; i++) {
          const s = i / 12, q = 1 - s;
          const r = q * q * q * hwT(0) * .45 + 3 * q * q * s * kn + 3 * q * s * s * kn * 1.3 + s * s * s * rr;
          const y = q * q * q * (h + 30) + 3 * q * q * s * h * .6 + 3 * q * s * s * 4;
          pts.push(P3(bx + Math.cos(a) * r, GROUND - Math.max(0, y), Math.sin(a) * r));
        }
        line(pts, .5, 2);
      }
      for (const [rr, al] of [[120, .3], [260, .14]]) { const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; pts.push(P3(bx + Math.cos(a) * rr, GROUND + 3, Math.sin(a) * rr)); } line(pts, al, 1.2); }
    }
    // 말이 걸린 실
    for (const r of ropes) { const n = N[r.node]; if (!n) continue; seg(P3(n.x1, n.y1, Z[r.node]), P3(r.pts[0].x, r.pts[0].y, Z[r.node]), .3, .9); }
    flush(lx, [255, 255, 255]);
    // 눈: 나무 둘레의 공간에 흩어 놓음
    for (const f of SNOW) dot(lx, P3(f.x * WW, f.y * WH, (f.z - .95) * 2400 + (f.s - .5) * 600), 2.4, [255, 255, 255], .3 + .3 * f.z);

    // 강조색: 새(연두·말을 문 새는 금빛), 전구(금빛), 열매(빨강)
    reset();
    const gold = [];
    for (const b of birds) {
      if (b.alpha < .01) continue;
      const z = (b.mode === 'perch' && b.node >= 0 && b.node < Z.length) ? Z[b.node] : (hs(b.seed, 4) - .5) * 1400;
      const left = Math.cos(b.heading) < 0, sx = (left ? -1 : 1) * (b.courier ? 1.6 : 1.25);
      const f = b.mode === 'perch' ? .1 : Math.sin(b.phase) * .5 + .5;
      const P = (px, py) => P3(b.x + px * sx, b.y + py * 1.25, z);
      const st = [[P(-16, 5), P(10, -3), P(17, -2)], [P(-3, 0), P(-12 + f * 2, -4 - 21 * f + (1 - f) * 6), P(5, -2)], [P(1, -1), P(4 + f * 4, -3 - 15 * f + (1 - f) * 5), P(8, -2)]];
      if (b.courier) gold.push(...st); else for (const s of st) line(s, b.alpha, 2.2);
    }
    flush(ax, PAL[sel.color] ? PAL[sel.color].accent : [164, 224, 160]);
    reset(); for (const s of gold) line(s, 1, 2.6); flush(ax, [246, 214, 150]);
    if (sel.winter !== 'off') for (const L of LIGHTS) {
      const n = N[L.i]; if (!n) continue;
      const tw = .55 + .45 * Math.sin(S.t * L.sp + L.ph);
      dot(ax, P3(n.x1, n.y1, Z[L.i]), L.red ? 4 : 5 * L.s, L.red ? [196, 86, 78] : [246, 214, 150], L.red ? .8 : tw);
    }
  }

  // ------------------------------------------------ 버퍼 → 아스키
  const RAMP = ' .\'`,:;-~=+*xo#%@', SCR = '.:-=+*#%@/\\|<>~^';
  function ascii(t, alpha, dis) {
    const L = lx.getImageData(0, 0, LW, LH).data, A = ax.getImageData(0, 0, LW, LH).data;
    ctx.font = `${(chh * .8).toFixed(1)}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const scr = 1 - sm(0, 1.6, t), tick = Math.floor(t * 18), sxg = W / LW, syg = H / LH;
    const IV = [232, 227, 212];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const seed = seeds[r * cols + c];
      if (dis > 0 && seed < dis) continue;               // 이미 원래 화면으로 넘어간 칸
      let s = 0, jxx = 0, jyy = 0, jxy = 0, ar = 0, ag = 0, ab = 0;
      const x0 = c * SS, y0 = r * SS;
      for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) {
        const X = x0 + xx, Y = y0 + yy; if (X >= LW || Y >= LH) continue;
        const i = (Y * LW + X) * 4, v = L[i]; s += v; ar += A[i]; ag += A[i + 1]; ab += A[i + 2];
        if (X > 0 && X < LW - 1 && Y > 0 && Y < LH - 1) { const gx = (L[i + 4] - L[i - 4]) / sxg, gy = (L[i + LW * 4] - L[i - LW * 4]) / syg; jxx += gx * gx; jyy += gy * gy; jxy += gx * gy; }
      }
      const n = SS * SS, lv = s / n / 255, av = (ar + ag + ab) / n / 765, v = Math.max(lv, av * 1.2);
      const front = dis > 0 && seed - dis < .1;           // 흩어지는 경계: 밝게 깜박
      if (v < .035 && !(front && hs(c * 1.7 + tick, r) < .18)) continue;   // 빈 칸은 드문드문만
      let ch, col = IV, a = clamp(.28 + v * 1.25, 0, 1);
      const tr = jxx + jyy, coh = tr > 0 ? Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / tr : 0;
      if (coh > .55 && v > .07 && v < .7) {
        let deg = ((.5 * Math.atan2(2 * jxy, jxx - jyy) + Math.PI / 2) * 180 / Math.PI) % 180; if (deg < 0) deg += 180;
        ch = deg < 22.5 || deg >= 157.5 ? '-' : deg < 67.5 ? '\\' : deg < 112.5 ? '|' : '/';
      } else ch = RAMP[clamp(Math.floor(v * (RAMP.length - 1) * 1.15), 1, RAMP.length - 1)];
      if (av > lv * .6 && av > .03) { const m = Math.max(ar, ag, ab) || 1; col = [ar / m * 255 | 0, ag / m * 255 | 0, ab / m * 255 | 0]; if (!'-|/\\'.includes(ch)) ch = av > .25 ? '*' : '+'; a = clamp(.5 + av * 2, 0, 1); }
      if (scr > 0 && hs(c * 13.1 + r * 7.3, tick) < scr * .9) ch = SCR[(hs(c + r * 3.1, tick * .7) * SCR.length) | 0];
      if (front) { if (hs(c + tick, r) > .4) ch = SCR[(hs(c, r + tick) * SCR.length) | 0]; a = v < .035 ? .32 : Math.max(a, .6); }
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a * alpha})`;
      ctx.fillText(ch, c * cw + cw / 2, r * chh + chh / 2 + 1);
    }
  }

  // ------------------------------------------------ 걸린 말: 실제 글자
  // 글자를 한 번 비트맵으로 그려 두고 크기만 바꿔 찍음 (글자마다 폰트를 바꾸는 fillText보다 훨씬 빠름)
  const GC = new Map(), GS = 88;
  function glyphImg(c, font, rgb) {
    const k = c + '|' + font + '|' + rgb; let g = GC.get(k);
    if (!g) {
      g = document.createElement('canvas'); g.width = g.height = GS;
      const x = g.getContext('2d'); x.font = `${GS * .78}px ${font}, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = `rgb(${rgb})`; x.fillText(c, GS / 2, GS / 2);
      GC.set(k, g);
    }
    return g;
  }
  function words(t, alpha) {
    const P = PAL[sel.color] || PAL.ivory, items = [];
    for (const r of ropes) {
      const z = Z[r.node] || 0, n = Math.ceil(r.shown);
      const la = LAYER[r.layer].a * r.alpha;
      for (let i = 0; i < n && i < r.chars.length; i++) {
        const c = r.chars[i]; if (c === ' ') continue;
        const p0 = r.pts[i], p1 = r.pts[i + 1] || p0;
        const q = P3((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, z); if (!q) continue;
        items.push({ q, c, r, i, la });
      }
    }
    items.sort((a, b) => b.q[2] - a.q[2]);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const font = FONTS[sel.font] || '"Nanum Myeongjo"';
    for (const it of items) {
      const z = it.q[2], px = it.r.fs * FP / z;
      const a = it.la * fog(z) * (1 - sm(H * .055, H * .11, px)) * alpha; if (a < .02) continue;   // 카메라 바로 앞 글자는 초점이 나간 듯 사라짐
      let col = P.text;
      if (it.r.ct && it.r.ct[it.i] !== undefined && S.t - it.r.ct[it.i] < 1.6) col = it.i % 2 ? [196, 86, 78] : P.accent;
      if (px < 5) { ctx.fillStyle = `rgba(${col},${a * .8})`; ctx.fillRect(it.q[0] - .8, it.q[1] - .8, 1.6, 1.6); continue; }
      const s = px / .78;   // 캐시는 글자 크기의 1/0.78 칸
      ctx.globalAlpha = a; ctx.drawImage(glyphImg(it.c, font, col), it.q[0] - s / 2, it.q[1] - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------ 크기 맞춤
  function fit() {
    const base = document.getElementById('stage');
    if (ov.width !== base.width || ov.height !== base.height) { ov.width = base.width; ov.height = base.height; }
    if (W !== ov.width || H !== ov.height) {
      W = ov.width; H = ov.height; FP = W * D / 4000;
      cw = Math.max(5, W / 280); chh = cw * 1.8;
      cols = Math.ceil(W / cw); rows = Math.ceil(H / chh);
      LW = cols * SS; LH = rows * SS; lum.width = acc.width = LW; lum.height = acc.height = LH;
      seeds = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) seeds[r * cols + c] = .55 * hs(c, r) + .45 * hs(r * 3.1, 7.7);
    }
  }

  // ------------------------------------------------ 매 프레임
  function tick(now) {
    requestAnimationFrame(tick);
    if (!OP.active) return;
    fit();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (OP.start === null) {                       // 작품이 문장을 걸고 돌기 시작할 때까지 검은 화면으로 덮음
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (ropes.length && S.t > .2) OP.start = now;
      return;
    }
    const t = OP.hold != null ? OP.hold : (now - OP.start) / 1000;
    if (t > T_END) { OP.active = false; ov.style.display = 'none'; return; }
    renderAt(t);
  }
  window.renderOpeningAt = (t) => { fit(); ctx.setTransform(1, 0, 0, 1, 0, 0); renderAt(t); };   // 점검용: 한 프레임을 바로 그림
  function renderAt(t) {
    computeZ(); camera(t);
    ZS = 1 - sm(T_FLAT0, T_FLAT1, t);
    const dis = sm(T_DIS0, T_DIS1, t);
    // 배경: 아직 넘어가지 않은 칸만 검게 덮고, 넘어간 칸은 비워 원래 화면이 보이게
    if (dis <= 0) { ctx.fillStyle = '#0a0b0a'; ctx.fillRect(0, 0, W, H); }
    else {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0a0b0a';
      for (let r = 0; r < rows; r++) { let run = -1;
        for (let c = 0; c <= cols; c++) { const on = c < cols && seeds[r * cols + c] >= dis; if (on && run < 0) run = c; if (!on && run >= 0) { ctx.fillRect(run * cw, r * chh, (c - run) * cw, chh); run = -1; } } }
    }
    drawScene(t);
    const fadeIn = sm(0, .9, t);
    ascii(t, fadeIn, dis);
    words(t, sm(2.4, 5.2, t) * (1 - dis));   // 처음엔 줄기만, 말은 카메라가 물러나며 드러남
    if (dis <= 0) {   // 원래 화면과 같은 비네트
      const vg = ctx.createRadialGradient(W / 2, H * .55, H * .4, W / 2, H * .55, W * .62);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
  }
  requestAnimationFrame(tick);
})();
