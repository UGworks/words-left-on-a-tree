/* 말을 걸어 두는 나무 — 랜딩 3D 렌더러
 * sim.js(작품에서 가져온 나무·말·새)의 상태를 읽어 3D로 그린다.
 * 뿌리·줄기 클로즈업 → 나무를 오빗으로 훑으며 줌아웃 → 정면에 정착.
 * 이동하는 동안 장면은 아스키, 정착하면 글자 칸이 흩어지며 작품의 가는 선·전구 모습으로 바뀐다.
 * 걸린 말은 처음부터 끝까지 실제 글자로 3D 위치에 그린다. */
(() => {
  'use strict';
  const cv = document.getElementById('tree'), ctx = cv.getContext('2d');
  const lum = document.createElement('canvas'), lx = lum.getContext('2d', { willReadFrequently: true });
  const acc = document.createElement('canvas'), ax = acc.getContext('2d', { willReadFrequently: true });

  // ------------------------------------------------ 타임라인 (초)
  const T_MOVE0 = 1.0, T_MOVE1 = 13.0, T_DIS0 = 12.4, T_DIS1 = 14.6, T_COPY = 13.6;
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
  const CX = WW / 2, TREE_W = 3700, TREE_H = 900, TREE_YC = GROUND - 519;

  // ------------------------------------------------ 나무의 깊이: 큰 가지마다 앞뒤로 다른 기울기, 곁가지는 조금씩 비껴감
  let Z = new Float32Array(0), SL = new Float32Array(0), slopeFor = null;
  function initSlopes() {
    Z = new Float32Array(N.length); SL = new Float32Array(N.length); slopeFor = N;
    for (let i = 0; i < N.length; i++) {
      const n = N[i], p = n.p < 0 ? null : N[n.p];
      if (!p || n.kind === 'trunk') SL[i] = 0;
      else if (p.kind === 'trunk') SL[i] = (hs(n.limb * 3.7, 1.3) * 2 - 1) * 1.15;
      else if (n.kind === 'whip') SL[i] = SL[n.p] * .5;
      else if (Math.abs(n.rel) > .25) SL[i] = SL[n.p] + (hs(i * 1.3, 9.1) - .5) * 1.3;
      else SL[i] = SL[n.p];
    }
  }
  function computeZ() {
    if (slopeFor !== N || Z.length !== N.length) initSlopes();
    for (let i = 0; i < N.length; i++) { const n = N[i]; Z[i] = (n.p < 0 || n.kind === 'trunk') ? 0 : Z[n.p] + Math.abs(n.x1 - n.x0) * SL[i]; }
  }

  // ------------------------------------------------ 화면·카메라
  let W = 0, H = 0, DPR = 1, FP = 1, DF = 4000, TYF = TREE_YC, C, Rv, Uv, Fv;
  let cw = 8, chh = 14, cols = 0, rows = 0, LW = 0, LH = 0, seeds = null;
  const SS = 3;                                   // 아스키 칸당 밝기 표본 3×3
  const QUAL = { caps: [1.5, 1.25, 1], level: 0, acc: 0, n: 0 };   // 느리면 해상도를 한 단계씩 낮춤
  function resize() {
    DPR = Math.min(QUAL.caps[QUAL.level], window.devicePixelRatio || 1);
    W = Math.round(cv.clientWidth * DPR); H = Math.round(cv.clientHeight * DPR); cv.width = W; cv.height = H;
    FP = H / (2 * Math.tan(16 * Math.PI / 180));
    DF = Math.min(FP * TREE_W / (.82 * W), FP * TREE_H / (.34 * H));  // 가로로 다 들어오게 (원근으로 앞 가지가 커지는 만큼 여유), 세로 화면에선 높이 기준
    TYF = TREE_YC - .2 * DF * H / FP;                                    // 나무를 화면 위쪽으로, 아래는 글 자리
    cw = Math.max(7, W / 200); chh = cw * 1.8;
    cols = Math.ceil(W / cw); rows = Math.ceil(H / chh);
    LW = cols * SS; LH = rows * SS; lum.width = acc.width = LW; lum.height = acc.height = LH;
    seeds = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) seeds[r * cols + c] = .55 * hs(c, r) + .45 * hs(r * 3.1, 7.7);
  }
  function trunkX(y3) {
    const yw = GROUND - y3;
    for (const i of TRUNK) { const n = N[i]; if (n.y1 <= yw && n.y0 >= yw) { const s = (n.y0 - yw) / Math.max(1e-3, n.y0 - n.y1); return lerp(n.x0, n.x1, s) - CX; } }
    return N[TRUNK[TRUNK.length - 1]].x1 - CX;
  }
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  function camera(t) {
    const u = eMove((t - T_MOVE0) / (T_MOVE1 - T_MOVE0));
    const idle = sm(T_MOVE1 - 1, T_MOVE1 + 3, t) * (REDUCE ? 0 : 1);
    const az = lerp(-2.5, 0, u) + idle * (.16 * Math.sin((t - T_MOVE1) * .055) + mouse.sx * .14);
    const ur = sm(.08, 1, u);
    const r = 260 * Math.exp(Math.log(DF / 260) * ur);
    const ty = lerp(75, TYF, sm(0, .9, u));
    const cy = lerp(40, TYF + 70, sm(.03, .95, u)) + idle * mouse.sy * -120;
    const tx = lerp(trunkX(Math.max(0, ty)), 0, ur);
    C = [tx + Math.sin(az) * r, cy, Math.cos(az) * r];
    Fv = norm([tx - C[0], ty - C[1], -C[2]]); Rv = norm(cross(Fv, [0, 1, 0])); Uv = cross(Rv, Fv);
  }
  function P3(x, y, z) {   // 월드(4000×1000, y 아래) → 화면
    const dx = x - CX - C[0], dy = GROUND - y - C[1], dz = z - C[2];
    const zz = dx * Fv[0] + dy * Fv[1] + dz * Fv[2];
    if (zz < 10) return null;
    return [W / 2 + (dx * Rv[0] + dy * Rv[1] + dz * Rv[2]) * FP / zz, H / 2 - (dx * Uv[0] + dy * Uv[1] + dz * Uv[2]) * FP / zz, zz];
  }
  const fog = z => clamp(1.25 - z / (DF * 2.4), .32, 1);

  // ------------------------------------------------ 이번 프레임의 선과 점을 모음 (아스키·선 두 방식이 같이 씀)
  // seg: x0 y0 x1 y1 alpha widthPx kind(0 선, 1 새, 2 금빛)
  let SG = [], DT = [];
  function seg(q0, q1, a, wW, kind = 0) {
    if (!q0 || !q1) return;
    const z = (q0[2] + q1[2]) / 2;
    SG.push(q0[0], q0[1], q1[0], q1[1], a * fog(z), Math.max(.5 * DPR, wW * FP / z), kind);
  }
  const line = (pts, a, wW, kind) => { for (let i = 1; i < pts.length; i++) seg(pts[i - 1], pts[i], a, wW, kind); };
  const dot = (q, rW, kind, a) => { if (q) DT.push(q[0], q[1], Math.max(.6 * DPR, rW * FP / q[2]), kind, a * fog(q[2])); };
  const hwT = u => (44 + 11 * Math.sin(u * 5.2 + .6) + 70 * Math.pow(1 - u, 6)) * (1 + Math.max(0, u - .8) * 2.2);
  function trunkAxis(u) {
    const M = TRUNK.length, f = Math.min(M - 1e-4, Math.max(0, u * M)), j = Math.floor(f), s = f - j, n = N[TRUNK[j]], q = 1 - s;
    return [q * q * n.x0 + 2 * s * q * n.cx + s * s * n.x1, q * q * n.y0 + 2 * s * q * n.cy + s * s * n.y1];
  }
  const SNOW = [...Array(120)].map(() => ({ x: Math.random(), y: Math.random(), z: (Math.random() - .5) * 3000, v: .012 + Math.random() * .02, s: Math.random() }));
  function collect(t, dt) {
    SG = []; DT = [];
    for (let i = 0; i < N.length; i++) {   // 가지: 2차 곡선
      const n = N[i]; if (n.kind === 'trunk') continue;
      const z0 = n.p < 0 ? 0 : Z[n.p], z1 = Z[i], zc = (z0 + z1) / 2, pts = [];
      const K = n.kind === 'whip' ? 2 : 3;
      for (let k = 0; k <= K; k++) { const s = k / K, q = 1 - s; pts.push(P3(q * q * n.x0 + 2 * q * s * n.cx + s * s * n.x1, q * q * n.y0 + 2 * q * s * n.cy + s * s * n.y1, q * q * z0 + 2 * q * s * zc + s * s * z1)); }
      line(pts, n.kind === 'whip' ? .34 : .5, n.kind === 'whip' ? 1.5 : 2.1);
    }
    for (let li = 0; li < LINEAGE.length; li += 3) {   // 계보선 다발: 3분의 1만 (가볍게, 기둥이 덜 빽빽하게)
      const g = LINEAGE[li], ch = g.chain, pts = [P3(N[ch[0]].x0 + g.off * 70, N[ch[0]].y0, 0)];
      for (let j = 0; j < ch.length; j++) {
        const n = N[ch[j]], tr = n.kind === 'trunk', wdt = tr ? 120 - j * 9 : 7 + 30 * Math.exp(-(n.ft - 1) / 5);
        const sp = tr ? .5 * wdt * Math.sin(g.off * Math.PI * 2 + j * .62) : g.off * wdt;
        pts.push(P3(n.x1 - Math.sin(n.ang) * sp, n.y1 + Math.cos(n.ang) * sp, Z[ch[j]] + (tr ? Math.cos(g.off * Math.PI * 2 + j * .62) * wdt * .5 : 0)));
      }
      line(pts, .2, 1.1);
    }
    const spin = S.t * .05;                // 줄기: 띠가 감겨 오르는 3D 나선 + 묶음 철사 고리
    for (let k = 0; k < 6; k++) {          // 줄기 띠 6가닥
      const ph = k / 6 * Math.PI * 2, turns = k === 5 ? -.85 : 1.15 + (k % 3) * .12, amp = .9 + .08 * hs(k, 2), pts = [];
      for (let i = 0; i <= 36; i++) { const u = i / 36, a = ph + u * turns * Math.PI * 2 + spin, c = trunkAxis(u), r = hwT(u) * amp; pts.push(P3(c[0] + Math.cos(a) * r, c[1], Math.sin(a) * r)); }
      line(pts, .48, 1.8);
    }
    for (const u of [.12, .36, .62]) { const c = trunkAxis(u), r = hwT(u) * 1.02, pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(P3(c[0] + Math.cos(a) * r, c[1], Math.sin(a) * r)); } line(pts, .4, 1.2); }
    const bx = N[TRUNK[0]].x0;             // 뿌리 다리
    for (let k = 0; k < 6; k++) {          // 뿌리 다리 6개
      const a = k / 6 * Math.PI * 2 + hs(k, 5) * .5, kn = 40 + hs(k, 6) * 70, rr = 90 + hs(k, 7) * 160, h = 18 + hs(k, 8) * 34, pts = [];
      for (let i = 0; i <= 12; i++) { const s = i / 12, q = 1 - s; const r = q * q * q * hwT(0) * .45 + 3 * q * q * s * kn + 3 * q * s * s * kn * 1.3 + s * s * s * rr; const y = q * q * q * (h + 30) + 3 * q * q * s * h * .6 + 3 * q * s * s * 4; pts.push(P3(bx + Math.cos(a) * r, GROUND - Math.max(0, y), Math.sin(a) * r)); }
      line(pts, .5, 2);
    }
    for (const [rr, al] of [[120, .28], [300, .1]]) { const pts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; pts.push(P3(bx + Math.cos(a) * rr, GROUND + 3, Math.sin(a) * rr)); } line(pts, al, 1.2); }
    for (const r of ropes) { const n = N[r.node]; if (n) seg(P3(n.x1, n.y1, Z[r.node]), P3(r.pts[0].x, r.pts[0].y, Z[r.node]), .3, .9); }
    for (const b of birds) {                // 새: 작품과 같은 접힌 선
      const z = (hs(b.seed, 4) - .5) * 1400, left = Math.cos(b.heading) < 0, sx = (left ? -1 : 1) * 1.25, f = Math.sin(b.phase) * .5 + .5;
      const P = (px, py) => P3(b.x + px * sx, b.y + py * 1.25, z);
      for (const s of [[P(-16, 5), P(10, -3), P(17, -2)], [P(-3, 0), P(-12 + f * 2, -4 - 21 * f + (1 - f) * 6), P(5, -2)], [P(1, -1), P(4 + f * 4, -3 - 15 * f + (1 - f) * 5), P(8, -2)]]) line(s, .95, 2.2, 1);
      dot(P(-12 + f * 2, -4 - 21 * f + (1 - f) * 6), 2.6, 1, 1);
    }
    for (const L of LIGHTS) {               // 겨울: 금빛 전구, 붉은 열매
      const n = N[L.i]; if (!n) continue;
      dot(P3(n.x1, n.y1, Z[L.i]), L.red ? 3.6 : 4.4 * L.s, L.red ? 3 : 2, L.red ? .8 : .55 + .45 * Math.sin(S.t * L.sp + L.ph));
    }
    for (const f of SNOW) {                 // 눈
      f.y += f.v * dt * (REDUCE ? .3 : 1); if (f.y > 1.03) { f.y = -.03; f.x = Math.random(); }
      dot(P3(f.x * WW, f.y * WH, f.z), 2.4, 4, .45);
    }
  }

  // ------------------------------------------------ 방식 1: 아스키
  const RAMP = ' .\'`,:;-~=+*xo#%@', SCR = '.:-=+*#%@/\\|<>~^';
  const COL = [[255, 255, 255], [164, 224, 160], [246, 214, 150], [196, 86, 78], [255, 255, 255]];
  function toBuffers() {
    lx.globalCompositeOperation = 'source-over'; lx.fillStyle = '#000'; lx.fillRect(0, 0, LW, LH);
    ax.globalCompositeOperation = 'source-over'; ax.fillStyle = '#000'; ax.fillRect(0, 0, LW, LH);
    lx.globalCompositeOperation = ax.globalCompositeOperation = 'lighter';
    const sx = LW / W, sy = LH / H;
    strokeAll(lx, k => k === 0, sx, sy, () => COL[0], 1, .5);
    strokeAll(ax, k => k !== 0, sx, sy, k => COL[k], 1, .5);
    for (let i = 0; i < DT.length; i += 5) {
      const k = DT[i + 3], g = k === 4 || k === 0 ? lx : ax, c = COL[k];
      g.fillStyle = `rgba(${c},${DT[i + 4]})`; g.beginPath(); g.arc(DT[i] * sx, DT[i + 1] * sy, Math.max(.6, DT[i + 2] * sx), 0, 6.2832); g.fill();
    }
  }
  // 선을 밝기·굵기·종류별로 묶어 한 번에 그림
  function strokeAll(g, want, sx, sy, colOf, gain, minW) {
    const groups = new Map();
    for (let i = 0; i < SG.length; i += 7) {
      const k = SG[i + 6]; if (!want(k)) continue;
      const a = Math.min(1, SG[i + 4] * gain); const ab = Math.round(a * 12); if (ab < 1) continue;
      const wb = Math.round(Math.max(minW, SG[i + 5] * sx) * 2) / 2;
      const key = k * 10000 + ab * 100 + Math.min(99, wb * 2);
      let p = groups.get(key); if (!p) { p = { p: new Path2D(), k, a: ab / 12, w: wb }; groups.set(key, p); }
      p.p.moveTo(SG[i] * sx, SG[i + 1] * sy); p.p.lineTo(SG[i + 2] * sx, SG[i + 3] * sy);
    }
    g.lineCap = 'round';
    for (const q of groups.values()) { g.strokeStyle = `rgba(${colOf(q.k)},${q.a})`; g.lineWidth = q.w; g.stroke(q.p); }
  }
  function ascii(t, dis, alpha) {
    const L = lx.getImageData(0, 0, LW, LH).data, A = ax.getImageData(0, 0, LW, LH).data;
    ctx.font = `${(chh * .8).toFixed(1)}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const scr = 1 - sm(0, 1.6, t), tick = Math.floor(t * 18), sxg = W / LW, syg = H / LH, IV = [232, 227, 212];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const seed = seeds[r * cols + c];
      if (dis > 0 && seed < dis) continue;
      let s = 0, jxx = 0, jyy = 0, jxy = 0, ar = 0, ag = 0, ab = 0;
      const x0 = c * SS, y0 = r * SS;
      for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) {
        const X = x0 + xx, Y = y0 + yy, i = (Y * LW + X) * 4, v = L[i]; s += v; ar += A[i]; ag += A[i + 1]; ab += A[i + 2];
        if (X > 0 && X < LW - 1 && Y > 0 && Y < LH - 1) { const gx = (L[i + 4] - L[i - 4]) / sxg, gy = (L[i + LW * 4] - L[i - LW * 4]) / syg; jxx += gx * gx; jyy += gy * gy; jxy += gx * gy; }
      }
      const n = SS * SS, lv = s / n / 255, av = (ar + ag + ab) / n / 765, v = Math.max(lv, av * 1.2);
      const front = dis > 0 && seed - dis < .1;
      if (v < .035 && !(front && hs(c * 1.7 + tick, r) < .18)) continue;
      let ch, col = IV, a = clamp(.28 + v * 1.25, 0, 1);
      const tr = jxx + jyy, coh = tr > 0 ? Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / tr : 0;
      if (coh > .55 && v > .07 && v < .7) { let deg = ((.5 * Math.atan2(2 * jxy, jxx - jyy) + Math.PI / 2) * 180 / Math.PI) % 180; if (deg < 0) deg += 180; ch = deg < 22.5 || deg >= 157.5 ? '-' : deg < 67.5 ? '\\' : deg < 112.5 ? '|' : '/'; }
      else ch = RAMP[clamp(Math.floor(v * (RAMP.length - 1) * 1.15), 1, RAMP.length - 1)];
      if (av > lv * .6 && av > .03) { const m = Math.max(ar, ag, ab) || 1; col = [ar / m * 255 | 0, ag / m * 255 | 0, ab / m * 255 | 0]; if (!'-|/\\'.includes(ch)) ch = av > .25 ? '*' : '+'; a = clamp(.5 + av * 2, 0, 1); }
      if (scr > 0 && hs(c * 13.1 + r * 7.3, tick) < scr * .9) ch = SCR[(hs(c + r * 3.1, tick * .7) * SCR.length) | 0];
      if (front) { if (hs(c + tick, r) > .4) ch = SCR[(hs(c, r + tick) * SCR.length) | 0]; a = v < .035 ? .32 : Math.max(a, .6); }
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a * alpha})`;
      ctx.fillText(ch, c * cw + cw / 2, r * chh + chh / 2 + 1);
    }
  }

  // ------------------------------------------------ 방식 2: 작품의 가는 선·전구 모습
  const IVORY = [232, 227, 212], GOLD = [246, 214, 150], LEAF = [164, 224, 160], BERRY = [196, 86, 78];
  function lines() {
    strokeAll(ctx, k => k === 0, 1, 1, () => IVORY, .52, .55 * DPR);
    strokeAll(ctx, k => k === 1, 1, 1, () => IVORY, .9, .6 * DPR);
    for (let i = 0; i < DT.length; i += 5) {
      const x = DT[i], y = DT[i + 1], r = DT[i + 2], k = DT[i + 3], a = DT[i + 4];
      if (k === 2) { const R = r * 3.2, g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, `rgba(${GOLD},${.38 * a})`); g.addColorStop(1, `rgba(${GOLD},0)`); ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2); ctx.fillStyle = `rgba(${GOLD},${.55 + .4 * a})`; ctx.beginPath(); ctx.arc(x, y, r * .35, 0, 6.2832); ctx.fill(); }
      else { ctx.fillStyle = `rgba(${k === 3 ? BERRY : k === 1 ? LEAF : [240, 242, 248]},${k === 4 ? a * .55 : a})`; ctx.beginPath(); ctx.arc(x, y, k === 4 ? r * .45 : r * .6, 0, 6.2832); ctx.fill(); }
    }
  }

  // ------------------------------------------------ 걸린 말: 실제 글자 (한 번 그린 글자 비트맵을 크기만 바꿔 찍음)
  const GC = new Map(), GS = 72;
  function glyphImg(c, rgb) {
    const k = c + '|' + rgb; let g = GC.get(k);
    if (!g) { g = document.createElement('canvas'); g.width = g.height = GS; const x = g.getContext('2d'); x.font = `${GS * .78}px "Noto Serif KR", "AppleMyungjo", serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = `rgb(${rgb})`; x.fillText(c, GS / 2, GS / 2); GC.set(k, g); }
    return g;
  }
  function words(alpha) {
    const P = PAL[sel.color], items = [];
    for (const r of ropes) {
      const z = Z[r.node] || 0, n = Math.ceil(r.shown), la = LAYER[r.layer].a * r.alpha;
      for (let i = 0; i < n && i < r.chars.length; i++) {
        const c = r.chars[i]; if (c === ' ') continue;
        const p0 = r.pts[i], p1 = r.pts[i + 1] || p0, q = P3((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, z);
        if (q) items.push({ q, c, r, i, la: Math.max(la, r.fresh || 0) });
      }
    }
    items.sort((a, b) => b.q[2] - a.q[2]);
    for (const it of items) {
      const z = it.q[2], px = it.r.fs * FP / z;
      let a = it.la * fog(z) * (1 - sm(H * .055, H * .11, px)) * alpha; if (a < .02) continue;
      let col = P.text, dy = 0;
      if (it.r.ct && it.r.ct[it.i] !== undefined) { const age = S.t - it.r.ct[it.i]; const born = ease(clamp(age / .6, 0, 1)); a *= born; dy = (1 - born) * px * .9; if (age < 1.6) col = it.i % 2 ? BERRY : P.accent; }
      if (px < 4 * DPR) { ctx.fillStyle = `rgba(${col},${a * .8})`; ctx.fillRect(it.q[0] - DPR, it.q[1] - DPR, DPR * 2, DPR * 2); continue; }
      const s = px / .78; ctx.globalAlpha = a; ctx.drawImage(glyphImg(it.c, col), it.q[0] - s / 2, it.q[1] - dy - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------ 루프
  let clock = REDUCE ? T_DIS1 + 1 : 0, last = performance.now(), ready = false, copyShown = false;
  const copy = document.getElementById('copy'), skip = document.getElementById('skip');
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!ready) return;
    clock += dt;
    const t0 = performance.now();
    draw(dt);
    const ms = performance.now() - t0;
    QUAL.acc += ms; QUAL.n++;
    if (QUAL.n >= 45) {                       // 약 0.75초마다 평균을 보고, 22ms를 넘으면 해상도를 한 단계 낮춤
      if (QUAL.acc / QUAL.n > 22 && QUAL.level < QUAL.caps.length - 1) { QUAL.level++; resize(); }
      QUAL.acc = 0; QUAL.n = 0;
    }
  }
  function draw(dt) {
    simStep(dt);
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 1.5); mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 1.5);
    computeZ(); camera(clock);
    collect(clock, dt);
    const dis = sm(T_DIS0, T_DIS1, clock);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0b0a'; ctx.fillRect(0, 0, W, H);
    if (dis > 0) lines();                                          // 아래에 작품의 선 모습
    if (dis < 1) {                                                 // 위에 아직 넘어가지 않은 칸만 아스키로 덮음
      if (dis > 0) { ctx.fillStyle = '#0a0b0a'; for (let r = 0; r < rows; r++) { let run = -1; for (let c = 0; c <= cols; c++) { const on = c < cols && seeds[r * cols + c] >= dis; if (on && run < 0) run = c; if (!on && run >= 0) { ctx.fillRect(run * cw, r * chh, (c - run) * cw, chh); run = -1; } } } }
      toBuffers(); ascii(clock, dis, sm(0, .9, clock));
    }
    words(sm(2.4, 5.2, clock));
    const vg = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .35, W / 2, H * .45, Math.hypot(W, H) * .6);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (!copyShown && clock > T_COPY) { copyShown = true; document.body.classList.add('settled'); }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; });
  if (skip) skip.addEventListener('click', () => { clock = Math.max(clock, T_DIS1 + .2); });
  window.__landing = { seek: t => { clock = t; }, renderAt: t => { clock = t; draw(1 / 60); } };   // 점검용
  resize();
  // 웹폰트는 최대 1.2초만 기다림 (늦게 오면 글자 캐시를 비워 다시 그림)
  const fontsReady = Promise.all(['40px "Noto Serif KR"', '16px "IBM Plex Mono"'].map(f => document.fonts.load(f, '말 걸다 -|/').catch(() => {})));
  fontsReady.then(() => GC.clear());
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1200))])
    .finally(() => { seedRopes(); ready = true; requestAnimationFrame(frame); });
})();
