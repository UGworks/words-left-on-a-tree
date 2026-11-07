/* 말을 걸어 두는 나무 — 오프닝 프리비즈
 * 뿌리·줄기 클로즈업에서 나무를 오빗으로 훑으며 줌아웃, 걸린 말들과 날아다니는 새가 드러난다.
 * 장면(나무·새·눈·전구)은 아스키로, 걸린 말은 실제 글자로 3D 위치에 맞춰 그린다.
 * render(t)는 결정적이라 프레임 단위로 뽑아 영상으로 묶을 수 있다. */
(() => {
  'use strict';
  const W = 1920, H = 1080, FPS = 30, DUR = 18;
  const CW = 10, CH = 18;                       // 아스키 셀 (화면 px)
  const COLS = W / CW | 0, ROWS = H / CH | 0;   // 192 × 60
  const SS = 4;                                 // 밝기 버퍼 초표본
  const LW = COLS * SS, LH = ROWS * SS;         // 768 × 240
  const VFOV = 38 * Math.PI / 180, F = (H / 2) / Math.tan(VFOV / 2), NEAR = 12;
  const IVORY = [232, 227, 212], TEXT = [242, 237, 224], LEAF = [164, 224, 160], GOLD = [246, 214, 150], BERRY = [196, 86, 78];

  const cv = document.getElementById('stage'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const lum = document.createElement('canvas'); lum.width = LW; lum.height = LH;
  const lx = lum.getContext('2d', { willReadFrequently: true });
  const acc = document.createElement('canvas'); acc.width = LW; acc.height = LH;
  const ax = acc.getContext('2d', { willReadFrequently: true });

  // ------------------------------------------------ 수학
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // CSS cubic-bezier 이징
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax_ = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = s => ((ax_ * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax_ * s + 2 * bx) * s + cx;
    return x => { x = clamp(x, 0, 1); let s = x; for (let i = 0; i < 8; i++) { const d = dX(s); if (Math.abs(d) < 1e-6) break; s -= (X(s) - x) / d; } return Y(clamp(s, 0, 1)); };
  }
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // ------------------------------------------------ 나무 (3D)
  const R = rng(23);
  const TH = 330;
  const axis = u => [18 * Math.sin(u * Math.PI * 1.2 - .4), u * TH, 12 * Math.sin(u * Math.PI * .9 + .3)];
  const hw = u => (34 + 9 * Math.sin(u * 5.2 + .6) + 55 * Math.pow(1 - u, 6)) * (1 + Math.max(0, u - .8) * 2.2);

  const LIMBS = [];
  // 큰 가지 13개: 아래 가지일수록 길고 낮게, 위로 갈수록 짧고 조금 더 솟음 → 넓게 늘어지는 돔
  const NL = 13;
  for (let k = 0; k < NL; k++) {
    const h = ((k * 5) % NL) / (NL - 1);            // 높이 순서를 방위와 섞음
    const u0 = .56 + .42 * h + R() * .02;
    LIMBS.push({ u0, phi: k * Math.PI * 2 / NL + (R() - .5) * .3, L: (760 - 260 * h) * (.9 + R() * .2), rise: 60 + 70 * h + R() * 25, drop: 230 + R() * 90, curl: (R() - .5) * .5, subs: [] });
  }
  // 아치형 가지: s=0..1 → 바깥·위로 뻗다가 끝에서 처짐
  function limbPoint(l, s, t, base) {
    const b = base || axis(l.u0);
    const r = l.L * s;
    const y = l.rise * Math.sin(Math.min(1, s / .55) * Math.PI / 2) - l.drop * Math.pow(Math.max(0, (s - .45) / .55), 1.8);
    const phi = l.phi + l.curl * s;
    const w = (Math.sin(t * .42 + phi * 1.7) * .6 + Math.sin(t * .23 + phi) * .4) * 26 * s * s;   // 바람
    return [b[0] + Math.cos(phi) * r - Math.sin(phi) * w, b[1] + y, b[2] + Math.sin(phi) * r + Math.cos(phi) * w];
  }
  for (const l of LIMBS) {
    for (const s0 of [.22, .36, .5, .66]) {
      if (R() < .2) continue;
      l.subs.push({ s0, phi: l.phi + l.curl * s0 + (R() < .5 ? -1 : 1) * (.28 + R() * .22), L: l.L * (1 - s0) * (.75 + R() * .3), rise: 25 + R() * 35, drop: 120 + R() * 70, curl: (R() - .5) * .4 });
    }
  }
  // 늘어진 가지 자리
  const WHIPS = [];
  for (let li = 0; li < LIMBS.length; li++) {
    const l = LIMBS[li];
    for (let s = .3; s < .98; s += .055) if (R() < .7) WHIPS.push({ li, sub: -1, s, len: 50 + R() * 110, drift: 10 + R() * 25 });
    l.subs.forEach((sb, si) => { for (let s = .25; s < .98; s += .08) if (R() < .7) WHIPS.push({ li, sub: si, s, len: 40 + R() * 90, drift: 8 + R() * 20 }); });
  }
  const subPoint = (l, sb, s, t) => limbPoint(sb, s, t, limbPoint(l, sb.s0, t));
  const whipBase = (w, t) => { const l = LIMBS[w.li]; return w.sub < 0 ? limbPoint(l, w.s, t) : subPoint(l, l.subs[w.sub], w.s, t); };

  // 계보선 다발: 뿌리에서 줄기를 감아 오르다 가지를 따라 갈라짐
  const STRANDS = [];
  LIMBS.forEach((l, li) => { for (let j = 0; j < 9; j++) STRANDS.push({ li, th: R() * Math.PI * 2, off: (R() - .5) * 2 }); });

  // 걸린 말: 가지 위 후보 자리에서 고르게 50곳
  const TEXTS = ['퇴근길 버스에서 본 노을이 너무 예뻐서 혼자 보기 아까웠다', '오늘도 수고했어 나 자신', '할아버지 손 한 번 더 잡아드릴걸', '퇴사했습니다 무서운데 조금 설레요',
    '보고싶다는 말은 왜 늘 늦게 도착할까', '첫눈 오면 전화하기로 한 약속 아직 유효한가요', '조금 늦어도 괜찮아 꽃은 다 다른 계절에 피니까', '딸아 너는 존재만으로 충분해',
    '내가 나를 조금 더 아껴주기로 했다', '사랑한다는 말 오늘은 꼭 직접 할게', '새벽 네 시 편의점 알바 중 오늘따라 달이 크다', '네가 웃으면 나도 좋아 그게 다야',
    '고마워 그리고 미안해 그리고 많이 보고 싶어', '오늘 처음으로 거절을 했다 생각보다 괜찮았어', '네가 보내준 편지 아직도 서랍에 있어', '바다 보러 가자던 약속 올해는 지키자',
    '처음 만난 날 기억나? 나는 다 기억나', '오늘따라 바람이 좋다 그냥 그렇다고', '지금 이 순간도 언젠가 그리워지겠지', '가을이 오면 생각나는 사람이 있다',
    '할 수 있다 할 수 있다 할 수 있다', '반려식물 몬스테라 새 잎 났다 기특해', '누가 뭐래도 너는 너대로 예뻐', '엄마 아빠 결혼 30주년 축하드려요',
    '마음 놓고 울 수 있는 곳이 있어서 다행이야', '내년 이맘때 이 나무 다시 보러 올게', '기다려줘서 고마워 이제 거의 다 왔어', '처음 본 바다처럼 매일이 새로웠으면',
    '힘내라는 말 대신 같이 있어줄게', '잘하고 있어 생각보다 훨씬', '첫 출근 떨린다 실수해도 괜찮겠지', '오늘 하루도 무사히 끝 다들 푹 자요',
    '함께여서 버틸 수 있었던 날들에게', '작은 일에 웃는 사람이 되고 싶다', '네가 좋아하던 노래 오늘 카페에서 나왔어', '엄마가 싸준 김밥 먹다가 괜히 울컥했네',
    '그 노래 들으면 아직도 네 생각나', '결혼합니다 같이 걸어줄 사람이 생겼어요', '여기 나무 예쁘다 다음엔 너랑 같이 와야지', '고양이가 오늘 처음으로 내 무릎에 올라왔다 감동',
    '할머니 집 앞 감나무 올해도 열렸을까', '나 이제 커피 끊었다 3일째 ㅋㅋ', '주말에 엄마랑 시장 가기로 했다 오랜만이야', '이번 겨울은 덜 추웠으면 좋겠다 모두에게',
    '꿈에 나와줘서 고마워 할머니 웃고 계셔서 다행이야', '너와 나 사이에 아직 할 말이 남아 있어서 다행이야', '밥 먹었냐는 말이 이렇게 따뜻한 말인 줄 몰랐다', '오래 걸렸지만 이제 나를 용서하기로 했어',
    '아무 일도 없는 하루가 사실 제일 고마운 하루였어', '나무야 너는 여기서 많은 말을 듣겠구나 다 잘 간직해줘'];
  const cand = [];
  LIMBS.forEach((l, li) => {
    for (let s = .36; s <= .86; s += .05) cand.push({ li, sub: -1, s });
    l.subs.forEach((sb, si) => { for (let s = .3; s <= .9; s += .1) cand.push({ li, sub: si, s }); });
  });
  const anchorAt = (c, t) => { const l = LIMBS[c.li]; return c.sub < 0 ? limbPoint(l, c.s, t) : subPoint(l, l.subs[c.sub], c.s, t); };
  cand.forEach(c => { const p = anchorAt(c, 0); c.p = p; c.ang = Math.atan2(p[2], p[0]); });
  const picked = [];
  const pool = cand.filter(c => c.p[1] > 300).sort((a, b) => a.ang - b.ang);
  for (const c of pool) if (picked.every(q => Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2]) > 95)) picked.push(c);
  const ROPES = picked.slice(0, TEXTS.length).map((c, i) => {
    const chars = [...TEXTS[i]];
    const fs = Math.min(17, (c.p[1] - 36) / (chars.length * 1.32));
    return { c, chars, fs, step: fs * 1.32, seed: hash(i * 7.7) * 100, layer: i % 3 };
  });

  // 전구·열매: 가지 위 자리
  const BULBS = [];
  for (let i = 0; i < 90; i++) { const c = cand[(R() * cand.length) | 0]; BULBS.push({ c, ds: (R() - .5) * .04, kind: R() < .18 ? 'berry' : 'gold', ph: R() * 6.28 }); }

  // 새
  const BIRDS = [...Array(11)].map((_, k) => ({ rb: 520 + R() * 700, hb: 400 + R() * 300, w: (.16 + R() * .12) * (k % 2 ? 1 : -1), ph: R() * 6.28, te: 5.2 + k * .55, s: .9 + R() * .4 }));

  // 눈
  const SNOW = [...Array(300)].map(() => ({ r: Math.sqrt(R()) * 1600, a: R() * 6.28, y: R() * 950, v: 14 + R() * 22, sw: R() * 6.28 }));

  // ------------------------------------------------ 카메라
  const eMain = bezier(.42, 0, .12, 1);      // 천천히 출발, 길게 감속하며 정착
  function camera(t) {
    const u = eMain((t - 1.0) / 14.0);
    const az = -.35 + 3.85 * u + .03 * t;                       // 약 -20° → 200°
    const ur = smooth(.1, 1, u);
    const rad = 230 * Math.exp(Math.log(1500 / 230) * ur);       // 지수형 줌아웃 (거리감이 고르게)
    const camY = 38 + (300 - 38) * smooth(.04, .9, u);
    const tY = 85 + (300 - 85) * smooth(0, .85, u);
    const ta = axis(clamp(tY / TH, 0, 1));
    const tgt = [lerp(ta[0], 0, ur), tY, lerp(ta[2], 0, ur)];
    const pos = [tgt[0] + Math.cos(az) * rad, camY, tgt[2] + Math.sin(az) * rad];
    return { pos, tgt, u };
  }
  let C, Rv, Uv, Fv;
  function setCam(cam) {
    C = cam.pos; Fv = norm(sub(cam.tgt, C)); Rv = norm(cross(Fv, [0, 1, 0])); Uv = cross(Rv, Fv);
  }
  function proj(p) {
    const d = sub(p, C);
    const z = d[0] * Fv[0] + d[1] * Fv[1] + d[2] * Fv[2];
    if (z < NEAR) return null;
    const x = d[0] * Rv[0] + d[1] * Rv[1] + d[2] * Rv[2], y = d[0] * Uv[0] + d[1] * Uv[1] + d[2] * Uv[2];
    return [W / 2 + x * F / z, H / 2 - y * F / z, z];
  }
  const fog = z => clamp(1.25 - z / 4200, .3, 1);

  // ------------------------------------------------ 밝기 버퍼에 선 그리기 (밝기 단계별로 묶어 한 번에)
  const NB = 10;
  let buckets;
  const resetBuckets = () => { buckets = [...Array(NB)].map(() => []); };
  function poly(pts, a, wWorld) {
    let prev = null;
    for (const p of pts) {
      const q = proj(p);
      if (q && prev) {
        const z = (q[2] + prev[2]) / 2;
        const al = a * fog(z);
        const b = clamp(Math.round(al * (NB - 1)), 0, NB - 1);
        if (b > 0) buckets[b].push(prev[0], prev[1], q[0], q[1], Math.max(.55, wWorld * F / z * LW / W));
      }
      prev = q;
    }
  }
  function flush(g, rgb) {
    const sx = LW / W, sy = LH / H;
    g.lineCap = 'round';
    for (let b = 1; b < NB; b++) {
      const arr = buckets[b]; if (!arr.length) continue;
      const al = b / (NB - 1);
      // 굵기도 몇 단계로 묶음
      const byW = new Map();
      for (let i = 0; i < arr.length; i += 5) { const wk = Math.min(6, Math.round(arr[i + 4] * 2) / 2); let p = byW.get(wk); if (!p) { p = new Path2D(); byW.set(wk, p); } p.moveTo(arr[i] * sx, arr[i + 1] * sy); p.lineTo(arr[i + 2] * sx, arr[i + 3] * sy); }
      g.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${al})`;
      for (const [wk, p] of byW) { g.lineWidth = wk; g.stroke(p); }
    }
  }
  function dot(g, p, r, rgb, a) {
    const q = proj(p); if (!q) return;
    const rr = Math.max(.6, r * F / q[2] * LW / W);
    g.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * fog(q[2])})`;
    g.beginPath(); g.arc(q[0] * LW / W, q[1] * LH / H, rr, 0, 6.2832); g.fill();
  }

  // ------------------------------------------------ 장면을 버퍼에
  function drawScene(t) {
    lx.globalCompositeOperation = 'source-over'; lx.fillStyle = '#000'; lx.fillRect(0, 0, LW, LH);
    ax.globalCompositeOperation = 'source-over'; ax.fillStyle = '#000'; ax.fillRect(0, 0, LW, LH);
    lx.globalCompositeOperation = 'lighter'; ax.globalCompositeOperation = 'lighter';
    resetBuckets();
    const spin = t * .05;
    // 줄기: 여러 가닥의 띠가 감겨 오름
    for (let k = 0; k < 16; k++) {
      const ph = k / 16 * Math.PI * 2, turns = (k % 4 === 3 ? -.85 : 1.15 + (k % 3) * .12), amp = .9 + .08 * hash(k);
      const pts = [];
      for (let i = 0; i <= 56; i++) { const u = i / 56, a = ph + u * turns * Math.PI * 2 + spin, c = axis(u), r = hw(u) * amp; pts.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]); }
      poly(pts, .55, 1.4);
    }
    // 묶음 철사 고리
    for (const u of [.08, .13, .18, .3, .36, .55, .6, .65, .7]) {
      const c = axis(u), r = hw(u) * 1.03, pts = [];
      for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a * 2) * 2, c[2] + Math.sin(a) * r]); }
      poly(pts, .5, 1);
    }
    // 뿌리 다리
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2 + hash(k) * .4, kn = 60 + hash(k + 3) * 60, rr = 150 + hash(k + 7) * 170, h = 20 + hash(k + 9) * 34;
      const s0 = [Math.cos(a) * hw(0) * .45, h + 26, Math.sin(a) * hw(0) * .45], pts = [];
      for (let i = 0; i <= 14; i++) {
        const s = i / 14, q = 1 - s;
        const r = q * q * q * hw(0) * .45 + 3 * q * q * s * kn + 3 * q * s * s * (kn * 1.3) + s * s * s * rr;
        const y = q * q * q * s0[1] + 3 * q * q * s * (h * .6) + 3 * q * s * s * 4 + 0;
        pts.push([Math.cos(a) * r, Math.max(0, y), Math.sin(a) * r]);
      }
      poly(pts, .5, 1.6);
    }
    // 땅 위 원
    for (const [rr, al] of [[130, .35], [280, .18], [520, .08]]) { const pts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; pts.push([Math.cos(a) * rr, 0, Math.sin(a) * rr]); } poly(pts, al, 1); }
    // 계보선 다발
    for (const st of STRANDS) {
      const l = LIMBS[st.li], pts = [];
      for (let i = 0; i <= 18; i++) { const u = i / 18 * l.u0, c = axis(u), a = st.th + u * 3.4 + spin, r = hw(u) * .55; pts.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]); }
      for (let i = 1; i <= 20; i++) { const s = i / 20, p = limbPoint(l, s, t), ph = l.phi + l.curl * s; const o = st.off * 26 * (1 - s * .8); pts.push([p[0] - Math.sin(ph) * o, p[1] + st.off * 6 * (1 - s), p[2] + Math.cos(ph) * o]); }
      poly(pts, .16, .8);
    }
    // 가지
    for (const l of LIMBS) {
      const pts = []; for (let i = 0; i <= 26; i++) pts.push(limbPoint(l, i / 26, t)); poly(pts, .62, 2);
      for (const sb of l.subs) { const q = []; for (let i = 0; i <= 14; i++) q.push(subPoint(l, sb, i / 14, t)); poly(q, .45, 1.3); }
    }
    // 늘어진 가지
    for (const w of WHIPS) {
      const b = whipBase(w, t), l = LIMBS[w.li], ph = l.phi, pts = [b];
      const sw = Math.sin(t * .7 + w.s * 9 + w.li) * 6;
      for (let j = 1; j <= 5; j++) { const f = j / 5; pts.push([b[0] + Math.cos(ph) * w.drift * Math.pow(f, 1.5) - Math.sin(ph) * sw * f, b[1] - w.len * f, b[2] + Math.sin(ph) * w.drift * Math.pow(f, 1.5) + Math.cos(ph) * sw * f]); }
      poly(pts, .3, .9);
    }
    // 말이 걸린 실 (가지 → 첫 글자)
    for (const rp of ROPES) { const a = anchorAt(rp.c, t); poly([a, [a[0], a[1] - 10, a[2]]], .3, .6); }
    flush(lx, [255, 255, 255]);

    // 눈
    for (const s of SNOW) { const y = ((s.y - s.v * t) % 950 + 950) % 950; const a = s.a + Math.sin(t * .3 + s.sw) * .02; dot(lx, [Math.cos(a) * s.r, y, Math.sin(a) * s.r], 2.2, [255, 255, 255], .5); }

    // 강조색 버퍼: 새(연두), 전구(금빛), 열매(빨강)
    resetBuckets();
    for (const b of BIRDS) {
      const e = smooth(b.te, b.te + 2.6, t); if (e <= 0) continue;
      const rr = b.rb * (1 + 2.6 * (1 - e)), phi = b.ph + b.w * t;
      const p = [Math.cos(phi) * rr, b.hb + Math.sin(t * .7 + b.ph) * 30, Math.sin(phi) * rr];
      const d = norm([-Math.sin(phi) * Math.sign(b.w), 0, Math.cos(phi) * Math.sign(b.w)]), rv = norm(cross(d, [0, 1, 0]));
      const f = Math.sin(t * 8.5 + b.ph * 3), sz = 15 * b.s;
      const wing = (sd) => add(add(p, mul(rv, sd * sz)), add([0, (f * .9 + .25) * sz * .7, 0], mul(d, -sz * .25)));
      poly([sub(p, mul(d, sz * .7)), add(p, mul(d, sz * .55))], e, 1.6);
      poly([wing(-1), p, wing(1)], e, 1.4);
    }
    flush(ax, LEAF);
    for (const bl of BULBS) {
      const c = { ...bl.c, s: clamp(bl.c.s + bl.ds, 0, 1) }; const p = anchorAt(c, t);
      const tw = .55 + .45 * Math.sin(t * 1.7 + bl.ph);
      dot(ax, [p[0], p[1] - 6, p[2]], bl.kind === 'gold' ? 4.2 : 3.4, bl.kind === 'gold' ? GOLD : BERRY, bl.kind === 'gold' ? tw : .8);
    }
  }

  // ------------------------------------------------ 버퍼 → 아스키
  const RAMP = ' .\'`,:;-~=+*xo#%@';
  const SCRAMBLE = '.:-=+*#%@/\\|<>~^';
  function asciiPass(t, alpha) {
    const L = lx.getImageData(0, 0, LW, LH).data, A = ax.getImageData(0, 0, LW, LH).data;
    ctx.font = '15px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const scr = 1 - smooth(0, 1.5, t), tick = Math.floor(t * 18);
    const sxg = W / LW, syg = H / LH;   // 버퍼 px → 화면 px (방향 보정)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let s = 0, jxx = 0, jyy = 0, jxy = 0, ar = 0, ag = 0, ab = 0;
        const x0 = c * SS, y0 = r * SS;
        for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) {
          const X = x0 + xx, Y = y0 + yy, i = (Y * LW + X) * 4;
          const v = L[i]; s += v; ar += A[i]; ag += A[i + 1]; ab += A[i + 2];
          if (X > 0 && X < LW - 1 && Y > 0 && Y < LH - 1) {
            const gx = (L[i + 4] - L[i - 4]) / sxg, gy = (L[i + LW * 4] - L[i - LW * 4]) / syg;
            jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;
          }
        }
        const n = SS * SS, lv = s / n / 255, av = (ar + ag + ab) / n / 255 / 3;
        const v = Math.max(lv, av * 1.2);
        if (v < .035) continue;
        let ch, col = IVORY, a = clamp(.28 + v * 1.25, 0, 1);
        const tr = jxx + jyy, coh = tr > 0 ? Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / tr : 0;
        if (coh > .55 && v > .07 && v < .7) {
          // 밝기 기울기 방향의 수직 = 선 방향 (화면 y는 아래로)
          const g = .5 * Math.atan2(2 * jxy, jxx - jyy) + Math.PI / 2;
          let deg = (g * 180 / Math.PI) % 180; if (deg < 0) deg += 180;
          ch = deg < 22.5 || deg >= 157.5 ? '-' : deg < 67.5 ? '\\' : deg < 112.5 ? '|' : '/';
        } else {
          ch = RAMP[clamp(Math.floor(v * (RAMP.length - 1) * 1.15), 1, RAMP.length - 1)];
        }
        if (av > lv * .6 && av > .03) {          // 새·전구·열매 색
          const m = Math.max(ar, ag, ab) || 1; col = [ar / m * 255 | 0, ag / m * 255 | 0, ab / m * 255 | 0];
          if (ch !== '-' && ch !== '|' && ch !== '/' && ch !== '\\') ch = av > .25 ? '*' : '+';
          a = clamp(.5 + av * 2, 0, 1);
        }
        if (scr > 0 && hash(c * 13.1 + r * 7.3 + tick) < scr * .9) ch = SCRAMBLE[(hash(c + r * 3.1 + tick * .7) * SCRAMBLE.length) | 0];
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a * alpha})`;
        ctx.fillText(ch, c * CW + CW / 2, r * CH + CH / 2 + 1);
      }
    }
  }

  // ------------------------------------------------ 걸린 말: 실제 글자를 3D 위치에
  const camAz = t => -.35 + 3.85 * eMain((t - 1.0) / 14.0) + .03 * t;
  function revealTime(rp) {
    // 카메라가 그 방향을 지나갈 때 드러남 (찾아내는 느낌), 4~12초 사이
    for (let t = 0; t <= 16; t += .1) { const a = camAz(t), d = Math.atan2(Math.sin(rp.c.ang - a - 1.2), Math.cos(rp.c.ang - a - 1.2)); if (Math.abs(d) < .5 && t > 3.2) return clamp(t, 3.6, 12) + hash(rp.seed) * .8; }
    return 9 + hash(rp.seed) * 3;
  }
  ROPES.forEach(rp => { rp.rt = revealTime(rp); });
  const LAYER_A = [1, .82, .62];
  function drawWords(t, alpha) {
    const items = [];
    for (const rp of ROPES) {
      const rv = smooth(rp.rt, rp.rt + 1.6, t); if (rv <= 0) continue;
      const a0 = anchorAt(rp.c, t), ph = rp.c.ang;
      const tang = [-Math.sin(ph), 0, Math.cos(ph)];
      const sw = Math.sin(t * .62 + rp.seed) * .05 + Math.sin(t * 1.1 + rp.seed * 2) * .02;
      const shown = Math.min(rp.chars.length, Math.floor((t - rp.rt) * 9 + 1));   // 한 자씩 적힘
      for (let i = 0; i < shown; i++) {
        const ch = rp.chars[i]; if (ch === ' ') continue;
        const d = 14 + (i + .5) * rp.step;
        const p = [a0[0] + tang[0] * Math.sin(sw) * d, a0[1] - d * Math.cos(sw), a0[2] + tang[2] * Math.sin(sw) * d];
        const q = proj(p); if (!q) continue;
        items.push({ q, ch, rp, i, rv });
      }
    }
    items.sort((a, b) => b.q[2] - a.q[2]);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const it of items) {
      const z = it.q[2], px = it.rp.fs * F / z;
      const near = smooth(70, 180, z);                     // 카메라 바로 앞은 흐리게
      let a = it.rv * LAYER_A[it.rp.layer] * fog(z) * near * alpha;
      if (a < .02) continue;
      const fresh = clamp(1 - (t - it.rp.rt - it.i / 9) / 1.4, 0, 1);   // 막 적힌 글자는 연두에서 흰색으로
      const col = [lerp(TEXT[0], LEAF[0], fresh), lerp(TEXT[1], LEAF[1], fresh), lerp(TEXT[2], LEAF[2], fresh)].map(v => v | 0);
      if (px < 6) { ctx.fillStyle = `rgba(${col},${a * .8})`; ctx.fillRect(it.q[0] - .8, it.q[1] - .8, 1.6, 1.6); continue; }
      ctx.font = `${px.toFixed(1)}px "Nanum Myeongjo", "AppleMyungjo", serif`;
      ctx.fillStyle = `rgba(${col},${a})`;
      ctx.fillText(it.ch, it.q[0], it.q[1]);
    }
  }

  // ------------------------------------------------ 한 프레임
  function render(t) {
    t = clamp(t, 0, DUR);
    setCam(camera(t));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0b0a'; ctx.fillRect(0, 0, W, H);
    const fadeIn = smooth(0, .9, t), fadeOut = 1 - smooth(DUR - .6, DUR, t);
    drawScene(t);
    asciiPass(t, fadeIn * fadeOut);
    drawWords(t, fadeIn * fadeOut);
    // 비네트
    const vg = ctx.createRadialGradient(W / 2, H * .52, H * .35, W / 2, H * .52, W * .62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // 제목
    const ta = smooth(15.4, 16.8, t) * fadeOut;
    if (ta > 0) {
      // 제목 뒤 아래쪽을 가라앉혀 밑동과 겹치지 않게
      const band = ctx.createLinearGradient(0, H - 260, 0, H);
      band.addColorStop(0, 'rgba(10,11,10,0)'); band.addColorStop(.55, `rgba(10,11,10,${.82 * ta})`); band.addColorStop(1, `rgba(10,11,10,${.92 * ta})`);
      ctx.fillStyle = band; ctx.fillRect(0, H - 260, W, 260);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = `rgba(242,237,224,${ta})`; ctx.font = '400 44px "Nanum Myeongjo", serif';
      ctx.fillText('말을 걸어 두는 나무', W / 2, H - 92);
      ctx.fillStyle = `rgba(160,156,146,${ta})`; ctx.font = '500 14px "JetBrains Mono", monospace';
      ctx.fillText('W O R D S   L E F T   O N   A   T R E E', W / 2, H - 58);
    }
    return t;
  }

  window.__render = render;
  window.__meta = { W, H, FPS, DUR, frames: Math.round(DUR * FPS) };

  // ------------------------------------------------ 미리보기 조작
  const scrub = document.getElementById('scrub'), tc = document.getElementById('tc'), playBtn = document.getElementById('play');
  let playing = true, t0 = performance.now(), cur = 0;
  function tickLoop(now) {
    if (playing) { cur = ((now - t0) / 1000) % DUR; scrub.value = cur; }
    render(cur); tc.textContent = cur.toFixed(2) + ' s';
    requestAnimationFrame(tickLoop);
  }
  scrub.max = DUR; scrub.step = 1 / FPS;
  scrub.addEventListener('input', () => { playing = false; cur = +scrub.value; playBtn.textContent = '재생'; });
  playBtn.addEventListener('click', () => { playing = !playing; t0 = performance.now() - cur * 1000; playBtn.textContent = playing ? '일시정지' : '재생'; });
  addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); playBtn.click(); } });
  const params = new URLSearchParams(location.search);
  Promise.all(['15px "JetBrains Mono"', '40px "Nanum Myeongjo"'].map(f => document.fonts.load(f, '말 걸다 -|/\\'))).catch(() => {}).finally(() => {
    if (params.has('t')) { playing = false; cur = +params.get('t'); playBtn.textContent = '재생'; }
    if (!params.has('record')) requestAnimationFrame(tickLoop);
    document.body.classList.add('ready');
  });

  // 프레임을 하나씩 뽑아 로컬 수신기로 보냄 (영상 만들기용)
  window.__record = async (url, from = 0, to = window.__meta.frames, q = .93) => {
    playing = false;
    for (let f = from; f < to; f++) {
      render(f / FPS);
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
      await fetch(`${url}?f=${f}`, { method: 'POST', body: blob });
    }
    return to - from;
  };
})();
