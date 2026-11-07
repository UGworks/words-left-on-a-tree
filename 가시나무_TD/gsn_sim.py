"""가시나무에 매달린 말들 — TouchDesigner 시뮬레이션 코어.

board.html(가시나무 시안 보드)의 Canvas2D 물리·연출 코드를 numpy로 옮긴 모듈.
TD 밖에서도 import 해 테스트할 수 있도록 td 모듈에 의존하지 않는다.
월드 좌표는 원본과 같다: 4000×1000, y는 아래로 증가. TD로 넘길 때 y를 뒤집는다.

기본 결정값(board의 def): 데이터 트리 · 방명록 15 · 명조 · 처음부터 글자 · 아이보리 ·
가지에서 풀려 가로로 · 대기 카메라웍 켬 · 디졸브.
"""
import math, random, time
import numpy as np

WW, WH, GROUND = 4000.0, 1000.0, 968.0
SAFE_TOP, SAFE_SIDE, SAFE_BOTTOM = 70.0, 150.0, 938.0
TAU = math.tau

GUEST = [
'엄마 나 사실 그때 하나도 안 괜찮았어 근데 이제는 진짜 좀 괜찮아',
'나무야 너도 가시가 있구나 ㅎㅎ 나도 그래서 가끔 사람들한테 미안해',
'헤어지자고 한 건 나였는데 왜 내가 더 오래 아픈지 모르겠다..',
'콩아 무지개다리 건너서도 잘 뛰어놀고 있지? 산책 더 많이 해줄걸',
'할머니 된장찌개 레시피 물어볼걸 그 맛이 자꾸 생각나요',
'너한테 끝내 못 한 말 여기 걸어두고 갈게 고마웠어 진짜로',
'퇴근길 버스에서 본 노을이 너무 예뻐서 혼자 보기 아까웠다',
'괜찮은 척은 오늘까지만 하고 내일은 그냥 나답게 살아볼래',
'언니랑 싸우고 나왔는데 이거 쓰다가 먼저 연락할 마음이 조금 생김',
'아빠 술 좀 줄여요 오래오래 같이 걷고 싶어서 하는 말이야',
'나를 미워했던 시간들아 이제 그만 가도 돼 수고했어',
'아무도 안 볼 줄 알고 쓴다 나 사실 너 많이 좋아했었어',
'졸업하면 뭐든 될 줄 알았는데 아직 아무것도 아니어도 괜찮다고 적어둠 26.10',
'다들 무슨 말 남겼나 읽다가 울컥함 여기 걸린 말들 다 잘 됐으면',
'보고싶다는 말은 왜 늘 늦게 도착할까']
DECK = [
'26년은 더딘 듯 빠르게 지나갔는데 아쉬움은 내년의 열심으로 바뀌길 바라며 27년엔 모든 일들이 잘되었으면',
'오늘은 별일 없는 하루였는데 집으로 돌아오는 길에 본 노을이 오래 기억에 남을 것 같다',
'잘 지내냐는 말을 보내려다가 너무 오랜만이라 괜히 어색해서 오늘도 마음속으로만 안부를 물었다',
'아직 무엇을 하고 싶은지 정확히 모르겠지만 지금의 시간을 너무 미워하지는 않았으면 좋겠다',
'엄마 아빠가 오래 건강했으면 좋겠고 다음에는 바쁘다는 말 대신 먼저 전화를 걸어야겠다',
'열심히 한다고 모든 일이 잘되는 건 아니지만 그래도 내가 해온 시간들이 어디론가 이어지길 바란다',
'이사 가기 전에 매일 지나던 골목을 한 번 더 걸어보고 싶은데 막상 가면 조금 울 것 같다',
'요즘은 커다란 행복보다 따뜻한 밥을 먹고 걱정 없이 잠드는 저녁이 더 소중하게 느껴진다',
'올해는 나한테 조금 더 다정해지고 실수한 날에도 너무 오래 나를 혼내지 않기로 했다',
'아무 말이나 적으라고 하니까 오히려 무슨 말을 해야 할지 모르겠어서 그냥 지금 생각을 적고 있다',
'우리가 자주 만나지 못해도 가끔 같은 노래를 듣고 서로를 떠올리는 사이로 남았으면 좋겠다',
'오래 쓰던 물건을 버리지 못하는 건 아마 그때의 내가 아직 그 안에 조금 남아 있어서인 것 같다',
'언젠가 시간이 많아지면 해보겠다고 미뤄둔 일들을 내년에는 하나라도 정말 시작하고 싶다',
'오늘 하루도 괜찮은 척하느라 애썼을 누군가가 집에 돌아가서는 편하게 숨을 쉬었으면 좋겠다',
'창가에 둔 화분에 새잎이 났다 내가 잊고 있던 사이에도 자기 속도로 잘 자라고 있었구나',
'다음 봄에는 혼자라도 바다에 가서 휴대폰을 내려놓고 파도 소리를 오래 듣고 돌아오고 싶다',
'그때는 미안하다는 말이 왜 그렇게 어려웠을까 지금이라도 전하면 너무 늦은 건 아닐까',
'계획대로 되지 않은 일들이 많았지만 돌아보면 그 덕분에 만난 사람들도 있어서 이상하게 고맙다',
'내가 좋아하는 것들을 설명하지 않아도 편하게 좋아할 수 있는 시간이 조금 더 많아졌으면 한다',
'매일 똑같은 출근길이라고 생각했는데 길가의 나무는 내가 모르는 사이 여러 번 계절을 바꾸고 있었다',
'누군가에게 좋은 사람이 되고 싶어서 정작 내 마음은 자꾸 뒤로 미뤄두고 있었던 것 같다',
'오늘 여기서 이름도 모르는 사람들의 문장을 읽다가 나만 이런 생각을 하는 게 아니라서 조금 웃었다',
'올해의 아쉬운 일들은 여기 조금 걸어두고 집에 갈 때는 마음이 지금보다 가벼웠으면 좋겠다',
'특별한 소원은 없고 지금 곁에 있는 사람들과 내년에도 시시한 이야기를 나누며 웃을 수 있으면 좋겠다',
'이 문장을 읽고 있는 당신에게도 아직 말하지 못한 마음이 있다면 어디에든 천천히 놓아둘 수 있기를']

PAL = {
  'ivory':    {'line': (232,227,212), 'accent': (164,224,160), 'text': (242,237,224)},
  'mono':     {'line': (236,236,236), 'accent': (255,255,255), 'text': (248,248,248)},
  'amber':    {'line': (214,184,138), 'accent': (248,214,148), 'text': (244,224,192)},
  'spectrum': {'line': (222,226,240), 'accent': (176,198,255), 'text': (242,242,250)},
}
SPEC = [(118,138,255),(178,122,240),(92,198,212),(238,138,198),(140,218,168),(228,188,118),(150,170,255),(210,150,230)]
LAYER = [{'fs':28,'a':1.0},{'fs':23,'a':.85},{'fs':19,'a':.62}]

# 결정값 (TD 커스텀 파라미터로 바뀜)
SEL = {'set':'guest', 'text':'vertical', 'color':'ivory', 'hl':'spread', 'idle':'on', 'cam':'dissolve'}
FONT_SCALE = 1.0

def clamp(v,a,b): return a if v<a else b if v>b else v
def lerp(a,b,t): return a+(b-a)*t
def ease(t): return 4*t*t*t if t<.5 else 1-((-2*t+2)**3)/2
def hashf(n):
    x = math.sin(n*127.1+311.7)*43758.5453
    return x-math.floor(x)
def hash_np(n):
    x = np.sin(n*127.1+311.7)*43758.5453
    return x-np.floor(x)

def mulberry(a):
    st = [a & 0xffffffff]
    def r():
        st[0] = (st[0] + 0x6D2B79F5) & 0xffffffff
        t = st[0]
        t = ((t ^ (t >> 15)) * (1 | t)) & 0xffffffff
        t = (t + (((t ^ (t >> 7)) * (61 | t)) & 0xffffffff) ^ t) & 0xffffffff
        return ((t ^ (t >> 14)) & 0xffffffff) / 4294967296
    return r

# ---------------------------------------------------------------- 바람
WIND = {'gust':0.0, 'next':6.0, 'gustT':9.0}
def wind(x,t):
    return (.55*np.sin(t*.42 - x*.0017) + .3*np.sin(t*.23 + x*.0009 + 1.3)
            + .15*np.sin(t*1.1 - x*.004) + WIND['gust']*np.sin(t*.9 - x*.0022))

# ---------------------------------------------------------------- 나무
class Tree:
    def grow(self, open_=.5):
        rnd = mulberry(23); out = []
        CX = WW/2; HALF = WW/2-SAFE_SIDE-60
        def topY(x):
            u = min(1, abs(x-CX)/HALF); return SAFE_TOP+40+330*(u**2.3)
        def inside(x,y): return abs(x-CX) < HALF and y > topY(x) and y < GROUND-300
        def add(p, absAng, parentAbs, ln, depth, x0, y0, kind):
            n = dict(p=p, rel=absAng-parentAbs, len=ln, depth=depth, bend=(rnd()-.5)*(.5 if kind=='whip' else .22),
                     ang=absAng, x0=x0, y0=y0, x1=x0+math.cos(absAng)*ln, y1=y0+math.sin(absAng)*ln, kind=kind, anchor=False)
            pn = out[p] if p >= 0 else None
            n['ft'] = 0 if (pn is None or kind=='trunk') else (1 if pn['kind']=='trunk' else pn['ft']+1)
            out.append(n); return len(out)-1
        def whip(p, parentAbs, x, y, side, ln):
            a = math.pi/2 - side*(.55+rnd()*.35); pi_, pa, L = p, parentAbs, ln
            n = 4+int(rnd()*5)
            for _ in range(n):
                a += (math.pi/2 + side*.05 - a)*.42
                ny = y+math.sin(a)*L
                if ny > GROUND-330: break
                i = add(pi_, a, pa, L, 7, x, y, 'whip'); pi_ = i; pa = a; x = out[i]['x1']; y = out[i]['y1']; L *= .92
        def limb(p, ang, parentAbs, ln, order, x0, y0, side, segs):
            pi_, a, pa, x, y, L = p, ang, parentAbs, x0, y0, ln
            h = 0 if side > 0 else math.pi
            for s in range(segs):
                prog = s/max(1, segs-1)
                d = -(.30-.14*open_)*(1-prog*2) if prog < .5 else (prog-.5)*(.9+.5*(1-open_))
                a += ((h + side*d) - a)*(.085+.06*prog) + (rnd()-.5)*.05
                tries = 0; nx = x+math.cos(a)*L; ny = y+math.sin(a)*L
                while not inside(nx,ny) and tries < 7:
                    a += side*.16; nx = x+math.cos(a)*L; ny = y+math.sin(a)*L; tries += 1
                if not inside(nx,ny): break
                i = add(pi_, a, pa, L, min(6.4, order*1.5+s*.19), x, y, 'branch'); out[i]['bend'] *= .35
                if order >= 1 and prog > .15: out[i]['anchor'] = True
                if order < 4 and s > 1 and s < segs-3 and s % 2 == 0 and rnd() < .78-order*.16:
                    up = rnd() < .55
                    ba = a + side*(-(.42+.3*open_) if up else (.35+.2*open_))
                    limb(i, ba, a, L*.86, order+1, out[i]['x1'], out[i]['y1'], side, max(5, segs-s-2-order*2))
                if prog > .25 and s % 2 == 1 and rnd() < .62:
                    whip(i, a, out[i]['x1'], out[i]['y1'], side, 24+rnd()*22)
                pi_ = i; pa = a; x = out[i]['x1']; y = out[i]['y1']; L *= .975
            if pi_ != p: whip(pi_, pa, x, y, side, 30+rnd()*22)
        TR = []; tp = -1; tx, ty = CX, GROUND
        for j in range(7):
            a = -math.pi/2+math.sin(j*.82-1.7)*.62+.04
            i = add(tp, a, -math.pi/2 if tp < 0 else out[tp]['ang'], 64, j*.1, tx, ty, 'trunk')
            out[i]['bend'] = 0; TR.append(i); tp = i; tx = out[i]['x1']; ty = out[i]['y1']
        self.TRUNK = TR[:]
        LIMBS = [[4,-1,-0.30,100,22],[5,1,-0.36,100,22],[5,-1,-0.64,96,21],[6,1,-0.70,96,20],
                 [6,-1,-1.02,90,18],[6,1,-1.06,90,18],[6,-1,-1.38,80,13],[6,1,-1.42,80,13]]
        self.FORKS = sorted(set(TR[l[0]] for l in LIMBS))
        for j, side, ar, L, sg in LIMBS:
            n = out[TR[j]]
            a = ar-.08*open_ if side > 0 else math.pi-ar+.08*open_
            limb(TR[j], a, n['ang'], L, 1, n['x1'], n['y1'], side, sg)
        for n in out: n['leaf'] = True
        for n in out:
            if n['p'] >= 0: out[n['p']]['leaf'] = False
        maxLen = 1; lid = 0
        for n in out:
            p = out[n['p']] if n['p'] >= 0 else None
            n['plen'] = (p['plen'] if p else 0)+n['len']; maxLen = max(maxLen, n['plen'])
            if not p: n['limb'] = 0
            elif p['kind']=='trunk' and n['kind']!='trunk': lid += 1; n['limb'] = lid
            else: n['limb'] = p['limb']
        for n in out:
            n['val'] = 1-n['plen']/maxLen; n['label'] = (n['kind']=='branch' and n['ft']==4)
        leaves = [i for i,n in enumerate(out) if n['leaf']]
        stepL = max(1, math.ceil(len(leaves)/380))
        self.LEAVES = leaves; lin = []
        for q in range(0, len(leaves), stepL):
            chain = []; k = leaves[q]
            while k >= 0: chain.append(k); k = out[k]['p']
            chain.reverse(); lin.append((chain, out[leaves[q]]['limb'], rnd()-.5))
        self.LINEAGE = lin
        self.SAP = [{'g':int(rnd()*1e6), 'pos':rnd()*30, 'sp':.9+rnd()*1.4} for _ in range(80)]
        self.nodes = out
        CXh = HALF
        self.tipIdx = [i for i,n in enumerate(out) if n['anchor'] and n['y1'] < 540 and abs(n['x1']-CX) < CXh-40]
        # numpy 배열
        M = len(out); self.M = M
        g = lambda k, dt=np.float64: np.array([n[k] for n in out], dtype=dt)
        self.p = g('p', np.int64); self.rel = g('rel'); self.len = g('len'); self.depth = g('depth'); self.bend = g('bend')
        self.k = 9+self.depth*3.5; self.a = np.zeros(M); self.v = np.zeros(M)
        self.ang = g('ang'); self.x0 = g('x0'); self.y0 = g('y0'); self.x1 = g('x1'); self.y1 = g('y1')
        self.cx = np.zeros(M); self.cy = np.zeros(M)
        self.kind = [n['kind'] for n in out]
        self.is_whip = np.array([kd=='whip' for kd in self.kind]); self.is_trunk = np.array([kd=='trunk' for kd in self.kind])
        self.is_branch = np.array([kd=='branch' for kd in self.kind])
        self.ft = g('ft'); self.limb = g('limb', np.int64); self.val = g('val')
        self.label = np.array([n['label'] for n in out])
        gen = np.zeros(M, np.int64)
        for i in range(M):
            if self.p[i] >= 0: gen[i] = gen[self.p[i]]+1
        self.levels = [np.nonzero(gen==L)[0] for L in range(gen.max()+1)]
        # 계보선: 체인을 패딩한 배열
        Lmax = max(len(c) for c,_,_ in lin)
        self.lin_idx = np.full((len(lin), Lmax), -1, np.int64)
        self.lin_len = np.array([len(c) for c,_,_ in lin]); self.lin_off = np.array([o for _,_,o in lin]); self.lin_limb = np.array([l for _,l,_ in lin])
        for r,(c,_,_) in enumerate(lin): self.lin_idx[r,:len(c)] = c
        self.step(0, 0)

    def step(self, dt, t):
        for lv in self.levels:
            p = self.p[lv]; root = p < 0; pp = np.where(root, 0, p)
            bx = np.where(root, WW/2, self.x1[pp]); by = np.where(root, GROUND, self.y1[pp]); pa = np.where(root, -math.pi/2, self.ang[pp])
            w = wind(bx, t)*(.0021+.0019*self.depth[lv])
            v = self.v[lv] + (-self.k[lv]*self.a[lv] - 2.2*self.v[lv])*dt; a = self.a[lv] + v*dt
            self.v[lv] = v; self.a[lv] = a
            ang = pa + self.rel[lv] + a + w; self.ang[lv] = ang
            L = self.len[lv]; x1 = bx+np.cos(ang)*L; y1 = by+np.sin(ang)*L
            self.x0[lv] = bx; self.y0[lv] = by; self.x1[lv] = x1; self.y1[lv] = y1
            mx = (bx+x1)/2; my = (by+y1)/2; b = self.bend[lv]*L
            self.cx[lv] = mx - np.sin(ang)*b; self.cy[lv] = my + np.cos(ang)*b

    def kick(self, i, amt):
        k, f = i, 1.0
        while k >= 0 and f > .05:
            self.v[k] += amt*f; f *= .45; k = int(self.p[k])

    def pt_on(self, node, u):
        return lerp(self.x0[node], self.x1[node], u), lerp(self.y0[node], self.y1[node], u)

# ---------------------------------------------------------------- 출력 버퍼: 선(폴리라인)·점·글자
class Out:
    """한 프레임 동안 그릴 것을 모으는 버퍼: 폴리라인(굵기 포함), 점, 부드러운 빛무리, 글자 인스턴스."""
    def __init__(self):
        self.polys = []    # (xs(R,C), ys(R,C), (r,g,b), alpha, width)
        self.dots = []     # (x,y,r,R,G,B,A)
        self.glows = []    # (x,y,r,R,G,B,A) 가장자리가 부드러운 원
        self.glyphs = []   # (key, x, y, rot, fs, R,G,B,A)
    def poly(self, xs, ys, col, a, w=.7):
        """xs,ys: 1D(한 줄) 또는 2D(여러 줄, 행마다 한 줄). col: (r,g,b) 0-255, w: 원본 lineWidth 배수(PX 단위)"""
        if a <= 0.002: return
        xs = np.atleast_2d(np.asarray(xs, np.float32)); ys = np.atleast_2d(np.asarray(ys, np.float32))
        if xs.shape[1] < 2: return
        self.polys.append((xs, ys, col, float(min(1.0, a)), float(w)))
    def dot(self, x, y, r, col, a):
        if a > .002: self.dots.append((x, y, r, col[0]/255, col[1]/255, col[2]/255, min(1.0, a)))
    def glow(self, x, y, r, col, a):
        if a > .002: self.glows.append((x, y, r, col[0]/255, col[1]/255, col[2]/255, min(1.0, a)))
    def dots_np(self, xs, ys, r, col, a):
        if a <= .002 or len(xs) == 0: return
        r = np.broadcast_to(np.asarray(r, np.float32), np.shape(xs))
        c = (col[0]/255, col[1]/255, col[2]/255, min(1.0, a))
        self.dots.extend((x, y, rr)+c for x, y, rr in zip(np.asarray(xs).tolist(), np.asarray(ys).tolist(), r.tolist()))
    def glyph(self, key, x, y, rot, fs, col, a):
        if a > .004: self.glyphs.append((key, x, y, rot, fs, col[0]/255, col[1]/255, col[2]/255, min(1.0, a)))

    def segments(self, PX):
        """모든 폴리라인을 선분으로: (9, n) = 중점x, 중점y, 각도(라디안, y아래), 길이, 폭(월드), r, g, b, a"""
        parts = []
        for xs, ys, col, a, w in self.polys:
            x0 = xs[:, :-1].ravel(); y0 = ys[:, :-1].ravel(); x1 = xs[:, 1:].ravel(); y1 = ys[:, 1:].ravel()
            n = len(x0); seg = np.empty((9, n), np.float32)
            dx = x1-x0; dy = y1-y0
            seg[0] = (x0+x1)*.5; seg[1] = (y0+y1)*.5; seg[2] = np.arctan2(dy, dx); seg[3] = np.hypot(dx, dy)
            seg[4] = w*PX; seg[5] = col[0]/255; seg[6] = col[1]/255; seg[7] = col[2]/255; seg[8] = a
            parts.append(seg)
        if not parts: return np.zeros((9, 1), np.float32)
        out = np.concatenate(parts, 1)
        return out[:, out[3] > 1e-3]

    def line_arrays(self, cls=None):
        """미리보기용: 모든 폴리라인을 하나의 연속 선으로 (줄 사이 알파 0)"""
        chunks = []
        for xs, ys, col, a, w in self.polys:
            R, C = xs.shape
            x = np.concatenate([xs[:, :1], xs, xs[:, -1:]], 1); y = np.concatenate([ys[:, :1], ys, ys[:, -1:]], 1)
            al = np.full((R, C+2), a, np.float32); al[:, 0] = 0; al[:, -1] = 0
            chunk = np.empty((7, R*(C+2)), np.float32)
            chunk[0] = x.ravel(); chunk[1] = y.ravel(); chunk[2] = 0
            chunk[3] = col[0]/255; chunk[4] = col[1]/255; chunk[5] = col[2]/255; chunk[6] = al.ravel()
            chunks.append(chunk)
        return np.concatenate(chunks, 1) if chunks else np.zeros((7, 2), np.float32)

def quad(x0, y0, cx, cy, x1, y1, n=5):
    """2차 베지어를 n점으로. 입력은 같은 길이의 1D 배열 → (len, n)"""
    t = np.linspace(0, 1, n, dtype=np.float32)[None, :]
    x0, y0, cx, cy, x1, y1 = [np.asarray(v, np.float32)[:, None] for v in (x0, y0, cx, cy, x1, y1)]
    q = 1-t
    return q*q*x0+2*q*t*cx+t*t*x1, q*q*y0+2*q*t*cy+t*t*y1

def cubic(x0, y0, c1x, c1y, c2x, c2y, x1, y1, n=12):
    t = np.linspace(0, 1, n, dtype=np.float32); q = 1-t
    return (q**3*x0+3*q*q*t*c1x+3*q*t*t*c2x+t**3*x1, q**3*y0+3*q*q*t*c1y+3*q*t*t*c2y+t**3*y1)

def arc(x, y, r, a0, a1, n=24):
    th = np.linspace(a0, a1, n); return x+np.cos(th)*r, y+np.sin(th)*r

def ellipse(x, y, rx, ry, n=48):
    th = np.linspace(0, TAU, n); return x+np.cos(th)*rx, y+np.sin(th)*ry

# ---------------------------------------------------------------- 메인 시뮬레이션
class Sim:
    def __init__(self, seed=None):
        self.rng = random.Random(seed)
        self.T = Tree(); self.open = .5; self.T.grow(self.open)
        self.t = 0.0
        self.ropes = []
        self.birds = [self.new_bird(self.rng.random()*WW, 110+self.rng.random()*240) for _ in range(22)]
        self.approach = 0.0; self.viewerX = 2000.0
        self.cam = {'x':WW/2, 'y':WH/2, 'z':1.0}; self.camGoal = dict(self.cam)
        self.idle = {'phase':'wide', 't':0.0, 'rope':None}
        self.pulses = []; self.sparks = []
        self.hl = {'rope':None, 'a':0.0, 'target':0.0, 'layout':None}
        self.dissolve = None; self.dissolve_start = False
        self.cycle_t = 14.0; self.lastNew = None; self.queue = []; self.timers = []
        self.status = ''
        self.music = {'b':0.,'m':0.,'h':0.,'lv':0.,'kick':0.,'react':1.0,'slowB':0.,'lastKick':-9.,'playing':False}
        self.rips = []; self.ripq = []
        self.people = []; self.match = {}
        self.sim_count = 0; self.sim_approach = 0.0   # 카메라 없을 때 가상 관객
        self.cams = {'far':.25, 'near':.8}
        self.arrivalNode = None
        self.tags = {'list':[], 'next':0.0}
        self.seed_ropes()

    # ------------------------------------------------ 문장
    def pool(self): return GUEST if SEL['set']=='guest' else DECK
    def visible_target(self): return 11 if SEL['set']=='guest' else 18

    def make_rope(self, text, node, layer=None, instant=False):
        T = self.T; chars = list(text); rr = self.rng
        if layer is None: layer = 0 if rr.random() < .4 else (1 if rr.random() < .6 else 2)
        r = {'text':text, 'chars':chars, 'node':node, 'layer':layer, 'shown': len(chars) if instant else 0.0,
             'state':'hang' if instant else 'typing', 'alpha':1.0, 'seed':rr.random()*1000, 'born':self.t,
             'clock': time.localtime(time.time()-(rr.random()*5.4e3 if instant else 0)), 'fresh':0.0 if instant else 1.0, 'ct':{}}
        GAP = 1.32; fs = LAYER[layer]['fs']*FONT_SCALE
        avail = SAFE_BOTTOM-60-(T.y1[node]+18)
        if len(chars)*fs*GAP > avail: fs = avail/(len(chars)*GAP)
        step = fs*GAP; r['step'] = step; r['fs'] = fs
        n = len(chars)+1
        ys = T.y1[node]+14+(np.arange(n)*step if instant else np.zeros(n))
        r['x'] = np.full(n, T.x1[node]); r['y'] = ys.astype(np.float64); r['px'] = r['x'].copy(); r['py'] = r['y'].copy()
        self.ropes.append(r); return r

    def step_ropes(self, dt, t):
        T = self.T; g = 520.0; damp = .985
        for r in self.ropes:
            node = r['node']
            if r['state'] == 'typing':
                before = math.ceil(r['shown']); r['shown'] = min(len(r['chars']), r['shown']+dt*5); after = math.ceil(r['shown'])
                for q in range(before, after): r['ct'][q] = self.t
                if r['shown'] >= len(r['chars']): r['state'] = 'hang'
            r['fresh'] = max(0.0, r['fresh']-dt*.12)
            n = math.ceil(r['shown']); pin = r['state'] != 'falling'
            x, y, px, py = r['x'], r['y'], r['px'], r['py']
            if pin:
                x[0] = px[0] = T.x1[node]; y[0] = py[0] = T.y1[node]+14
            else:
                r['alpha'] -= dt*.32
            s = 1 if pin else 0; e = min(n, len(x)-1)+1
            if e > s:
                idx = np.arange(s, e)
                vx = (x[s:e]-px[s:e])*damp; vy = (y[s:e]-py[s:e])*damp
                px[s:e] = x[s:e]; py[s:e] = y[s:e]
                w = wind(x[s:e], t)*(28+idx*1.6)
                x[s:e] += vx + w*dt*dt; y[s:e] += vy + (g*.35 if r['state']=='falling' else g)*dt*dt
            if n+1 < len(x):
                q = min(n, len(x)-1)
                x[n+1:] = px[n+1:] = x[q]; y[n+1:] = py[n+1:] = y[q]
        self.solve_ropes()
        for r in self.ropes:   # 아직 나오지 않은 글자는 마지막 글자 자리에서 대기
            n = math.ceil(r['shown']); x, y, px, py = r['x'], r['y'], r['px'], r['py']
            if n+1 < len(x):
                q = min(n, len(x)-1)
                x[n+1:] = px[n+1:] = x[q]; y[n+1:] = py[n+1:] = y[q]
        self.ropes = [r for r in self.ropes if r['alpha'] > 0]

    def solve_ropes(self):
        """거리 제약: 모든 사슬을 한 배열에 담아 짝수·홀수 링크를 번갈아 푸는 red-black 가우스-자이델.
        매달린 사슬 22회, 떨어지는 사슬 4회 (원본의 순차 풀이와 같은 반복 수)."""
        for pinned, iters in ((True, 22), (False, 4)):
            rs = [r for r in self.ropes if (r['state'] != 'falling') == pinned and min(math.ceil(r['shown']), len(r['x'])-1) >= 1]
            if not rs: continue
            Lm = max(len(r['x']) for r in rs); R = len(rs)
            X = np.zeros((R, Lm)); Y = np.zeros((R, Lm))
            M = np.array([min(math.ceil(r['shown']), len(r['x'])-1) for r in rs])[:, None]
            STEP = np.array([r['step'] for r in rs])[:, None]
            for k, r in enumerate(rs): X[k, :len(r['x'])] = r['x']; Y[k, :len(r['y'])] = r['y']
            cols = np.arange(Lm)[None, :]
            for _ in range(iters):
                for par in (1, 0):
                    i1 = np.arange(2-par, Lm, 2)
                    if len(i1) == 0: continue
                    i0 = i1-1; on = (i1[None, :] <= M)
                    dx = X[:, i1]-X[:, i0]; dy = Y[:, i1]-Y[:, i0]; d = np.hypot(dx, dy); d = np.maximum(d, 1e-4)
                    diff = np.where(on, (d-STEP)/d, 0.0)
                    if pinned:
                        first = (i1 == 1)[None, :]; w0 = np.where(first, 0.0, .5); w1 = np.where(first, 1.0, .5)
                    else:
                        w0 = w1 = .5
                    X[:, i0] += dx*diff*w0; Y[:, i0] += dy*diff*w0
                    X[:, i1] -= dx*diff*w1; Y[:, i1] -= dy*diff*w1
            for k, r in enumerate(rs): n = len(r['x']); r['x'][:] = X[k, :n]; r['y'][:] = Y[k, :n]

    def used_nodes(self): return set(r['node'] for r in self.ropes if r['state'] != 'falling')
    def room_for(self, i, ln): return (SAFE_BOTTOM-60-(self.T.y1[i]+18)) >= ln*LAYER[1]['fs']*FONT_SCALE*1.32*.8
    def free_tip(self, ln=30):
        T = self.T; used = self.used_nodes(); xs = [T.x1[r['node']] for r in self.ropes if r['state'] != 'falling']
        ok = lambda i: i not in used and all(abs(x-T.x1[i]) > 140 for x in xs)
        lst = [i for i in T.tipIdx if ok(i) and self.room_for(i, ln)]
        if not lst: lst = sorted([i for i in T.tipIdx if ok(i)], key=lambda i: T.y1[i])[:6]
        if not lst: lst = [i for i in T.tipIdx if i not in used]
        return self.rng.choice(lst) if lst else None
    def unused_text(self):
        shown = set(r['text'] for r in self.ropes if r['state'] != 'falling')
        c = [s for s in self.pool() if s not in shown]
        return self.rng.choice(c or self.pool())
    def seed_ropes(self):
        self.ropes = []
        for _ in range(self.visible_target()):
            t = self.unused_text(); n = self.free_tip(len(t))
            if n is None: break
            self.make_rope(t, n, instant=True)

    def dispatch(self, text):
        T = self.T; node = self.free_tip(len(text))
        if node is None: return
        fromLeft = (self.rng.random() < .35) if T.x1[node] > WW/2 else (self.rng.random() < .65)
        b = self.new_bird(-120 if fromLeft else WW+120, 120+self.rng.random()*160, 1)
        b['vx'] = 160 if fromLeft else -160; b['heading'] = 0 if fromLeft else math.pi; b['courier'] = {'node':node, 'text':text}
        self.birds.append(b)

    def cycle(self, dt):
        self.cycle_t -= dt
        if self.cycle_t <= 0:
            self.cycle_t = 45+self.rng.random()*25
            if any(b['courier'] for b in self.birds) or any(r['state']=='typing' for r in self.ropes) or self.queue:
                self.cycle_t = 10; return
            live = [r for r in self.ropes if r['state']=='hang' and r is not self.hl['rope']]
            if len(live) >= self.visible_target()-1:
                r = self.rng.choice(live); r['state'] = 'falling'; self.T.kick(r['node'], -.4)
            self.timers.append((self.t+2.2, lambda: self.dispatch(self.unused_text())))

    def send_sentence(self, text):
        text = text.strip()
        if not text: return
        live = [r for r in self.ropes if r['state']=='hang' and r is not self.hl['rope']]
        if len(live) >= self.visible_target():
            min(live, key=lambda r: r['born'])['state'] = 'falling'
        self.hl['target'] = 0
        self.dispatch(text)

    def schedule_new_highlight(self):
        self.queue.append({'rope':self.lastNew, 'at':self.t+len(self.lastNew['chars'])/5+2.8})

    # ------------------------------------------------ 새
    def new_bird(self, x, y, alpha=0.0):
        return {'x':x,'y':y,'vx':0.,'vy':0.,'ang':self.rng.random()*TAU,'mode':'fly','node':-1,'until':0.,'phase':self.rng.random()*6,
                'alpha':alpha,'courier':None,'seed':self.rng.random()*100,'heading':0.,'leave':False,'match':None,'glow':0.}
    @staticmethod
    def steer(b, tx, ty, maxSp, maxAcc, dt, arrive):
        dx = tx-b['x']; dy = ty-b['y']; d = math.hypot(dx, dy) or 1e-3
        sp = maxSp
        if arrive and d < arrive: sp = maxSp*max(.03, d/arrive)
        dvx = dx/d*sp-b['vx']; dvy = dy/d*sp-b['vy']; dl = math.hypot(dvx, dvy) or 1e-3; acc = min(dl, maxAcc*dt)
        b['vx'] += dvx/dl*acc; b['vy'] += dvy/dl*acc; b['x'] += b['vx']*dt; b['y'] += b['vy']*dt
        return d

    def update_matches(self, dt):
        seen = set()
        for p in self.people:
            seen.add(p['id']); b = self.match.get(p['id'])
            if b is None or b not in self.birds:
                tx = 250+p['x']*(WW-500)
                free = [q for q in self.birds if not q['courier'] and not q['match'] and not q['leave']]
                b = min(free, key=lambda q: abs(q['x']-tx)) if free else None
                if b is None:
                    b = self.new_bird(-100 if tx < WW/2 else WW+100, 120, 1); self.birds.append(b)
                b['match'] = {'pid':p['id'], 't0':self.t, 'node':-1}; b['mode'] = 'fly'; self.match[p['id']] = b
                self.add_ripple(b['x'], b['y'], .45, 2)
            b['match']['p'] = p; b['match']['last'] = self.t
        for pid in list(self.match):
            b = self.match[pid]
            if pid not in seen and self.t-((b['match'] or {}).get('last', 0)) > 1.5:
                if b['match'] and b['mode']=='perch': self.T.kick(b['node'], -.3)
                b['match'] = None; b['mode'] = 'fly'; b['glow'] = 0; del self.match[pid]

    def matched_bird(self, b, dt):
        T = self.T; m = b['match']; p = m['p']; prox = p['prox']; tx = 250+p['x']*(WW-500)
        b['glow'] = lerp(b['glow'], .35+.65*prox, dt*2)
        if prox > .72 or (b['mode']=='perch' and prox > .6):
            if m['node'] < 0 or abs(T.x1[m['node']]-tx) > 260:
                cand = np.nonzero(T.is_branch & (T.depth >= 2) & (T.y1 <= 520))[0]; cand = cand[cand >= 8]
                if len(cand):
                    d = np.abs(T.x1[cand]-tx)+np.abs(T.y1[cand]-300)*.3; m['node'] = int(cand[np.argmin(d)])
                if b['mode']=='perch': b['mode'] = 'fly'
            n = m['node']
            if b['mode']=='perch': b['node'] = n; b['x'] = T.x1[n]; b['y'] = T.y1[n]-8; return
            d = self.steer(b, T.x1[n], T.y1[n]-8, 140, 140, dt, 200)
            if d < 6:
                b['mode'] = 'perch'; b['node'] = n; b['vx'] = b['vy'] = 0; T.kick(n, .5); self.add_ripple(T.x1[n], T.y1[n], .35, 2)
            return
        if b['mode']=='perch': b['mode'] = 'fly'; b['vy'] = -30
        m['a'] = m.get('a', self.rng.random()*TAU)+dt*(.9-.4*prox)
        cy = lerp(150, 330, clamp(prox/.72, 0, 1)); R = lerp(170, 70, prox)
        self.steer(b, tx+math.cos(m['a'])*R, cy+math.sin(m['a'])*R*.4, 150, 130, dt, 0)

    def update_birds(self, dt):
        T = self.T; rr = self.rng
        self.update_matches(dt)
        nActive = round(4+(min(.5, self.approach) if self.people else self.approach)*18)
        stay = lerp(1.6, 9, self.open)
        i = 0
        while i < len(self.birds):
            b = self.birds[i]
            want = bool(b['courier'] or b['match'] or (i < nActive and not b['leave']))
            b['alpha'] = clamp(b['alpha']+(1 if want else -1)*dt*.35, 0, 1)
            if b['match']: self.matched_bird(b, dt); i += 1; continue
            if b['courier']:
                c = b['courier']; n = c['node']; cx = T.x1[n]; cy = max(T.y1[n]-130, SAFE_TOP+60)
                c.setdefault('stage', 'approach')
                if c['stage'] == 'approach':
                    side = -1 if b['x'] < cx else 1
                    d0 = self.steer(b, cx+side*200, cy, 200, 120, dt, 260)
                    if d0 < 70: c['stage'] = 'circle'; c['a'] = math.atan2((b['y']-cy)/.45, b['x']-cx); c['t'] = 0; c['dir'] = -1 if side > 0 else 1
                    i += 1; continue
                if c['stage'] == 'circle':
                    c['t'] += dt; c['a'] += dt*c['dir']*1.05; R = lerp(200, 46, clamp(c['t']/6.5, 0, 1))
                    self.steer(b, cx+math.cos(c['a'])*R, cy+math.sin(c['a'])*R*.45, 165, 150, dt, 0)
                    if c['t'] > 7: c['stage'] = 'descend'
                    i += 1; continue
                d = self.steer(b, T.x1[n], T.y1[n]-9, 130, 150, dt, 140)
                if d < 7:
                    b['x'] = T.x1[n]; b['y'] = T.y1[n]-9; b['vx'] *= .2; b['vy'] *= .2; T.kick(n, .7)
                    self.lastNew = self.make_rope(c['text'], n, layer=0)
                    b['courier'] = None; b['mode'] = 'perch'; b['node'] = n; b['until'] = self.t+3.2; b['leave'] = True
                    self.schedule_new_highlight()
                i += 1; continue
            if b['mode'] == 'land':
                n = b['node']; d = self.steer(b, T.x1[n], T.y1[n]-8, 140, 120, dt, 260)
                if not want: b['mode'] = 'fly'; i += 1; continue
                if d < 3: b['mode'] = 'perch'; b['vx'] = b['vy'] = 0; T.kick(n, .45)
                i += 1; continue
            if b['mode'] == 'perch':
                n = b['node']
                if self.t > b['until'] or not want: b['mode'] = 'fly'; T.kick(n, -.3); b['vy'] = -20; i += 1; continue
                b['x'] = T.x1[n]; b['y'] = T.y1[n]-8; i += 1; continue
            b['ang'] += dt*(.05+.02*(i % 4))
            R = lerp(1750, 1200, self.approach); ahead = b['ang']+.35
            fx = lerp(WW/2, self.viewerX, self.approach*.55 if self.people else 0)
            tx = fx+math.cos(ahead+i)*R+math.sin(self.t*.11+b['seed'])*180
            ty = lerp(150, 320, self.approach)+math.sin(ahead*1.7+b['seed'])*95+math.sin(self.t*.27+b['seed'])*30
            leaving = b['leave'] or not want
            self.steer(b, (-400 if b['x'] < WW/2 else WW+400) if leaving else tx, 40 if leaving else ty, 190 if leaving else 150, 60, dt, 0)
            if b['leave'] and (b['x'] < -300 or b['x'] > WW+300): self.birds.pop(i); continue
            if want and self.approach > .15 and rr.random() < dt*self.approach*.16:
                k = 8+int(rr.random()*(T.M-8))
                if T.is_branch[k] and T.depth[k] >= 2 and math.hypot(T.x1[k]-b['x'], T.y1[k]-b['y']) < 900 and (not self.people or abs(T.x1[k]-self.viewerX) < 900):
                    b['mode'] = 'land'; b['node'] = k; b['until'] = self.t+stay*(.6+rr.random()*.8)+4
            i += 1
        for b in self.birds:
            target = math.atan2(b['vy'], b['vx']); d = target-b['heading']; d = math.atan2(math.sin(d), math.cos(d))
            if math.hypot(b['vx'], b['vy']) > 8: b['heading'] += d*min(1, dt*2.5)

    # ------------------------------------------------ 관객 (감지 서버 / 카메라 덩어리 / 가상)
    def prox_of(self, h): return clamp((h-self.cams['far'])/max(.05, self.cams['near']-self.cams['far']), 0, 1)
    def update_people(self, src, live):
        """src: [{'id','x','h'}] (감지 서버나 카메라), live: 실제 감지 여부"""
        if not live:
            n = self.sim_count
            src = [{'id':'v%d'%i, 'x':clamp((i+.5)/n+math.sin(self.t*.11+i*2)*.06, .05, .95),
                    'h':lerp(self.cams['far'], self.cams['near'], self.sim_approach)} for i in range(n)]
        prev = {p['id']:p for p in self.people}; out = []
        for q in src[:8]:
            o = prev.get(q['id']); pr = self.prox_of(q['h'])
            out.append({'id':q['id'], 'x':lerp(o['x'], q['x'], .3), 'h':q['h'], 'prox':lerp(o['prox'], pr, .25)} if o else
                       {'id':q['id'], 'x':q['x'], 'h':q['h'], 'prox':pr})
        self.people = out
        if live:
            near = max(self.people, key=lambda p: p['prox'], default={'prox':0, 'x':.5})
            target = max(.14, near['prox']) if self.people else 0
            self.approach += (target-self.approach)*(.12 if target > self.approach else .04)
            if self.people: self.viewerX = lerp(self.viewerX, 250+near['x']*(WW-500), .15)
        elif self.sim_count > 0:
            self.approach = max(.14, self.sim_approach)
        else:
            self.approach = self.sim_approach

    # ------------------------------------------------ 음악
    def music_values(self, b, m, h, lv, dt):
        M = self.music
        M['b'], M['m'], M['h'], M['lv'] = b, m, h, lv
        M['slowB'] += (b-M['slowB'])*min(1, dt*1.5)
        if b-M['slowB'] > .2 and b > .5 and self.t-M['lastKick'] > .42:
            M['kick'] = 1; M['lastKick'] = self.t; self.on_beat()
        M['kick'] *= math.exp(-dt*5)

    def on_beat(self):
        rr = self.rng; r = self.music['react']
        if r < .05: return
        self.pulses.append({'t0':self.t, 'speed':3+rr.random()*3, 'seed':rr.random()*100}); self.pulses = self.pulses[-4:]
        n = round((18+rr.random()*24)*min(1.5, r))
        for _ in range(n):
            sz = rr.random()
            self.sparks.append({'g':int(rr.random()*1e6), 'p0':rr.random()*4, 't0':self.t+rr.random()*1.2, 'sp':.6+rr.random()*3,
                                'r':.4+sz*sz*1.6, 'a':rr.random(), 'life':3+rr.random()*5})
        self.sparks = self.sparks[-420:]
        self.add_ripple(WW/2+(rr.random()-.5)*300, GROUND-40, .9*min(1.4, r), 0)
        for b in self.birds:
            if b['mode']=='perch' and rr.random() < .25*r: b['until'] = self.t

    def add_ripple(self, x, y, amp, gen):
        rr = self.rng
        self.rips.append({'x':x, 'y':y, 't0':self.t, 'amp':amp}); self.rips = self.rips[-8:]
        if gen < 2:
            for _ in range(2):
                delay = .9+rr.random()*1.4; ang = -math.pi*rr.random(); d = delay*620*(.75+rr.random()*.3)
                self.ripq.append({'at':self.t+delay, 'x':clamp(x+math.cos(ang)*d*1.6, 100, WW-100), 'y':clamp(y+math.sin(ang)*d*.6, 60, WH-60), 'amp':amp*.62, 'gen':gen+1})

    def rip_uniform(self, playing):
        """파티클 셰이더용 물결 8개: (x, y, age, amp)"""
        for q in [q for q in self.ripq if self.t >= q['at']]:
            self.ripq.remove(q); self.add_ripple(q['x'], q['y'], q['amp'], q['gen'])
        M = self.music
        if playing and self.rng.random() < M['lv']*M['lv']*M['react']*.05:
            self.add_ripple(300+self.rng.random()*3400, 120+self.rng.random()*700, .25+.35*M['m'], 2)
        a = np.zeros((8, 4), np.float32)
        for i, r in enumerate(self.rips):
            age = self.t-r['t0']
            if age < 7: a[i] = (r['x'], r['y'], age, r['amp'])
        return a

    # ------------------------------------------------ 대기 모드 카메라웍
    def cam_at(self, node, z):
        T = self.T; vw = WW/z; vh = WH/z
        return {'x':clamp(T.x1[node]+vw*.06, vw/2, WW-vw/2), 'y':clamp(T.y1[node]+vh*.26, vh/2, WH-vh/2), 'z':z}
    def cam_for(self, r): return self.cam_at(r['node'], 1.75)
    def start_dissolve(self):
        if SEL['cam'] != 'dissolve': return False
        self.dissolve = {'t':0.0, 'dur':3.4}; self.dissolve_start = True; return True
    def pick_rope(self):
        c = [r for r in self.ropes if r['state']=='hang' and r is not self.idle['rope']]
        return self.rng.choice(c) if c else None
    def highlight(self, r): self.hl['rope'] = r; self.hl['target'] = 1; self.hl['layout'] = None

    def update_idle(self, dt):
        I = self.idle; present = self.approach > .12
        courier = next((b for b in self.birds if b['courier']), None); typing = next((r for r in self.ropes if r['state']=='typing'), None)
        def go(p): I['phase'] = p; I['t'] = 0.0
        I['t'] += dt
        if courier or typing or self.queue:
            node = courier['courier']['node'] if courier else typing['node'] if typing else self.queue[0]['rope']['node']
            if I['phase'] not in ('arrival', 'newread'): go('arrival'); self.hl['target'] = 0
            self.arrivalNode = node
        if I['phase'] == 'arrival':
            self.camGoal = self.cam_at(self.arrivalNode, 1.45)
            if courier:
                st = courier['courier'].get('stage')
                self.status = '새가 가지 주위를 맴도는 중' if st=='circle' else '새가 가지로 내려앉는 중' if st=='descend' else '새가 말을 물고 날아오는 중'
            else: self.status = '말이 한 글자씩 내려오는 중' if typing else '말이 걸림'
            if self.queue and self.t > self.queue[0]['at'] and self.hl['a'] < .04:
                q = self.queue.pop(0)
                if q['rope'] in self.ropes: self.highlight(q['rope']); go('newread'); return
            if not courier and not typing and not self.queue: go('release')
            return
        if I['phase'] == 'newread':
            self.status = '새로 걸린 말을 읽는 중'; self.camGoal = self.cam_at(self.arrivalNode, 1.45)
            if I['t'] > 11: self.hl['target'] = 0; go('release')
            return
        if present or SEL['idle'] != 'on':
            if I['phase'] != 'wide': go('wide'); self.hl['target'] = 0
            self.camGoal = {'x':WW/2, 'y':WH/2, 'z':1}; self.status = '관객 감지 · 새가 모여듦' if present else '대기 모드 꺼짐'
            return
        if I['phase'] == 'wide':
            self.camGoal = {'x':WW/2, 'y':WH/2, 'z':1}; self.status = '대기 · 전체 나무'
            if I['t'] > 12:
                r = self.pick_rope()
                if not r: return
                I['rope'] = r; go('move'); self.camGoal = self.cam_for(r)
                if self.start_dissolve(): self.cam = dict(self.camGoal)
        elif I['phase'] == 'move':
            self.status = '대기 · 가지로 다가감'
            if I['rope'] not in self.ropes: go('wide'); return
            self.camGoal = self.cam_for(I['rope'])
            if I['t'] > (3 if SEL['cam']=='dissolve' else 6.5): go('read'); self.highlight(I['rope'])
        elif I['phase'] == 'read':
            self.status = '대기 · 문장을 읽는 중'
            if I['t'] > 11: go('release'); self.hl['target'] = 0
        elif I['phase'] == 'release':
            self.status = '문장이 가지로 돌아감'
            if I['t'] > 3.5:
                if self.rng.random() < .35:
                    r = self.pick_rope()
                    if r:
                        I['rope'] = r; go('move'); self.camGoal = self.cam_for(r)
                        if self.start_dissolve(): self.cam = dict(self.camGoal)
                        return
                go('wide'); self.camGoal = {'x':WW/2, 'y':WH/2, 'z':1}
                if self.start_dissolve(): self.cam = {'x':WW/2, 'y':WH/2, 'z':1}

    # ------------------------------------------------ 한 프레임
    def step(self, dt):
        dt = min(.033, dt); self.t += dt; rr = self.rng
        WIND['next'] -= dt
        if WIND['next'] < 0: WIND['next'] = 16+rr.random()*14; WIND['gustT'] = 0
        WIND['gustT'] += dt; WIND['gust'] = max(0, math.sin(min(1, WIND['gustT']/5)*math.pi))*.9
        for tm in [x for x in self.timers if self.t >= x[0]]:
            self.timers.remove(tm); tm[1]()
        self.T.step(dt, self.t)
        for s in self.T.SAP: s['pos'] += s['sp']*dt*(1+self.music['lv']*self.music['react']*.4)
        self.step_ropes(dt, self.t); self.update_birds(dt); self.cycle(dt); self.update_idle(dt)
        g = self.camGoal; k = 1-math.exp(-dt*(.32 if SEL['cam']=='glide' else .5))
        for c in 'xyz': self.cam[c] = lerp(self.cam[c], g[c], k)
        h = self.hl
        h['a'] = clamp(h['a']+(h['target']-h['a'])*min(1, dt*(1.1 if h['target'] else 1.4)), 0, 1)
        if h['a'] < .002 and h['target'] == 0: h['rope'] = None; h['layout'] = None
        if self.dissolve:
            self.dissolve['t'] += dt
            if self.dissolve['t'] >= self.dissolve['dur']: self.dissolve = None

    def dissolve_alpha(self):
        if not self.dissolve: return 0.0
        return 1-ease(min(1, self.dissolve['t']/self.dissolve['dur']))

    # ================================================ 그리기 → Out
    def render(self, px_world):
        """px_world: 화면 1px(1600 기준 ×1.15)에 해당하는 월드 단위 = 원본 PX"""
        o = Out(); P = PAL[SEL['color']]
        hlA = ease(self.hl['a'])
        self.PX = px_world
        self.draw_data_tree(o, P, .8)
        self.draw_ropes(o, P)
        self.draw_birds(o, P)
        self.draw_hud(o, P, lerp(1, .38, hlA))
        return o

    def lin_points(self):
        """계보선 가닥마다 각 마디의 위치 (R, Lmax)"""
        T = self.T; idx = self.lin_safe(); R, Lm = idx.shape
        j = np.arange(Lm)[None, :]
        tr = T.is_trunk[idx]; ft = T.ft[idx]
        wdt = np.where(tr, 120-j*9, 7+30*np.exp(-(ft-1)/5))
        off = T.lin_off[:, None]
        spread = np.where(tr, .5*wdt*np.sin(off*TAU + j*.62), off*wdt)
        ang = T.ang[idx]
        ax = T.x1[idx]-np.sin(ang)*spread; ay = T.y1[idx]+np.cos(ang)*spread
        return ax, ay
    def lin_safe(self):
        idx = self.T.lin_idx.copy(); L = self.T.lin_len
        last = idx[np.arange(len(L)), L-1]
        for r in range(idx.shape[0]): idx[r, L[r]:] = last[r]
        return idx

    def draw_data_tree(self, o, P, dim):
        T = self.T; L = P['line']; A = P['accent']; PX = self.PX; spec = SEL['color']=='spectrum'
        # 1) 계보선: 중점을 지나는 2차 곡선
        ax, ay = self.lin_points(); idx = self.lin_safe()
        r0 = T.lin_idx[:, 0]
        px0 = T.x0[r0]+T.lin_off*70; py0 = T.y0[r0]
        prevx = np.concatenate([px0[:, None], ax[:, :-1]], 1); prevy = np.concatenate([py0[:, None], ay[:, :-1]], 1)
        midx = (prevx+ax)/2; midy = (prevy+ay)/2
        # 곡선 j: 이전 끝점(이전 중점) → 제어점 prev → 이번 중점 (마지막은 실제 끝점)
        Lm = ax.shape[1]; last = (np.arange(Lm)[None, :] == (T.lin_len[:, None]-1))
        endx = np.where(last, ax, midx); endy = np.where(last, ay, midy)
        startx = np.concatenate([px0[:, None], endx[:, :-1]], 1); starty = np.concatenate([py0[:, None], endy[:, :-1]], 1)
        tt = np.linspace(0, 1, 3, dtype=np.float32)[None, None, :]; q = 1-tt
        X = q*q*startx[..., None]+2*q*tt*prevx[..., None]+tt*tt*endx[..., None]
        Y = q*q*starty[..., None]+2*q*tt*prevy[..., None]+tt*tt*endy[..., None]
        R = X.shape[0]; X = X.reshape(R, -1); Y = Y.reshape(R, -1)
        if spec:
            for key in range(len(SPEC)):
                rows = (T.lin_limb % len(SPEC)) == key
                if rows.any(): o.poly(X[rows], Y[rows], SPEC[key], .2*dim, .7)
        else:
            o.poly(X, Y, L, .1*dim, .7)
        # 음악의 빛 (박자마다 가닥을 타고 오르는 빛)
        if self.pulses:
            self.draw_pulses(o, A, dim)
        if self.sparks:
            self.draw_sparks(o, A, dim)
        # 2) 가지 선
        wh = T.is_whip; br = ~wh
        bx, by = quad(T.x0[br], T.y0[br], T.cx[br], T.cy[br], T.x1[br], T.y1[br], 4)
        o.poly(bx, by, L, .26*dim, .75)
        wx, wy = quad(T.x0[wh], T.y0[wh], T.cx[wh], T.cy[wh], T.x1[wh], T.y1[wh], 4)
        o.poly(wx, wy, L, .18*dim, .6)
        self.draw_kinetic(o, P, dim)
        # 3) 뿌리
        if not hasattr(self, '_roots'):
            rx = []; ry = []
            for j in range(46):
                sp = (j-22.5)/22.5; ln = 520+hashf(j)*760
                x, y = cubic(WW/2+sp*70, GROUND-70, WW/2+sp*150, GROUND-8, WW/2+sp*ln*.55, GROUND+2+math.sin(j)*7, WW/2+sp*ln, GROUND+10+hashf(j+9)*18, 14)
                rx.append(x); ry.append(y)
            self._roots = (np.array(rx), np.array(ry))
        o.poly(self._roots[0], self._roots[1], L, .17*dim, .7)
        # 4) 잎 노드
        lv = np.array(T.LEAVES); q = np.arange(len(lv))
        r = np.where(q % 4 == 0, 2.1, 1.4)*PX
        if spec:
            for k in range(len(SPEC)):
                m = (T.limb[lv] % len(SPEC)) == k
                o.dots_np(T.x1[lv[m]], T.y1[lv[m]], r[m], SPEC[k], .85*dim)
        else:
            acc = q % 6 == 0
            o.dots_np(T.x1[lv[~acc]], T.y1[lv[~acc]], r[~acc], L, .45*dim)
            o.dots_np(T.x1[lv[acc]], T.y1[lv[acc]], r[acc], A, .6*dim)
        # 6) 수치 라벨
        fsz = 5.6*PX*1.15; placed = []
        for i in np.nonzero(T.label)[0]:
            x, y = T.x1[i], T.y1[i]
            if any(abs(qx-x) < fsz*5 and abs(qy-y) < fsz*2.2 for qx, qy in placed): continue
            placed.append((x, y)); s = '%.2f' % T.val[i]
            for k, ch in enumerate(s):
                o.glyph(('mono', ch), x+fsz*.75+fsz*.62*(k+.5), y, 0, fsz, L, .3*dim)

    def pt_at(self, chain_row, p):
        T = self.T; ch = T.lin_idx[chain_row]; n = T.lin_len[chain_row]
        j = int(min(n-1, max(0, math.floor(p)))); u = p-j; nd = ch[j]
        return lerp(T.x0[nd], T.x1[nd], u), lerp(T.y0[nd], T.y1[nd], u)

    def draw_pulses(self, o, A, dim):
        T = self.T; R = len(T.LINEAGE); gi = np.arange(R, dtype=np.float64)
        tiers = [([], .06, .6), ([], .12, .75), ([], .2, .95), ([], .3, 1.2)]
        for pl in self.pulses:
            age = self.t-pl['t0']; sd = pl['seed']
            h1 = hash_np(gi*7.31+sd); h2 = hash_np(gi*3.17+sd*1.7); h3 = hash_np(gi*1.93+sd*.31)
            pos = (age-h1*2.2)*pl['speed']*(.45+1.1*h2)
            ln = .35+1.8*hash_np(gi*5.7+sd*2.3)
            ok = (h3 >= .5) & (pos > 0) & (pos < T.lin_len-1)
            for g in np.nonzero(ok)[0]:
                p = pos[g]; p0 = max(0, p-ln[g])
                tier = tiers[0 if h3[g] < .62 else 1 if h3[g] < .84 else 2 if h3[g] < .95 else 3][0]
                xs = []; ys = []
                x, y = self.pt_at(g, p0); xs.append(x); ys.append(y)
                for k in range(math.ceil(p0), math.ceil(p)):
                    if k >= p: break
                    nd = T.lin_idx[g, k]; xs.append(T.x0[nd]); ys.append(T.y0[nd])
                x, y = self.pt_at(g, p); xs.append(x); ys.append(y)
                tier.append((xs, ys))
        lastp = self.pulses[-1]; fade = clamp(1-(self.t-lastp['t0'])/14, 0, 1)*.6+.4
        M = self.music
        for segs, al, w in tiers:
            for xs, ys in segs:
                o.poly(np.array(xs), np.array(ys), A, al*dim*fade*(.7+.5*M['react']*.5), w)
        self.pulses = [pl for pl in self.pulses if self.t-pl['t0'] < 18]

    def draw_sparks(self, o, A, dim):
        T = self.T; keep = []
        for sp in self.sparks:
            age = self.t-sp['t0']
            if age < 0: keep.append(sp); continue
            if age > sp['life']: continue
            g = sp['g'] % len(T.LINEAGE); pos = sp['p0']+age*sp['sp']
            if pos >= T.lin_len[g]-1: continue
            x, y = self.pt_at(g, pos); k = math.sin(math.pi*age/sp['life']); r = self.PX*sp['r']*(.6+.4*k)
            o.dot(x, y, r, A, (.1 if sp['a'] < .4 else .2 if sp['a'] < .75 else .38)*dim)
            keep.append(sp)
        self.sparks = keep

    def draw_kinetic(self, o, P, dim):
        T = self.T; L = P['line']; A = P['accent']; PX = self.PX
        tr = T.TRUNK; M = len(tr)
        def axis(u):
            f = min(M-1e-4, max(0, u*M)); j = int(f); s = f-j; n = tr[j]; q = 1-s
            x = q*q*T.x0[n]+2*s*q*T.cx[n]+s*s*T.x1[n]; y = q*q*T.y0[n]+2*s*q*T.cy[n]+s*s*T.y1[n]
            dx = 2*q*(T.cx[n]-T.x0[n])+2*s*(T.x1[n]-T.cx[n]); dy = 2*q*(T.cy[n]-T.y0[n])+2*s*(T.y1[n]-T.cy[n]); l = math.hypot(dx, dy) or 1
            return x, y, -dy/l, dx/l
        def hw(u): return (44+11*math.sin(u*5.2+.6)+70*(1-u)**6)*(1+max(0, u-.8)*2.2)
        # 줄기 축을 numpy로 한 번에 (121점)
        SM = 120; U = np.arange(SM+1)/SM
        F = np.clip(U*M, 0, M-1e-4); J = F.astype(np.int64); Sx = F-J; Q = 1-Sx; ND = np.array(tr)[J]
        X0, Y0, CX, CY, X1, Y1 = T.x0[ND], T.y0[ND], T.cx[ND], T.cy[ND], T.x1[ND], T.y1[ND]
        AXx = Q*Q*X0+2*Sx*Q*CX+Sx*Sx*X1; AXy = Q*Q*Y0+2*Sx*Q*CY+Sx*Sx*Y1
        DX = 2*Q*(CX-X0)+2*Sx*(X1-CX); DY = 2*Q*(CY-Y0)+2*Sx*(Y1-CY); LL = np.hypot(DX, DY); LL[LL == 0] = 1
        NX = -DY/LL; NY = DX/LL
        HW = (44+11*np.sin(U*5.2+.6)+70*(1-U)**6)*(1+np.maximum(0, U-.8)*2.2)
        spin = self.t*.05
        def ribbon(ph, turns, rw, amp, u0, u1):
            m = (U >= u0) & (U <= u1); u = U[m]
            th = ph+u*turns*TAU+spin; c = np.cos(th); sn = np.sin(th)
            px = AXx[m]+NX[m]*sn*HW[m]*amp; py = AXy[m]+NY[m]*sn*HW[m]*amp; wd = rw*(.12+.88*np.abs(c))*(1-.45*u)
            ia = np.maximum(np.arange(len(u))-1, 0); ib = np.minimum(np.arange(len(u))+1, len(u)-1)
            dx = px[ib]-px[ia]; dy = py[ib]-py[ia]; l = np.hypot(dx, dy); l[l == 0] = 1
            ex1 = px-dy/l*wd; ey1 = py+dx/l*wd; ex2 = px+dy/l*wd; ey2 = py-dx/l*wd
            front = (c[:-1]+c[1:]) > 0
            # 앞/뒤가 바뀌는 지점에서 끊어 구간별로 그림
            cuts = np.nonzero(front[1:] != front[:-1])[0]+1
            starts = np.concatenate([[0], cuts]); ends = np.concatenate([cuts, [len(front)]])
            for s0, s1 in zip(starts, ends):
                f = front[s0]; al = (.42 if f else .1)*dim; w = .8 if f else .55
                o.poly(ex1[s0:s1+1], ey1[s0:s1+1], L, al, w); o.poly(ex2[s0:s1+1], ey2[s0:s1+1], L, al, w)
        ribbon(0.0, 1.2, 15, .96, 0, 1); ribbon(2.1, 1.2, 12, .9, .03, 1); ribbon(4.2, 1.2, 13, .93, 0, .97); ribbon(1.0, -.85, 8, .78, .08, .94)
        # 철근
        k = np.arange(4)[:, None]
        ofs = HW*(.62*np.sin(U*2.4+k*1.7)+.2*np.sin(U*7.1+k))
        o.poly(AXx+NX*ofs, AXy+NY*ofs, L, .36*dim, 1.25)
        # 묶음 철사 고리 (앞 반쪽 진하게, 뒤 반쪽 옅게)
        for u in (.08, .13, .18, .3, .36, .55, .6, .65, .7):
            x, y, nx, ny = axis(u); w = hw(u)*1.02; tx, ty = ny, -nx; e = min(9, w*.16)
            th = np.linspace(0, TAU, 33)
            X = x+nx*np.cos(th)*w+tx*np.sin(th)*e; Y = y+ny*np.cos(th)*w+ty*np.sin(th)*e
            frontm = np.sin(th) < 0
            o.poly(X[th >= math.pi-1e-6], Y[th >= math.pi-1e-6], L, .4*dim, .75)
            o.poly(X[th <= math.pi+1e-6], Y[th <= math.pi+1e-6], L, .08*dim, .6)
        # 뿌리 다리
        bx = T.x0[tr[0]]
        for sd, r, kn, h in [[-1,150,62,30],[-1,92,40,46],[1,128,58,36],[1,206,88,24],[-1,236,104,18],[1,70,30,52]]:
            sx = bx+sd*hw(0)*.45; sy = GROUND-h-30
            x1, y1 = cubic(sx, sy, sx+sd*12, sy+h*.7, bx+sd*kn, GROUND-h*.55, bx+sd*kn*1.15, GROUND-4, 12)
            x2, y2 = quad([bx+sd*kn*1.15], [GROUND-4], [bx+sd*(kn+r)*.55], [GROUND+3], [bx+sd*r], [GROUND-2], 6)
            o.poly(np.concatenate([x1, x2[0, 1:]]), np.concatenate([y1, y2[0, 1:]]), L, .4*dim, 1.1)
            o.dot(bx+sd*r, GROUND-2, 2.2, L, .55*dim)
        x, y = ellipse(bx, GROUND+3, 120, 8); o.poly(x, y, L, .22*dim, .7)
        x, y = ellipse(bx, GROUND+3, 260, 14); o.poly(x, y, L, .1*dim, .7)
        # 갈래마다 도는 원호
        for i in T.FORKS:
            r1, r2 = 26, 44; a = self.t*.35+i
            x, y = arc(T.x1[i], T.y1[i], r1, a, a+1.7, 16); o.poly(x, y, L, .55*dim, .9)
            x, y = arc(T.x1[i], T.y1[i], r2, -a*.7, -a*.7+.9, 12); o.poly(x, y, A, .5*dim, .9)
            ex = T.x1[i]+math.cos(-a*.7+.9)*r2; ey = T.y1[i]+math.sin(-a*.7+.9)*r2
            o.dot(ex, ey, PX*1.8, A, .9*dim); o.dot(T.x1[i], T.y1[i], PX*2.7, L, .9*dim)
        # 수액 빛
        tails_x = []; tails_y = []
        for s in T.SAP:
            g = s['g'] % len(T.LINEAGE); n = T.lin_len[g]
            if s['pos'] >= n-1: s['pos'] = 0; s['g'] = self.rng.randrange(1000000); continue
            j = int(s['pos']); u = s['pos']-j; a_ = T.lin_idx[g, j]
            x = lerp(T.x0[a_], T.x1[a_], u); y = lerp(T.y0[a_], T.y1[a_], u)
            b_ = T.lin_idx[g, max(0, j-1)]
            tails_x.append([x, lerp(T.x0[b_], T.x1[b_], u)]); tails_y.append([y, lerp(T.y0[b_], T.y1[b_], u)])
            o.dot(x, y, PX*1.5, A, .5*dim)
        if tails_x: o.poly(np.array(tails_x), np.array(tails_y), A, .16*dim, .8)

    # ------------------------------------------------ 문장 그리기
    def advance(self, ch, fs):
        """글자 폭 근사 (명조 기준): 한글·한자 전각, 영숫자 반각"""
        o = ord(ch)
        if ch == ' ': return fs*.28
        if 0xAC00 <= o <= 0xD7A3 or 0x3130 <= o <= 0x318F or 0x4E00 <= o <= 0x9FFF: return fs*.92
        if ch in '.,:;\'"!?·': return fs*.32
        return fs*.56

    def layout_for(self, r):
        fs = 64*FONT_SCALE; maxW = 1250 if SEL['set']=='guest' else 1500
        track = fs*.06; wordGap = fs*.22
        def tw(s):
            c = list(s); w = 0
            for j, ch in enumerate(c): w += self.advance(ch, fs)+(track if j < len(c)-1 else 0)+(wordGap if ch==' ' else 0)
            return w
        words = r['text'].split(' '); lines = []; line = ''
        for w in words:
            t = line+' '+w if line else w
            if tw(t) > maxW and line: lines.append(line); line = w
            else: line = t
        if line: lines.append(line)
        lh = fs*1.55; W = max(tw(l) for l in lines)
        g = self.camGoal; vw = WW/g['z']; vh = WH/g['z']; T = self.T; n = r['node']
        x0 = clamp(T.x1[n]-W*.25, g['x']-vw/2+vw*.06, g['x']+vw/2-W-vw*.06); x0 = clamp(x0, 60, WW-W-60)
        y0 = clamp(T.y1[n]+vh*.22, g['y']-vh/2+vh*.18, g['y']+vh/2-len(lines)*lh-vh*.12)
        pos = []
        for li, l in enumerate(lines):
            cx = x0
            for ch in l:
                cw = self.advance(ch, fs); pos.append({'x':cx+cw/2, 'y':y0+li*lh, 'ch':ch}); cx += cw+track+(wordGap if ch==' ' else 0)
            pos.append(None)
        mp = []; k = 0
        for ch in r['chars']:
            while k < len(pos) and pos[k] is None: k += 1
            if ch == ' ':
                mp.append(None)
                if k < len(pos) and pos[k] and pos[k]['ch'] == ' ': k += 1
                continue
            while k < len(pos) and (pos[k] is None or pos[k]['ch'] == ' '): k += 1
            mp.append(pos[k] if k < len(pos) else None); k += 1
        return {'map':mp, 'fs':fs}

    def draw_ropes(self, o, P):
        T = self.T; A = P['accent']; Tx = P['text']; PX = self.PX
        zoomReveal = clamp((self.cam['z']-1.3)/.8, 0, 1)
        hlA = ease(self.hl['a']); hr = self.hl['rope']
        for r in self.ropes:
            isH = r is hr; Ls = LAYER[r['layer']]
            alpha = Ls['a']*r['alpha']*(1 if isH else lerp(1, .14, hlA))
            if r['fresh'] > 0: alpha = max(alpha, r['fresh']*(1 if isH else lerp(1, .14, hlA)))
            n = math.ceil(r['shown']); node = r['node']
            o.poly(np.array([T.x1[node], r['x'][0]]), np.array([T.y1[node], r['y'][0]]), P['line'], .22*alpha, .7)
            reveal = 1 if SEL['text']=='vertical' else max(zoomReveal, hlA if isH else 0, 1 if r['state']=='typing' else 0, r['fresh'])
            lay = None
            if isH and SEL['hl']=='spread':
                if not self.hl['layout']: self.hl['layout'] = self.layout_for(r)
                lay = self.hl['layout']
            for i in range(min(n, len(r['chars']))):
                ch = r['chars'][i]
                if ch == ' ': continue
                x0, y0 = r['x'][i], r['y'][i]; x1, y1 = r['x'][i+1], r['y'][i+1]
                x = (x0+x1)/2; y = (y0+y1)/2
                rot = -math.atan2(x1-x0, y1-y0); fs = r['fs']; a = alpha; col = Tx; born = 1
                if i in r['ct']:
                    age = self.t-r['ct'][i]; born = ease(clamp(age/.6, 0, 1))
                    if age < 1.6: col = A
                    y -= (1-born)*r['fs']*.9
                if isH and SEL['hl']=='lift': fs *= lerp(1, 1.55, hlA); a = lerp(alpha, 1, hlA)
                if lay and i < len(lay['map']) and lay['map'][i]:
                    m = ease(clamp(self.hl['a']*1.7-(i/len(r['chars']))*.7, 0, 1)); tg = lay['map'][i]
                    x = lerp(x, tg['x'], m); y = lerp(y, tg['y'], m); rot = lerp(rot, 0, m); fs = lerp(fs, lay['fs'], m); a = lerp(alpha, 1, m)
                    if .02 < m < .98: o.dot(x, y, PX*1.2, A, .5*math.sin(m*math.pi))
                a *= born
                if reveal < 1:
                    o.dot(x, y, fs*.12, A if i % 7 == 0 else Tx, a*(1-reveal)*.95)
                if reveal > 0:
                    o.glyph(('serif', ch), x, y, rot, fs, col, a*reveal)

    # ------------------------------------------------ 새 그리기
    def draw_birds(self, o, P):
        PX = self.PX; A = P['accent']
        for b in self.birds:
            m = b['match']
            if not m or not m.get('p'): continue
            p = m['p']; gx = 250+p['x']*(WW-500); gy = GROUND+14
            born = clamp((self.t-m['t0'])/1.2, 0, 1); a = born*(.32+.55*p['prox'])
            x, y = quad([b['x']], [b['y']], [(b['x']+gx)/2], [(b['y']+gy)/2+40], [gx], [gy], 40)
            x = x[0]; y = y[0]
            # 점선 (흐르는 대시)
            seglen = np.hypot(np.diff(x), np.diff(y)); s = np.concatenate([[0], np.cumsum(seglen)])
            dash = ((s+self.t*24*PX) % (12*PX)) < 5*PX
            for k in range(len(x)-1):
                if dash[k]:
                    al = a*lerp(1, .15, k/(len(x)-1)); o.poly(x[k:k+2], y[k:k+2], A, al, 1.4)
            rr = PX*(4+8*p['prox'])*(1+.12*math.sin(self.t*3+sum(map(ord, str(p['id'])))))
            ex, ey = ellipse(gx, gy, rr*1.8, rr*.6, 32); o.poly(ex, ey, A, .75*born, 1.1)
            o.dot(gx, gy, PX*1.8, P['text'], .9*born)
        for b in self.birds:
            if b['alpha'] < .01: continue
            if b['match']:
                g = b['glow']; R = PX*(26+30*g)
                o.glow(b['x'], b['y'], R, A, .42*g)   # 빛무리 (방사형 그라디언트)
                age = self.t-b['match']['t0']
                if age < 1.6:
                    k = age/1.6; x, y = arc(b['x'], b['y'], PX*(10+90*ease(k)), 0, TAU, 40); o.poly(x, y, A, (1-k)*.9, 1.2)
            sp = math.hypot(b['vx'], b['vy']); s = 1.25 if b['courier'] else 1
            perch = b['mode']=='perch'
            gliding = (not perch) and (b['vy'] > 12 or (math.sin(self.t*.6+b['seed']) > .35 and sp > 90))
            b['phase'] += 0 if perch else (.9 if gliding else 5.2+sp*.01)*(1/60)
            f = .1 if perch else (.34+.04*math.sin(self.t*1.3+b['seed'])) if gliding else (math.sin(b['phase'])*.5+.5)
            left = math.cos(b['heading']) < 0; pitch = clamp(math.atan2(b['vy'], abs(b['vx'])+1e-3), -.5, .5)
            sx = (-1 if left else 1)*s*1.25; sy = s*1.25; rot = 0 if perch else pitch*.8
            cr, sr = math.cos(rot), math.sin(rot)
            def tf(pts):
                pts = np.array(pts, np.float64); X = pts[:, 0]*cr-pts[:, 1]*sr; Y = pts[:, 0]*sr+pts[:, 1]*cr
                return b['x']+X*sx, b['y']+Y*sy
            col = A if b['match'] else P['line']; al = .95 if b['match'] else .9*b['alpha']; w = 1.5 if b['match'] else 1.05
            for pts in ([(-16,5),(10,-3),(17,-2)], [(-16,5),(-7,1.5)],
                        [(-3,0),(-12+f*2,-4-21*f+(1-f)*6),(5,-2)], [(1,-1),(4+f*4,-3-15*f+(1-f)*5),(8,-2)]):
                x, y = tf(pts); o.poly(x, y, col, al, w)
            x, y = tf([(-12+f*2,-4-21*f+(1-f)*6), (17,-2)])
            o.dot(x[0], y[0], PX*1.2, A, b['alpha']); o.dot(x[1], y[1], PX*1.2, A, b['alpha'])

    # ------------------------------------------------ 데이터 콜아웃
    def draw_hud(self, o, P, dim):
        T = self.T; PX = self.PX
        if self.t > self.tags['next']:
            self.tags['next'] = self.t+8; c = [r for r in self.ropes if r['state']=='hang']
            self.tags['list'] = [{'r':self.rng.choice(c), 't0':self.t} for _ in range(min(3, len(c)))]
        quiet = 1-ease(self.hl['a'])
        if quiet < .02: return
        boxes = []; u = PX*1.2
        for it in self.tags['list']:
            r = it['r']
            if r not in self.ropes: continue
            n = r['node']; a = min(1, (self.t-it['t0'])/1.4)*min(1, (it['t0']+8-self.t)/1.4)*quiet
            if a <= 0: continue
            side = -1 if T.x1[n] < WW/2 else 1
            pool = self.pool(); pi = pool.index(r['text']) if r['text'] in pool else -1
            num = '' if pi < 0 else '%02d' % (pi+1)
            hh = '%02d' % r['clock'].tm_hour; mm = '%02d' % r['clock'].tm_min
            big = 26*u; small = 8.5*u; ticks = math.ceil(len(r['chars'])/2)
            nw = big*.62*len(num) if num else small*3.2
            tw = max(small*6, ticks*small*.42); w = nw+small*1.4+tw; h = big*1.05
            bx = T.x1[n]+side*(48+small*2); by = clamp(T.y1[n]+70, SAFE_TOP+10, SAFE_BOTTOM-220); x0 = bx if side > 0 else bx-w
            if any(x0 < q[0]+q[2]+30 and x0+w+30 > q[0] and by < q[1]+q[3]+30 and by+h+30 > q[1] for q in boxes): continue
            boxes.append((x0, by, w, h))
            ex = x0-small*.6 if side > 0 else x0+w+small*.6
            o.poly(np.array([T.x1[n], T.x1[n], ex]), np.array([T.y1[n], by+h*.5, by+h*.5]), P['line'], .42*a, .7)
            o.dot(T.x1[n], T.y1[n], PX*2.6, P['text'], .95*a)
            x, y = arc(T.x1[n], T.y1[n], PX*(6+2*math.sin(self.t*2+r['seed'])), 0, TAU, 28); o.poly(x, y, P['accent'], .6*a, .7)
            if num:
                for k, ch in enumerate(num): o.glyph(('serif', ch), x0+big*.62*(k+.5), by+big*.55, 0, big, P['text'], .92*a)
            else:
                o.dot(x0+nw/2, by+big*.55, small*.75, P['accent'], .95*a)
            cx = x0+nw+small*.7
            o.poly(np.array([cx, cx]), np.array([by+big*.12, by+big*.95]), P['line'], .35*a, .7)
            tx = cx+small*.7
            for k, ch in enumerate(hh+':'+mm): o.glyph(('mono', ch), tx+small*.6*(k+.5), by+big*.42-small*.35, 0, small, P['accent'], .9*a)
            for k in range(ticks):
                th = (1.3 if k % 5 == 4 else .7)*small; X = tx+k*small*.42
                o.poly(np.array([X, X]), np.array([by+big*.92-th, by+big*.92]), P['text'], (.75 if k % 5 == 4 else .4)*a, .9)

