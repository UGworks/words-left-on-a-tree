"""가시나무에 매달린 말들 — TouchDesigner 연결부.

gasinamu COMP 안의 Execute DAT(engine)가 매 프레임 frame()을 부르고,
Script CHOP들이 cook_*()으로 이번 프레임의 그리기 데이터를 받아 간다.
"""
import os, sys, json, math, time, socket, traceback
import numpy as np
try:
    from td import *   # op, absTime, project, textTOP … (TD 안에서만)
except ImportError:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path: sys.path.insert(0, HERE)
import gsn_sim as G

LOG = os.path.join(HERE, 'td_log.txt')
CMD = os.path.join(HERE, 'td_cmd.py')
SERIF_FONT = '/System/Library/Fonts/Supplemental/AppleMyungjo.ttf'
PAGE = 250        # 인스턴스 텍스처 배열은 약 256장까지만 쓰여서 글자를 250장씩 나눠 그림
PAGES = 4

S = {
    'root': None, 'sim': None, 'out': None, 'segs': None,
    'glyph_keys': {}, 'glyph_paths': [], 'glyph_dirty': False,
    'cmd_mtime': None, 'last_err': 0.0, 'frame': 0,
    'audio_buf': np.zeros(2048, np.float32), 'audio_smooth': None,
    'mus': {'hi':[-200.]*4, 'lo':[0.]*4, 'avg':[0.]*4, 'val':[0.]*4},
    'vis': {'ok':False, 'last':0.0, 'people':[], 'backend':'', 'try':0.0},
    'chan_names': {},
}

def log(*a):
    try:
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(time.strftime('%H:%M:%S ')+' '.join(str(x) for x in a)+'\n')
    except Exception:
        pass

def R(): return op(S['root'])

# ---------------------------------------------------------------- 시작
def init(root):
    S['root'] = root.path
    G.FONT_SCALE = 1.0
    S['sim'] = G.Sim()
    apply_pars(root, regrow=False)
    S['glyph_keys'] = {}; S['glyph_paths'] = []
    gl = root.op('glyphs')
    if gl:
        for c in list(gl.children):
            if c.name != 'g_tmp': c.destroy()
    # 처음 걸리는 문장들의 글자를 미리 만들어 둠
    for txt in G.GUEST+G.DECK:
        for ch in txt:
            if ch != ' ': glyph_index(('serif', ch))
    for ch in '0123456789.:':
        glyph_index(('mono', ch)); glyph_index(('serif', ch))
    sync_glyph_textures()
    log('init: nodes', S['sim'].T.M, 'ropes', len(S['sim'].ropes), 'glyphs', len(S['glyph_paths']))

def apply_pars(root, regrow=True):
    sim = S['sim']; p = root.par
    def g(name, default):
        try: return getattr(p, name).eval()
        except Exception: return default
    G.SEL['set'] = g('Set', 'guest'); G.SEL['color'] = g('Color', 'ivory'); G.SEL['hl'] = g('Highlight', 'spread')
    G.SEL['text'] = g('Textmode', 'vertical'); G.SEL['idle'] = 'on' if g('Idle', 1) else 'off'; G.SEL['cam'] = g('Transition', 'dissolve')
    sim.sim_count = int(g('Simcount', 0)); sim.sim_approach = float(g('Approach', 0.0))
    sim.cams['far'] = float(g('Camfar', .25)); sim.cams['near'] = float(g('Camnear', .8))
    sim.music['react'] = float(g('React', 1.0))
    op_ = float(g('Openness', .5))
    if regrow and abs(op_-sim.open) > 1e-4:
        texts = [r['text'] for r in sim.ropes if r['state'] != 'falling']
        sim.open = op_; sim.T.grow(op_); sim.ropes = []; sim.hl.update(rope=None, target=0); sim.idle.update(phase='wide', t=0)
        for t in texts:
            n = sim.free_tip(len(t))
            if n is not None: sim.make_rope(t, n, instant=True)

# ---------------------------------------------------------------- 글자 텍스처
def glyph_index(key):
    k = S['glyph_keys'].get(key)
    if k is not None: return k
    root = R(); gl = root.op('glyphs')
    k = len(S['glyph_paths']); name = 'g%04d' % k
    t = gl.create(textTOP, name)
    font, ch = key
    setp(t, outputresolution='custom', resolutionw=128, resolutionh=128, text=ch, fontsizex=100, fontautosize='nofit',
         alignx='center', aligny='center', bgalpha=0, fontalpha=1, fontcolorr=1, fontcolorg=1, fontcolorb=1, wordwrap=0)
    if font == 'serif': setp(t, fontfile=SERIF_FONT)
    else: setp(t, font='Menlo')
    t.nodeX = (k % 32)*150; t.nodeY = -(k//32)*150
    S['glyph_keys'][key] = k; S['glyph_paths'].append(t.path); S['glyph_dirty'] = True
    return k

def sync_glyph_textures():
    if not S['glyph_dirty']: return
    paths = S['glyph_paths']
    for p in range(PAGES):
        geo = R().op('geo_glyphs%d' % p); sub = paths[p*PAGE:(p+1)*PAGE]
        if geo is None: continue
        geo.par.instancetexs = ' '.join(sub)
        m = R().op('mat_glyphs%d' % p)
        if m and sub: m.par.colormap = sub[0]
        geo.render = bool(sub)
    if len(paths) > PAGE*PAGES: log('글자 수가 페이지 한도를 넘음', len(paths))
    S['glyph_dirty'] = False

# ---------------------------------------------------------------- 매 프레임
def frame(root):
    S['frame'] += 1
    if S['frame'] % 20 == 0: bridge()
    sim = S['sim']
    if sim is None: return
    try:
        dt = min(.033, 1.0/max(1.0, project.cookRate)) if S['frame'] < 3 else min(.033, absTime.stepSeconds)
        if S['frame'] % 15 == 0: apply_pars(root)
        audio(root, dt)
        people(root)
        sim.step(dt)
        PX = G.WW/(sim.cam['z']*1600)*1.15
        o = sim.render(PX)
        for g in o.glyphs: glyph_index(g[0])
        sync_glyph_textures()
        S['out'] = o; S['segs'] = o.segments(PX)
        ren = root.op('render')
        S['minw'] = G.WW/(sim.cam['z']*max(1, ren.width))*S.get('minpx', 0.0)   # 0이면 원본과 같은 선 폭 (가는 선을 굵게 보이고 싶으면 1)
        camera(root, sim)
        post(root, sim)
        particles(root, sim)
        for n in ['chop_segs', 'chop_dots', 'chop_glows']+['chop_glyphs%d' % p for p in range(PAGES)]:
            c = root.op(n)
            if c: c.cook(force=True)
        st = root.op('status')
        if st and st.text != sim.status: st.text = sim.status
    except Exception:
        now = time.time()
        if now-S['last_err'] > 2: S['last_err'] = now; log('frame error\n'+traceback.format_exc())

def camera(root, sim):
    cam = root.op('cam')
    cam.par.orthowidth = G.WW/sim.cam['z']
    cam.par.tx = sim.cam['x']; cam.par.ty = -sim.cam['y']

def post(root, sim):
    snap = root.op('snap'); cross = root.op('dissolve')
    if sim.dissolve_start:
        sim.dissolve_start = False
        snap.par.active = 0           # 직전 프레임을 붙잡음
    a = sim.dissolve_alpha()
    cross.par.cross = a
    if a <= 0 and not snap.par.active.eval(): snap.par.active = 1

# ---------------------------------------------------------------- Script CHOP 출력
def _write(scriptOp, arr, key):
    scriptOp.clear()
    arr = np.ascontiguousarray(arr, dtype=np.float32)
    try:
        scriptOp.copyNumpyArray(arr)
    except Exception:
        scriptOp.numSamples = arr.shape[1]
        for i in range(arr.shape[0]): scriptOp.appendChan('chan%d' % i).vals = arr[i].tolist()
    names = tuple(c.name for c in scriptOp.chans())
    if S['chan_names'].get(key) != names and bind_instancing(key, names):
        S['chan_names'][key] = names

def cook_chop(scriptOp, kind):
    o = S['out']
    if o is None:
        _write(scriptOp, np.zeros((9, 1), np.float32), kind); return
    if kind == 'segs':
        s = S['segs']; a = np.empty((9, s.shape[1]), np.float32)
        a[0] = s[0]; a[1] = -s[1]; a[2] = -np.degrees(s[2]); a[3] = s[3]; a[4] = np.maximum(s[4], S.get('minw', 0)); a[5:9] = s[5:9]
    elif kind in ('dots', 'glows'):
        lst = o.dots if kind == 'dots' else o.glows
        if not lst: a = np.zeros((9, 1), np.float32)
        else:
            d = np.array(lst, np.float32).T
            a = np.empty((9, d.shape[1]), np.float32)
            a[0] = d[0]; a[1] = -d[1]; a[2] = 0; a[3] = d[2]*2; a[4] = d[2]*2; a[5:9] = d[3:7]
    else:
        page = int(kind[6:]); gk = S['glyph_keys']
        rows = []
        for key, x, y, rot, fs, r, g, b, al in o.glyphs:
            k = gk.get(key, 0)
            if k // PAGE != page: continue
            sz = fs*S.get('glyph_scale', .98)
            rows.append((x, -y, -math.degrees(rot), sz, sz, r, g, b, al, k % PAGE))
        a = np.array(rows, np.float32).T if rows else np.zeros((10, 1), np.float32)
    # 색은 곱하지 않은 rgb + 알파로 넘김 (Constant MAT이 rgb에 알파를 곱해 one, 1-srcalpha로 합성)
    _write(scriptOp, a, kind)

def bind_instancing(kind, names):
    root = R() if S['root'] else None
    geo = root.op('geo_'+kind) if root else None
    if geo is None or len(names) < 9: return False
    n = list(names)
    setp(geo, instancetx=n[0], instancety=n[1], instancerz=n[2], instancesx=n[3], instancesy=n[4],
         instancer=n[5], instanceg=n[6], instanceb=n[7], instancea=n[8])
    if kind.startswith('glyphs') and len(n) > 9: setp(geo, instancetexindex=n[9])
    log('instancing bound', kind, n[:10])
    return True

# ---------------------------------------------------------------- 파티클 (GLSL TOP 피드백)
def particles(root, sim):
    P = G.PAL[G.SEL['color']]; hlA = G.ease(sim.hl['a']); dim = G.lerp(1, .5, hlA)
    p = root.par
    def g(name, d):
        try: return float(getattr(p, name).eval())
        except Exception: return d
    rip = sim.rip_uniform(bool(sim.music['playing']))
    up = root.op('ptc_update'); xf = root.op('ptc_xform'); col = root.op('ptc_col')
    w = float(G.wind(2000, sim.t))*g('Pwind', 1)
    vals = {'uT':(sim.t, absTime.stepSeconds, sim.music['b']*sim.music['react'], w),
            'uP1':(g('Pflow', 1), g('Pscale', 1), g('Prise', 6), g('Pcrown', .62)),
            'uP2':(g('Plifemin', 1.5), g('Plifemax', 16), g('Ppush', 1), g('Pripplespeed', 1))}
    for i in range(8): vals['uRip%d' % i] = tuple(float(v) for v in rip[i])
    set_vecs(up, vals)
    k = .42*dim*g('Pbright', 1)
    cam = (sim.cam['x'], sim.cam['y'], sim.cam['z'], g('Psize', 1))
    v2 = {'uCam':cam, 'uP3':(g('Prand', .85), g('Ptwinkle', .45), g('Paccent', .07), g('Pripple', 1)),
          'uCol':(P['line'][0]/255*k, P['line'][1]/255*k, P['line'][2]/255*k, g('Pripplespeed', 1)),
          'uAcc':(P['accent'][0]/255*k*1.4, P['accent'][1]/255*k*1.4, P['accent'][2]/255*k*1.4, sim.t)}
    for i in range(8): v2['uRip%d' % i] = vals['uRip%d' % i]
    set_vecs(xf, v2); set_vecs(col, v2)
    root.op('geo_ptc').render = bool(g('Particles', 1))

def set_vecs(glsl, vals):
    for i, (name, v) in enumerate(vals.items()):
        try:
            getattr(glsl.par, 'vec%dname' % i).val = name
            for c, x in zip('xyzw', v): getattr(glsl.par, 'vec%dvalue%s' % (i, c)).val = x
        except Exception:
            pass

# ---------------------------------------------------------------- 음악 (WebAudio 분석기와 같은 방식: 2048 FFT, 블랙만 창, 0.55 평활)
def audio(root, dt):
    sim = S['sim']; M = S['mus']
    chop = root.op('music'); playing = False
    try: playing = bool(root.par.Music.eval())
    except Exception: pass
    sim.music['playing'] = playing
    if chop is None or not playing:
        for k in ('b', 'm', 'h', 'lv'): sim.music[k] *= math.exp(-dt*2)
        sim.music['kick'] *= math.exp(-dt*6); return
    try:
        a = chop.numpyArray()
    except Exception:
        return
    if a.size == 0: return
    mono = a.mean(0).astype(np.float32); n = len(mono); buf = S['audio_buf']
    if n >= len(buf): buf[:] = mono[-len(buf):]
    else: buf[:-n] = buf[n:]; buf[-n:] = mono
    N = len(buf); win = np.blackman(N).astype(np.float32)
    mag = np.abs(np.fft.rfft(buf*win))[:N//2]/N
    sm = S['audio_smooth']
    sm = mag if sm is None else .55*sm+.45*mag; S['audio_smooth'] = sm
    db = 20*np.log10(np.maximum(sm, 1e-12))
    rate = chop.rate if chop.rate > 0 else 44100; hz = rate/N
    def band(lo, hi):
        i0 = max(1, int(lo/hz)); i1 = int(math.ceil(hi/hz))
        return float(np.mean(np.maximum(db[i0:i1+1], -140))) if i1 >= i0 else -140.
    raw = [band(25, 160), band(160, 2000), band(2000, 11000), band(25, 11000)]
    for k in range(4):
        if M['hi'][k] < -199: M['hi'][k] = M['lo'][k] = M['avg'][k] = raw[k]
        M['avg'][k] += (raw[k]-M['avg'][k])*min(1, dt/3)
        M['hi'][k] = max(raw[k], M['hi'][k]-dt*2); M['lo'][k] = min(raw[k], M['lo'][k]+dt*2)
        rng = max(M['hi'][k]-M['lo'][k], 18); level = G.clamp((raw[k]-(M['hi'][k]-rng))/rng, 0, 1); trans = G.clamp((raw[k]-M['avg'][k])/8, 0, 1)
        v = 0 if raw[k] < -138 else G.clamp(.4*level*level+.7*trans, 0, 1.3)
        M['val'][k] += (v-M['val'][k])*min(1, dt*(22 if v > M['val'][k] else 3.5))
    sim.music_values(M['val'][0], M['val'][1], M['val'][2], M['val'][3], dt)

# ---------------------------------------------------------------- 관객: 감지 서버(웹소켓) → 없으면 가상 관객
def people(root):
    sim = S['sim']; V = S['vis']; now = time.time()
    ws = root.op('vision_ws')
    if ws is not None and not V['ok'] and now > V['try']:
        V['try'] = now+3
        try:
            s = socket.create_connection(('127.0.0.1', 8770), timeout=.03); s.close()
            ws.par.active = 0; ws.par.active = 1
        except Exception:
            if ws.par.active.eval(): ws.par.active = 0
    live = V['ok'] and now-V['last'] < 1.5
    mirror = True
    try: mirror = bool(root.par.Mirror.eval())
    except Exception: pass
    src = [{'id':q['id'], 'x':(1-q['x']) if mirror else q['x'], 'h':q['h']} for q in V['people']] if live else []
    sim.update_people(src, live)

def vis_connect(ok):
    S['vis']['ok'] = ok
    log('vision server', 'connected' if ok else 'disconnected')

def vis_message(msg):
    try:
        m = json.loads(msg); V = S['vis']
        V['backend'] = m.get('backend', ''); V['last'] = time.time(); V['ok'] = True
        V['people'] = [{'id':'s%s' % q['id'], 'x':float(q['cx']), 'h':float(q['h'])} for q in m.get('people', [])]
    except Exception:
        pass

# ---------------------------------------------------------------- 사용자 조작
def send(root):
    sim = S['sim']
    try: txt = root.par.Sentence.eval()
    except Exception: txt = ''
    sim.send_sentence(txt or '오늘 처음 본 사람한테도 다정하게 말할 수 있었으면')

def reseed(root):
    S['sim'].seed_ropes()

# ---------------------------------------------------------------- 개발 브리지: td_cmd.py가 바뀌면 실행하고 결과를 td_log.txt에
def bridge():
    try:
        m = os.path.getmtime(CMD)
    except OSError:
        return
    if S['cmd_mtime'] is None: S['cmd_mtime'] = m; return
    if m == S['cmd_mtime']: return
    S['cmd_mtime'] = m
    try:
        src = open(CMD, encoding='utf-8').read()
        env = {'S':S, 'G':G, 'R':R, 'log':log, 'op':op, 'np':np}
        exec(compile(src, CMD, 'exec'), globals() | env)
        log('cmd ok')
    except Exception:
        log('cmd error\n'+traceback.format_exc())

def snap(path):
    R().op('out').save(path)

# ---------------------------------------------------------------- 공용
def setp(o, **kw):
    for k, v in kw.items():
        try:
            par = getattr(o.par, k)
            if par is None: raise AttributeError(k)
            if par.isMenu and isinstance(v, str) and par.style != 'StrMenu':
                names = [x.lower() for x in par.menuNames]; labels = [x.lower() for x in par.menuLabels]
                vv = v.lower()
                if vv in names: par.menuIndex = names.index(vv)
                elif vv in labels: par.menuIndex = labels.index(vv)
                else:
                    hit = [i for i, x in enumerate(names) if vv in x] or [i for i, x in enumerate(labels) if vv in x]
                    if hit: par.menuIndex = hit[0]
                    else: log('menu miss', o.path, k, v, par.menuNames)
            else:
                par.val = v
        except Exception as e:
            log('par miss', o.path, k, repr(e))
