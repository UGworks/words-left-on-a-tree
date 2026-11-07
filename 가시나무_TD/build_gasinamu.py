"""가시나무에 매달린 말들 — TouchDesigner 네트워크 생성 스크립트.

TouchDesigner의 Textport(Alt+T)에서 한 번 실행:
    exec(open('<이 파일의 절대 경로>', encoding='utf-8').read())

/project1/gasinamu 를 새로 만든다 (이미 있으면 지우고 다시 만든다). /project1의 다른 노드는 건드리지 않는다.
"""
import os, sys, traceback

FOLDER = os.path.dirname(os.path.abspath(__file__)) if str(globals().get('__file__', '')).endswith('build_gasinamu.py') else None
if not FOLDER:
    import glob   # macOS 한글 폴더명은 NFD라 경로를 직접 쓰지 않고 찾음
    FOLDER = os.path.dirname(sorted(glob.glob(os.path.expanduser('~/Desktop/*/*/*_TD/build_gasinamu.py')))[0])
MEDIA = os.path.dirname(FOLDER)
if FOLDER not in sys.path: sys.path.insert(0, FOLDER)
import importlib
import gsn_sim, gsn_td
importlib.reload(gsn_sim); importlib.reload(gsn_td)
from gsn_td import setp, log

# 기준 해상도 3840×960. Non-Commercial 라이선스는 1280×1280이 한도라 그때는 1280×320으로 렌더
RES = (3840, 960)

GLSL_COMMON = '''
float h31(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vn(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fb(vec3 p){ return vn(p)*.6+vn(p*2.1+3.)*.3+vn(p*4.3+7.)*.1; }
uniform vec4 uRip0; uniform vec4 uRip1; uniform vec4 uRip2; uniform vec4 uRip3;
uniform vec4 uRip4; uniform vec4 uRip5; uniform vec4 uRip6; uniform vec4 uRip7;
float ripW(vec2 p, float jit, float spd, out vec2 dir){
  vec4 R[8]=vec4[8](uRip0,uRip1,uRip2,uRip3,uRip4,uRip5,uRip6,uRip7);
  float sum=0.; dir=vec2(0);
  for(int i=0;i<8;i++){ vec4 r=R[i]; if(r.w<=0.) continue;
    float rad=r.z*620.*spd, w=120.+rad*.18; vec2 dv=p-r.xy; float d=length(dv)+1e-3;
    float b=r.w*exp(-pow((d+jit-rad)/w,2.))*exp(-r.z*.45*spd); sum+=b; dir+=dv/d*b; }
  return sum; }
float hh(float n){ return fract(sin(n*12.9898)*43758.5453); }
out vec4 fragColor;
'''

# 입자 상태 갱신: (x, y, age, life) — board.html UPD 셰이더와 같은 식
GLSL_UPDATE = '''
uniform vec4 uT;   // t, dt, bass, wind
uniform vec4 uP1;  // flow, scale, rise, crown
uniform vec4 uP2;  // lifeMin, lifeMax, push, rippleSpeed
''' + GLSL_COMMON + '''
void main(){
  ivec2 ij=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(sTD2DInputs[0],ij,0); vec2 p=s.xy; float age=s.z+uT.y, life=s.w;
  vec3 q=vec3(p*.0011/uP1.y, uT.x*.035); const float e=.03;
  vec2 curl=vec2(fb(q+vec3(0,e,0))-fb(q-vec3(0,e,0)), -(fb(q+vec3(e,0,0))-fb(q-vec3(e,0,0))))/(2.*e);
  vec2 dir; ripW(p,0.,uP2.w,dir);
  p+= (curl*(18.+uT.z*14.)*uP1.x + dir*55.*uP2.z + vec2(uT.w*22., -uP1.z))*uT.y;
  if(age>life || p.x<-40. || p.x>4040. || p.y<-40. || p.y>1040.){
    float r1=h31(vec3(vec2(ij),uT.x)), r2=h31(vec3(vec2(ij.yx),uT.x+1.)), r3=h31(vec3(vec2(ij),uT.x+2.));
    if(r3<uP1.w){ float a=r1*6.2832, rr=sqrt(r2); p=vec2(2000.+cos(a)*rr*1850., 430.+sin(a)*rr*400.); }
    else p=vec2(r1*4000., r2*1000.);
    age=0.; life=mix(uP2.x,max(uP2.x,uP2.y),pow(h31(vec3(vec2(ij),uT.x+3.)),1.6));
  }
  fragColor=TDOutputSwizzle(vec4(p,age,life));
}
'''

# 입자 → 인스턴스 위치·크기 (TD 좌표: y 뒤집음)
GLSL_XFORM = '''
uniform vec4 uCam;  // camx, camy, zoom, size
uniform vec4 uP3;   // rand, twinkle, accentRatio, rippleK
uniform vec4 uCol;  // line color * k, w = rippleSpeed
uniform vec4 uAcc;  // accent color * k, w = t
''' + GLSL_COMMON + '''
void main(){
  ivec2 ij=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(sTD2DInputs[0],ij,0); int N=textureSize(sTD2DInputs[0],0).x; float fid=float(ij.y*N+ij.x);
  vec2 dir; float rp=ripW(s.xy,(hh(fid+7.)-.5)*260.,uCol.w,dir)*uP3.w;
  float z=uCam.z;
  float px=uCam.w*mix(.6,3.2,pow(hh(fid+1.),2.5))*sqrt(z)*(1.+rp*.7);   // 1600px 화면 기준 점 지름
  fragColor=TDOutputSwizzle(vec4(s.x,-s.y,px/1600.*4000./z,1.));
}
'''

# 입자 → 인스턴스 색 (가산 합성용 rgb)
GLSL_COLOR = '''
uniform vec4 uCam; uniform vec4 uP3; uniform vec4 uCol; uniform vec4 uAcc;
''' + GLSL_COMMON + '''
void main(){
  ivec2 ij=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(sTD2DInputs[0],ij,0); int N=textureSize(sTD2DInputs[0],0).x; float fid=float(ij.y*N+ij.x);
  float base=mix(.45, .04+.96*pow(hh(fid),3.), uP3.x);
  float tw=1.-uP3.y+uP3.y*(.5+.5*sin(uAcc.w*(.3+2.2*hh(fid+3.))+hh(fid+5.)*6.28));
  float lf=s.z/max(s.w,.01); float fade=smoothstep(0.,.12,lf)*smoothstep(1.,.65,lf);
  vec2 dir; float rp=ripW(s.xy,(hh(fid+7.)-.5)*260.,uCol.w,dir)*uP3.w;
  float vA=base*tw*fade*(.5+2.4*rp);
  float vAcc=step(1.-uP3.z,hh(fid+9.));
  fragColor=TDOutputSwizzle(vec4(mix(uCol.rgb,uAcc.rgb,vAcc)*vA,1.));
}
'''

GLSL_SOFT = '''
out vec4 fragColor;
void main(){ float d=length(vUV.st-.5)*2.; float v=d>1.?0.:1.-d*d; fragColor=TDOutputSwizzle(vec4(v,v,v,v)); }
'''
GLSL_GLOW = '''
out vec4 fragColor;
void main(){ float d=length(vUV.st-.5)*2.; float v=clamp(1.-d,0.,1.); fragColor=TDOutputSwizzle(vec4(v,v,v,v)); }
'''
# 가장자리 비네트: board와 같은 방사형 (중심 0.55 높이, 안쪽 h*.4 → 바깥 w*.62, 최대 0.55 어둡게)
GLSL_VIGNETTE = '''
out vec4 fragColor;
void main(){ vec2 res=uTDOutputInfo.res.zw; vec2 p=vUV.st*res; vec4 c=texture(sTD2DInputs[0],vUV.st);
  float d=distance(p, vec2(res.x*.5, res.y*.45)); float t=clamp((d-res.y*.4)/(res.x*.62-res.y*.4),0.,1.);
  fragColor=TDOutputSwizzle(vec4(c.rgb*(1.-.55*t),1.)); }
'''

ENGINE = '''import sys
def _path():
    try:
        f = parent().par.Folder.eval()
        if f and f not in sys.path: sys.path.insert(0, f)
    except Exception:
        pass
_path()

def onStart():
    _path()
    import gsn_td
    gsn_td.init(parent())

def onFrameStart(frame):
    _path()
    import gsn_td
    if gsn_td.S['sim'] is None or gsn_td.S['root'] != parent().path:
        gsn_td.init(parent())
    gsn_td.frame(parent())
'''

CHOP_CB = '''import gsn_td
def onCook(scriptOp):
    gsn_td.cook_chop(scriptOp, '%s')
'''

SEED_CB = '''import numpy as np
def onCook(scriptOp):
    n = 192; a = np.zeros((n, n, 4), np.float32)
    rng = np.random.default_rng(7)
    a[..., 0] = rng.random((n, n))*4000; a[..., 1] = rng.random((n, n))*1000
    a[..., 3] = 1.5 + rng.random((n, n))*(16-1.5); a[..., 2] = rng.random((n, n))*a[..., 3]
    scriptOp.copyNumpyArray(a)
'''

PAREXEC = '''import gsn_td
def onPulse(par):
    if par.name == 'Send': gsn_td.send(par.owner)
    elif par.name == 'Reseed': gsn_td.reseed(par.owner)
    elif par.name == 'Rebuild': gsn_td.init(par.owner)
def onValueChange(par, prev):
    gsn_td.apply_pars(par.owner)
'''

WS_CB = '''import gsn_td
def onConnect(dat): gsn_td.vis_connect(True)
def onDisconnect(dat): gsn_td.vis_connect(False)
def onReceiveText(dat, rowIndex, message): gsn_td.vis_message(message)
def onReceiveBinary(dat, contents): pass
def onReceivePing(dat, contents): pass
def onReceivePong(dat, contents): pass
def onMonitorMessage(dat, message): pass
'''


def build():
    open(gsn_td.LOG, 'w').close()
    # 이미 있는 gasinamu 자리에 다시 만들고, 없으면 /project1(없으면 최상위)에 만든다
    hits = op('/').findChildren(name='gasinamu', type=containerCOMP, maxDepth=2)
    p1 = hits[0].parent() if hits else (op('/project1') or op('/'))
    for h in hits:
        if h.parent() == p1: h.destroy()
    root = p1.create(containerCOMP, 'gasinamu')
    root.nodeX = 0; root.nodeY = -600
    root.color = (0.25, 0.4, 0.28)
    root.comment = '가시나무에 매달린 말들 — TD 네이티브 재구현'

    # ------------------------------------------------ 커스텀 파라미터
    pg = root.appendCustomPage('작품')
    pg.appendStr('Folder', label='프로젝트 폴더')[0].val = FOLDER
    pg.appendToggle('Music', label='음악 재생')[0].val = 1
    pg.appendFloat('Volume', label='볼륨')[0].val = .8
    pg.appendFloat('React', label='음악 반응')[0].val = 1.0
    pg.appendStr('Sentence', label='남길 말')
    pg.appendPulse('Send', label='걸기')
    pg.appendInt('Simcount', label='가상 관객 수 (감지 없을 때)')[0].val = 0
    pg.appendFloat('Approach', label='가상 관객 접근')[0].val = 0.0
    pg.appendFloat('Openness', label='나무 상태 (긴장↔열림)')[0].val = .5
    m = pg.appendMenu('Set', label='문장'); m[0].menuNames = ['guest', 'deck']; m[0].menuLabels = ['방명록 목업 15', '기획서 예시 25']
    m = pg.appendMenu('Color', label='빛의 색'); m[0].menuNames = ['ivory', 'mono', 'amber', 'spectrum']; m[0].menuLabels = ['아이보리 + 연두', '흰색 단색', '따뜻한 금빛', '스펙트럼']
    m = pg.appendMenu('Highlight', label='문장 강조'); m[0].menuNames = ['spread', 'lift']; m[0].menuLabels = ['가지에서 풀려 가로로', '매달린 채 밝힘']
    m = pg.appendMenu('Textmode', label='멀리서 본 문장'); m[0].menuNames = ['vertical', 'stream']; m[0].menuLabels = ['처음부터 글자', '점에서 글자로']
    pg.appendToggle('Idle', label='대기 카메라웍')[0].val = 1
    m = pg.appendMenu('Transition', label='장면 전환'); m[0].menuNames = ['dissolve', 'glide']; m[0].menuLabels = ['디졸브', '부드러운 이동']
    pg.appendToggle('Mirror', label='감지 좌우 반전')[0].val = 1
    pg.appendFloat('Camfar', label="'멀리' 기준 (사람 키 비율)")[0].val = .25
    pg.appendFloat('Camnear', label="'바로 앞' 기준")[0].val = .8
    pg.appendPulse('Reseed', label='문장 다시 걸기')
    pg.appendPulse('Rebuild', label='시뮬레이션 다시 시작')
    pp = root.appendCustomPage('파티클')
    for name, label, val in [('Particles','파티클 표시',1)]:
        pp.appendToggle(name, label=label)[0].val = val
    for name, label, val in [('Psize','크기',1),('Pbright','밝기',1),('Paccent','연두 입자 비율',.07),('Pflow','흐름 속도',1),('Pscale','노이즈 크기',1),
                             ('Prise','위로 떠오름',6),('Pwind','바람 영향',1),('Pcrown','나무 주변에서 생성',.62),('Plifemin','최소 수명(초)',1.5),
                             ('Plifemax','최대 수명(초)',16),('Prand','불투명도 무작위',.85),('Ptwinkle','반짝임',.45),('Pripple','빛 번짐 세기',1),
                             ('Pripplespeed','번짐 속도',1),('Ppush','번짐에 밀려남',1)]:
        par = pp.appendFloat(name, label=label)[0]; par.val = val; par.normMax = max(1, val*4)

    def dat(name, text, x, y, kind=textDAT):
        d = root.create(kind, name); d.text = text; d.nodeX = x; d.nodeY = y; return d
    def place(o, x, y): o.nodeX = x; o.nodeY = y; return o
    # 경로 파라미터는 모두 형제 노드 이름(상대 경로)으로 지정 → .tox를 어디에 놓아도 연결이 유지됨

    # ------------------------------------------------ 왼쪽 열: 엔진·조작·음악·감지
    eng = place(root.create(executeDAT, 'engine'), -1100, 450); eng.text = ENGINE
    setp(eng, start=1, framestart=1, active=1)
    pe = place(root.create(parameterexecuteDAT, 'parexec'), -1100, 300); pe.text = PAREXEC
    setp(pe, op='..', pars='Send Reseed Rebuild Set Color Highlight Textmode Idle Transition Simcount Approach Openness Camfar Camnear React',
         valuechange=1, onpulse=1, active=1)
    pe.par.op.expr = 'parent()'
    dat('status', '', -1100, 150)
    wav = os.path.join(MEDIA, 'audio', 'Saltwater Silence.wav')
    mus = place(root.create(audiofileinCHOP, 'music'), -1100, -50)
    setp(mus, file=wav, repeat='on', timeslice=1)
    mus.par.play.expr = "parent().par.Music"
    aout = place(root.create(audiodeviceoutCHOP, 'audio_out'), -900, -50); aout.inputConnectors[0].connect(mus)
    aout.par.volume.expr = "parent().par.Volume"; aout.par.active.expr = "parent().par.Music"
    ws = place(root.create(websocketDAT, 'vision_ws'), -1100, -250)
    wcb = dat('vision_ws_cb', WS_CB, -900, -250)
    setp(ws, netaddress='127.0.0.1', port=8770, callbacks=wcb.name, active=0)

    # ------------------------------------------------ 가운데: 콜백 → Script CHOP → Geometry → 재질 (열마다 한 종류)
    def geo(name, x, sop='rect', mat=None, prio=0):
        g = place(root.create(geometryCOMP, name), x, 0)
        for c in list(g.children): c.destroy()
        if sop == 'rect':
            s = g.create(rectangleSOP, 'shape'); setp(s, sizex=1, sizey=1)
        else:
            s = g.create(circleSOP, 'shape'); setp(s, type='poly', divs=14, radx=.5, rady=.5)
        s.display = True; s.render = True
        setp(g, material=mat.name if mat else '', instancing=1, drawpriority=prio)
        return g

    def cmat(name, x, colormap='', additive=False):
        m = place(root.create(constantMAT, name), x, -170)
        setp(m, colorr=1, colorg=1, colorb=1, blending=1, srcblend='one', destblend='one' if additive else 'omsa',
             depthtest=0, depthwriting=0, cullface='neither', postmultalpha=0)
        if colormap: setp(m, colormap=colormap)
        return m

    # 재질용 텍스처 (아래쪽)
    soft = place(root.create(glslTOP, 'soft_dot'), -500, -400)
    sd = dat('soft_dot_frag', GLSL_SOFT, -700, -400); setp(soft, pixeldat=sd.name, outputresolution='custom', resolutionw=64, resolutionh=64, format='rgba8fixed')
    glw = place(root.create(glslTOP, 'glow_tex'), -500, -550)
    gd = dat('glow_frag', GLSL_GLOW, -700, -550); setp(glw, pixeldat=gd.name, outputresolution='custom', resolutionw=128, resolutionh=128, format='rgba8fixed')
    gl = place(root.create(baseCOMP, 'glyphs'), -300, -400); gl.comment = '글자 텍스처 (자동 생성)'
    first = gl.create(textTOP, 'g_tmp')

    X0, DX = -300, 240
    cols = ['ptc', 'segs', 'glows', 'dots']+['glyphs%d' % p for p in range(gsn_td.PAGES)]
    xs = {k: X0+i*DX for i, k in enumerate(cols)}
    m_ptc = cmat('mat_ptc', xs['ptc'], colormap=soft.name, additive=True)
    m_seg = cmat('mat_segs', xs['segs']); m_dot = cmat('mat_dots', xs['dots'])
    m_glow = cmat('mat_glows', xs['glows'], colormap=glw.name)
    m_glys = [cmat('mat_glyphs%d' % p, xs['glyphs%d' % p], colormap='glyphs/g_tmp') for p in range(gsn_td.PAGES)]
    for kind in cols[1:]:
        c = place(root.create(scriptCHOP, 'chop_'+kind), xs[kind], 170)
        cb = dat('chop_%s_cb' % kind, CHOP_CB % kind, xs[kind], 320); setp(c, callbacks=cb.name)
    g_ptc = geo('geo_ptc', xs['ptc'], 'rect', m_ptc, 0)
    g_seg = geo('geo_segs', xs['segs'], 'rect', m_seg, 1)
    g_glo = geo('geo_glows', xs['glows'], 'rect', m_glow, 2)
    g_dot = geo('geo_dots', xs['dots'], 'circle', m_dot, 3)
    g_glys = [geo('geo_glyphs%d' % p, xs['glyphs%d' % p], 'rect', m_glys[p], 4) for p in range(gsn_td.PAGES)]
    for g, kind in [(g_seg, 'segs'), (g_dot, 'dots'), (g_glo, 'glows')]+[(g_glys[p], 'glyphs%d' % p) for p in range(gsn_td.PAGES)]:
        setp(g, instanceop='chop_'+kind, instancecolormode='replace')

    # ------------------------------------------------ 아래: 파티클 씨앗 → 피드백 → 갱신 → 위치·색
    PY_ = -750
    seed = place(root.create(scriptTOP, 'ptc_seed'), -300, PY_)
    scb = dat('ptc_seed_cb', SEED_CB, -300, PY_-150); setp(seed, callbacks=scb.name, outputresolution='custom', resolutionw=192, resolutionh=192, format='rgba32float')
    fbk = place(root.create(feedbackTOP, 'ptc_fb'), -120, PY_); fbk.inputConnectors[0].connect(seed)
    upd = place(root.create(glslTOP, 'ptc_update'), 60, PY_); upd.inputConnectors[0].connect(fbk)
    ud = dat('ptc_update_frag', GLSL_UPDATE, 60, PY_-150)
    setp(upd, pixeldat=ud.name, outputresolution='custom', resolutionw=192, resolutionh=192, format='rgba32float')
    setp(fbk, top=upd.name)
    xf = place(root.create(glslTOP, 'ptc_xform'), 240, PY_); xf.inputConnectors[0].connect(upd)
    xd = dat('ptc_xform_frag', GLSL_XFORM, 240, PY_-150); setp(xf, pixeldat=xd.name, outputresolution='custom', resolutionw=192, resolutionh=192, format='rgba32float')
    cl = place(root.create(glslTOP, 'ptc_col'), 420, PY_); cl.inputConnectors[0].connect(upd)
    cd = dat('ptc_col_frag', GLSL_COLOR, 420, PY_-150); setp(cl, pixeldat=cd.name, outputresolution='custom', resolutionw=192, resolutionh=192, format='rgba32float')
    for t in (upd, xf, cl):
        t.seq.vec.numBlocks = 11
    setp(g_ptc, instanceop=xf.name, instancetx='r', instancety='g', instancesx='b', instancesy='b',
         instancecolorop=cl.name, instancecolormode='replace', instancer='r', instanceg='g', instanceb='b')

    # ------------------------------------------------ 오른쪽: 카메라 → 렌더 → 비네트 → 디졸브 → out → 창·프리뷰
    RX = X0+len(cols)*DX+120
    cam = place(root.create(cameraCOMP, 'cam'), RX, 170)
    setp(cam, projection='ortho', orthowidth=4000, tx=2000, ty=-500, tz=100, near=1, far=1000)
    ren = place(root.create(renderTOP, 'render'), RX, 0)
    setp(ren, camera=cam.name, geometry=' '.join('geo_'+k for k in cols), lights='',
         outputresolution='custom', resolutionw=RES[0], resolutionh=RES[1], antialias='aa8', bgcolorr=0, bgcolorg=0, bgcolorb=0, bgcolora=1)
    ren.cook(force=True)
    if 'Non-Commercial' in ren.warnings():
        setp(ren, resolutionw=1280, resolutionh=320); log('Non-Commercial 라이선스: 1280×320으로 렌더')
    vig = place(root.create(glslTOP, 'vignette'), RX+180, 0); vig.inputConnectors[0].connect(ren)
    vd = dat('vignette_frag', GLSL_VIGNETTE, RX+180, 170); setp(vig, pixeldat=vd.name)
    snp = place(root.create(cacheTOP, 'snap'), RX+360, -170); snp.inputConnectors[0].connect(vig)
    setp(snp, cachesize=2, outputindex=-1, active=1)
    crs = place(root.create(crossTOP, 'dissolve'), RX+540, 0)
    crs.inputConnectors[0].connect(vig); crs.inputConnectors[1].connect(snp); setp(crs, cross=0)
    out = place(root.create(nullTOP, 'out'), RX+720, 0); out.inputConnectors[0].connect(crs)
    out.viewer = True
    root.par.top.expr = "op('out')"
    setp(root, w=1920, h=480)
    win = place(root.create(windowCOMP, 'window'), RX+900, 0)
    setp(win, winop=out.name, borders=0, winw=1920, winh=480)
    win.comment = '프로젝터 출력: Open 버튼'
    # 모니터링용 큰 프리뷰 (4:1)
    pv = place(root.create(nullTOP, 'preview'), RX, -450); pv.inputConnectors[0].connect(out)
    pv.nodeWidth = 900; pv.nodeHeight = 260; pv.viewer = True; pv.color = (0.25, 0.4, 0.28)
    pv.comment = '출력 모니터링 (out과 같은 화면)'

    # F1(퍼폼 모드)로 출력만 전체 화면에
    try:
        setp(op('/perform'), winop=out.path, winw=1920, winh=480)
    except Exception:
        pass
    gsn_td.init(root)
    log('build done')
    return root

try:
    _root = build()
    print('가시나무 네트워크 생성 완료:', _root.path)
except Exception:
    log('build error\n'+traceback.format_exc())
    print(traceback.format_exc())

# 완성된 COMP를 .tox로, 이 폴더에서 연 프로젝트면 가시나무.toe로 저장
try:
    _root.save(os.path.join(FOLDER, 'gasinamu.tox'))
    import unicodedata
    _n = lambda p: unicodedata.normalize('NFC', os.path.realpath(p))   # macOS 한글 경로는 NFD일 수 있음
    if _n(project.folder) == _n(FOLDER):
        project.save(os.path.join(project.folder, project.name))
    log('saved')
except Exception:
    log('save error\n'+traceback.format_exc())
