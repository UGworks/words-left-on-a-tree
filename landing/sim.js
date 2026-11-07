/* 말을 걸어 두는 나무 — 랜딩용 시뮬레이션
 * 아래 코드는 작품(가시나무에_매달린_말들/index.html)에서 그대로 가져온 것: 문장, 팔레트, 바람, 나무 생성(grow)·흔들림(stepTree),
 * 말 사슬(makeRope·stepRopes), 새 조향(steer), 빈 가지 고르기. 작품과 같은 나무에 같은 말이 걸린다.
 * 맨 위의 몇 줄과 맨 아래 simStep()만 랜딩용으로 새로 쓴 부분이다. */
'use strict';
// ---- 랜딩용: 작품 코드가 기대하는 설정값 (작품의 기본 결정값과 같음)
const sel={set:'guest', font:'myeongjo', text:'vertical', color:'ivory', hl:'spread', winter:'on', amount:'0'};
const S={t:0, lastNew:null, hl:{rope:null,a:0,target:0}, focusA:0};
const REDUCE=matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONTS={ pen:'"Nanum Pen Script"', myeongjo:'"Nanum Myeongjo"', batang:'"Gowun Batang"' };
const FONT_SCALE={ pen:1.32, myeongjo:1, batang:1 };
const CH={ctx:null};                       // 작품의 효과음 자리 (랜딩에서는 소리 없음)
const chimeLetter=()=>{};
const WW=4000, WH=1000, GROUND=968;
const DECK=[];
const AMOUNT=()=>+(sel.amount||'0');
const pool=()=>sel.set==='guest'?GUEST.concat(GUEST_MORE):DECK;
const visibleTarget=()=>AMOUNT()||50;

// ================================================================ 작품에서 가져온 코드
const GUEST=[
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
'보고싶다는 말은 왜 늘 늦게 도착할까'];

const GUEST_MORE=["오늘 처음 본 사람한테도 다정하게 말할 수 있었으면", "지하철에서 자리 양보해준 학생 고마워요 덕분에 하루가 따뜻했어", "엄마 생일 축하해 말로는 못하니까 여기 적어둘게 사랑해", "다음 주 면접 꼭 붙게 해주세요 진짜 열심히 준비했어요", "우리 강아지 13살 생일이에요 오래오래 옆에 있어줘", "친구야 연락 못해서 미안 바빴던 게 아니라 그냥 용기가 없었어", "비 오는 날 우산 씌워준 그 사람 잘 지내나 궁금하다", "퇴사했습니다 무서운데 조금 설레요", "첫 월급으로 부모님 밥 사드렸다 뿌듯하다 ㅎㅎ", "나 혼자 서울 올라온 지 3년째 이제 좀 여기가 집 같아", "할아버지 손 한 번 더 잡아드릴걸", "오늘도 수고했어 나 자신", "선생님 그때 해주신 말 아직도 기억해요 덕분에 여기까지 왔어요", "고양이가 오늘 처음으로 내 무릎에 올라왔다 감동", "동생아 형이 맨날 잔소리해서 미안 다 너 잘되라고 그런거야", "결혼합니다 같이 걸어줄 사람이 생겼어요", "누군가 이 말을 읽는다면 당신도 오늘 하루 잘 버텼어요", "여기 나무 예쁘다 다음엔 너랑 같이 와야지", "시험 끝났다!!!! 결과는 모르겠고 일단 잔다", "보고 싶은 사람이 생겼다는 게 이렇게 좋은 일인 줄 몰랐어", "아빠 그때 화내서 미안해요 사실 아빠 말이 다 맞았어", "매일 같은 길을 걷는데 오늘은 처음 보는 꽃이 피어 있었다", "나를 믿어준 단 한 사람 덕분에 버텼어 고마워 지수야", "이사 가는 날 텅 빈 방에서 한참 앉아 있었다 고마웠어 내 첫 집", "요즘 웃을 일이 많아졌다 이 기분 오래 갔으면", "엄마가 싸준 김밥 먹다가 괜히 울컥했네", "잘 지내? 나는 그럭저럭 잘 지내 너도 그랬으면 좋겠어", "늦었지만 사과하고 싶어 그때 내가 너무 어렸어", "첫눈 오면 전화하기로 한 약속 아직 유효한가요", "우리 팀 다들 고생 많았어요 이번 프로젝트 잊지 못할 거야", "오늘 처음 혼자 영화 봤는데 생각보다 괜찮았다", "할머니 집 앞 감나무 올해도 열렸을까", "하고 싶은 말이 많았는데 막상 쓰려니까 고맙다는 말밖에 안 나오네", "너 덕분에 내가 조금 더 좋은 사람이 된 것 같아", "이번 겨울은 덜 추웠으면 좋겠다 모두에게", "수술 잘 끝났대요 기도해준 모든 분들 감사합니다", "나 이제 커피 끊었다 3일째 ㅋㅋ", "조금 늦어도 괜찮아 꽃은 다 다른 계절에 피니까", "다시 그림 그리기 시작했어 손이 기억하고 있더라", "오늘 버스 기사님이 웃으면서 인사해주셨다 별거 아닌데 좋았어", "멀리 있는 친구들아 다들 밥은 잘 챙겨 먹고 다니지", "그 노래 들으면 아직도 네 생각나", "좋아하는 일을 하면서 사는 게 생각보다 어렵네 그래도 해볼게", "딸아 너는 존재만으로 충분해", "오늘 하늘이 너무 파래서 사진 찍었는데 실물이 더 예뻤다", "주말에 엄마랑 시장 가기로 했다 오랜만이야", "내가 나를 조금 더 아껴주기로 했다", "여기 적으면 이루어진다길래 ㅎㅎ 올해 안에 운전면허 따기", "가끔은 아무 말 없이 옆에 있어주는 게 제일 큰 위로더라", "사랑한다는 말 오늘은 꼭 직접 할게", "은퇴하신 아버지 첫 여행 잘 다녀오세요", "나만 힘든 줄 알았는데 다들 그렇게 사는구나", "꿈에 나와줘서 고마워 할머니 웃고 계셔서 다행이야", "새벽 네 시 편의점 알바 중 오늘따라 달이 크다", "너랑 먹던 떡볶이집 없어졌더라 괜히 서운했어", "이 나무에 걸린 말들 하나하나 다 읽고 간다 다들 행복하세요", "내 동생 대학 합격했어요!!! 고생했다 진짜", "마음이 복잡한 날엔 여기 와서 한참 앉아 있다 가야지", "그동안 연락해줘서 고마웠어 이번엔 내가 먼저 할게", "아무 일도 없는 하루가 사실 제일 고마운 하루였어", "처음 해본 요리가 생각보다 맛있었다 자취 6개월차", "다음 생에도 우리 엄마 딸로 태어나고 싶어", "오래 걸렸지만 이제 나를 용서하기로 했어", "같이 일하는 언니가 오늘 커피 사줬다 소소하게 행복", "떠나간 사람보다 남아준 사람을 더 생각하기로 했다", "작은 가게 문 연 지 1년 찾아와주신 손님들 감사해요", "네가 웃으면 나도 좋아 그게 다야", "산책하다 만난 할머니가 귤 하나 주셨다 따뜻했다", "퇴근하고 오는 길 이 나무 보면서 숨 한 번 쉬고 간다", "우리 반 애들 다들 잘 지내니 선생님은 너희 생각 자주 해", "고마워 그리고 미안해 그리고 많이 보고 싶어", "오늘 처음으로 거절을 했다 생각보다 괜찮았어", "네가 보내준 편지 아직도 서랍에 있어", "결과보다 과정이 더 소중했던 한 해였다", "누군가에게 나도 좋은 기억이었으면 좋겠다", "매일 밤 통화해주는 남자친구 고마워 졸려도 끝까지 들어줘서", "바다 보러 가자던 약속 올해는 지키자", "병원 복도에서 쓴다 엄마 빨리 나아서 같이 집에 가자", "처음 만난 날 기억나? 나는 다 기억나", "오늘따라 바람이 좋다 그냥 그렇다고", "상처 준 말들 다 거둬들일 수 있으면 좋겠다", "천천히 가도 된다는 말 오늘 나한테 해주고 싶었어", "아이가 처음 엄마라고 불렀어요 이 순간 잊고 싶지 않아", "고향 내려가는 기차 안 창밖이 노랗다", "서로 바빠서 못 본 지 한참 됐네 그래도 늘 응원해", "지금 이 순간도 언젠가 그리워지겠지", "가을이 오면 생각나는 사람이 있다", "오늘은 내가 나를 칭찬해주는 날 잘했어", "힘들 때 아무것도 묻지 않고 밥 사준 친구야 고맙다", "할 수 있다 할 수 있다 할 수 있다", "반려식물 몬스테라 새 잎 났다 기특해", "이 말을 남기고 나니까 마음이 조금 가벼워졌어", "누가 뭐래도 너는 너대로 예뻐", "엄마 아빠 결혼 30주년 축하드려요", "오래된 친구랑 밤새 이야기했다 변한 게 하나도 없더라", "비 오는 날의 냄새를 좋아하는 사람 여기 있어요", "마음 놓고 울 수 있는 곳이 있어서 다행이야", "모르는 사람에게 받은 친절을 오늘 다른 사람에게 돌려줬다", "내년 이맘때 이 나무 다시 보러 올게", "이별은 아팠지만 덕분에 나를 더 알게 됐어", "기다려줘서 고마워 이제 거의 다 왔어", "처음 본 바다처럼 매일이 새로웠으면", "밥 먹었냐는 말이 이렇게 따뜻한 말인 줄 몰랐다", "힘내라는 말 대신 같이 있어줄게", "그날 그 골목에서 웃던 우리가 가끔 생각나", "잘하고 있어 생각보다 훨씬", "여기 걸린 말들처럼 내 말도 누군가에게 닿았으면", "나의 오늘이 누군가의 내일에 작은 힘이 되길", "할머니가 해주던 옛날이야기 다시 듣고 싶다", "첫 출근 떨린다 실수해도 괜찮겠지", "손편지 써본 게 언제였더라 오늘 한 장 써봐야지", "너와 나 사이에 아직 할 말이 남아 있어서 다행이야", "조용한 저녁이 좋아지기 시작했다 나이 드나 봐", "오늘 하루도 무사히 끝 다들 푹 자요", "부모님께 전화 한 통 드려야겠다 이거 쓰다가 생각남", "함께여서 버틸 수 있었던 날들에게", "작은 일에 웃는 사람이 되고 싶다", "오래 미뤄둔 고백 오늘 할 거야 응원해줘", "네가 좋아하던 노래 오늘 카페에서 나왔어", "나무야 너는 여기서 많은 말을 듣겠구나 다 잘 간직해줘"];

const PAL={
  ivory:{line:[232,227,212], accent:[164,224,160], text:[242,237,224]},
  mono:{line:[236,236,236], accent:[255,255,255], text:[248,248,248]},
  amber:{line:[214,184,138], accent:[248,214,148], text:[244,224,192]},
  spectrum:{line:[222,226,240], accent:[176,198,255], text:[242,242,250]},
};

const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a<0?0:a})`;

function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const hash=(n)=>{ const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); };

const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const lerp=(a,b,t)=>a+(b-a)*t;

const WIND={gust:0, next:6};
const SWAY=(()=>{ try{ const v=JSON.parse(localStorage.getItem('gsn-sway')||'{}'); return {amp:v.amp??1, spd:v.spd??1, gust:v.gust??1, perch:v.perch??1, hang:v.hang??1}; }catch(e){ return {amp:1,spd:1,gust:1,perch:1,hang:1}; } })();
let WT=0;   // 흔들림 전용 시간: 속도 조절에 따라 빠르게/느리게 흐름
function wind(x,t){
  t=WT;
  return SWAY.amp*(.55*Math.sin(t*.42 - x*.0017) + .3*Math.sin(t*.23 + x*.0009 + 1.3) + .15*Math.sin(t*1.1 - x*.004) + WIND.gust*SWAY.gust*Math.sin(t*.9 - x*.0022));
}

/* ================================================================ 나무 (계층 스프링) */
let CANOPY=x=>0, LIGHTS=[], N=[], tipIdx=[], LINEAGE=[], LEAVES=[], TRUNK_FORKS=[], TRUNK=[], MOBILES=[], SAP=[], LIMBPATHS=[];
// 화면 안 여백 (풀샷에서 아무것도 잘리지 않도록)
const SAFE={top:70, side:150, bottom:938};

function grow(open){
  const rnd=mulberry(23), out=[];
  const CX=WW/2, HALF=WW/2-SAFE.side-60;
  // 수관(樹冠) 윤곽: 가운데가 가장 높고 양끝으로 내려오는 돔
  // 수관 윤곽: 돔 위로 크고 작은 봉우리가 겹쳐 울퉁불퉁하게 (가지 끝 높이가 제각각)
  const lump=x=>62*Math.sin(x*.0046+1.1)+34*Math.sin(x*.0117+.4)+18*Math.sin(x*.026+2.2);
  const topY=x=>{ const u=Math.min(1,Math.abs(x-CX)/HALF); return Math.max(SAFE.top+14, SAFE.top+52+330*Math.pow(u,2.3)+lump(x)*(.45+.55*u)); };
  CANOPY=topY;
  const inside=(x,y)=>Math.abs(x-CX)<HALF && y>topY(x) && y<GROUND-300;
  function add(p, absAng, parentAbs, len, depth, x0, y0, kind){
    const n={p, rel:absAng-parentAbs, len, depth, bend:(rnd()-.5)*(kind==='whip'?.5:.22), a:0, v:0, k:9+depth*3.5, ang:absAng,
      x0, y0, x1:x0+Math.cos(absAng)*len, y1:y0+Math.sin(absAng)*len, cx:0, cy:0, kind, anchor:false};
    const pn=p<0?null:out[p]; n.ft = !pn || kind==='trunk' ? 0 : (pn.kind==='trunk' ? 1 : pn.ft+1);
    out.push(n); return out.length-1;
  }
  // 버드나무 늘어진 가지: 짧은 마디가 아래로 휘며 내려옴
  function whip(p, parentAbs, x, y, side, len){
    let a=Math.PI/2 - side*(.55+rnd()*.35), pi=p, pa=parentAbs, L=len;
    const n=4+Math.floor(rnd()*5);
    for(let k=0;k<n;k++){
      a += (Math.PI/2 + side*.05 - a)*.42;
      const ny=y+Math.sin(a)*L; if(ny>GROUND-330) break;
      const i=add(pi,a,pa,L,7,x,y,'whip'); pi=i; pa=a; x=out[i].x1; y=out[i].y1; L*=.92;
    }
  }
  // 아치형 가지: 바깥·위로 뻗다가 수평으로 눕고 끝에서 처짐 (side: 1 오른쪽, -1 왼쪽)
  function limb(p, ang, parentAbs, len, order, x0, y0, side, segs, bk=1){
    let pi=p, a=ang, pa=parentAbs, x=x0, y=y0, L=len;
    const h = side>0 ? 0 : Math.PI;
    for(let s=0;s<segs;s++){
      const prog=s/Math.max(1,segs-1);
      const d = prog<.5 ? -(.30-.14*open)*(1-prog*2) : (prog-.5)*(.9+.5*(1-open));   // 처음엔 살짝 위, 끝은 처짐
      a += ((h + side*d) - a)*(.085+.06*prog)*(prog<.45?bk:1) + (rnd()-.5)*.05;
      let tries=0, nx=x+Math.cos(a)*L, ny=y+Math.sin(a)*L;
      while(!inside(nx,ny) && tries<7){ a += side*.16; nx=x+Math.cos(a)*L; ny=y+Math.sin(a)*L; tries++; }
      if(!inside(nx,ny)) break;
      const i=add(pi,a,pa,L,Math.min(6.4,order*1.5+s*.19),x,y,'branch'); out[i].bend*=.35;
      if(order>=1 && prog>.15) out[i].anchor=true;
      if(order<4 && s>1 && s<segs-3 && (s%2===0) && rnd()<.78-order*.16){
        const up = rnd()<.55;
        const ba = a + side*(up? -(.42+.3*open) : (.35+.2*open));
        limb(i, ba, a, L*.86, order+1, out[i].x1, out[i].y1, side, Math.max(5, segs-s-2-order*2));
      }
      if(prog>.25 && s%2===1 && rnd()<.62) whip(i, a, out[i].x1, out[i].y1, side, 24+rnd()*22);
      pi=i; pa=a; x=out[i].x1; y=out[i].y1; L*=.975;
    }
    if(pi!==p) whip(pi, pa, x, y, side, 30+rnd()*22);
  }
  // 줄기: 땅에서 꼬이며 올라와 두 갈래로
  // 줄기: 땅에서 S자로 올라가며 좌우로 엇갈려 큰 가지를 냄 (아래 가지일수록 길고 수평, 위로 갈수록 짧고 가파름)
  const TR=[]; let tp=-1, tx=CX, ty=GROUND;
  for(let j=0;j<7;j++){ const a=-Math.PI/2+Math.sin(j*.82-1.7)*.62+.04; const i=add(tp,a,tp<0?-Math.PI/2:out[tp].ang,64,j*.1,tx,ty,'trunk'); out[i].bend=0; TR.push(i); tp=i; tx=out[i].x1; ty=out[i].y1; }
  TRUNK=TR.slice();
  const LIMBS=[[4,-1,-0.30,100,22],[5,1,-0.36,100,22],[5,-1,-0.64,96,21],[6,1,-0.70,96,20],[6,-1,-1.02,90,18],[6,1,-1.06,90,18],[6,-1,-1.38,80,13],[6,1,-1.42,80,13],
    [6,-1,-1.50,70,14,.35],[6,1,-1.52,70,14,.35],[6,-1,-1.56,62,12,.25],[6,1,-1.55,62,12,.25]];   // 가운데를 채우는 곧게 오르는 가지 (마지막 값: 눕는 속도)
  TRUNK_FORKS=[...new Set(LIMBS.map(l=>TR[l[0]]))];
  LIMBS.forEach(([j,side,ar,L,sg,bk])=>{ const n=out[TR[j]]; const a = side>0 ? ar-.08*open : Math.PI-ar+.08*open; limb(TR[j],a,n.ang,L,1,n.x1,n.y1,side,sg,bk); });
  out.forEach(n=>n.leaf=true); out.forEach(n=>{ if(n.p>=0) out[n.p].leaf=false; });
  // 겨울 장식: 가지 마디 몇 곳에 작은 전구와 열매 (과하지 않게 드문드문)
  { const cand=[]; out.forEach((n,i)=>{ if(n.kind==='branch' && n.ft>=2 && n.y1<620 && n.y1>SAFE.top+20) cand.push(i); });
    LIGHTS=[]; const r2=mulberry(77);
    for(let t=0;t<900 && LIGHTS.length<74;t++){ const i=cand[Math.floor(r2()*cand.length)]; if(i===undefined) break;
      if(LIGHTS.some(l=>Math.hypot(out[l.i].x1-out[i].x1,out[l.i].y1-out[i].y1)<70)) continue;
      LIGHTS.push({i, red: r2()<.16, ph:r2()*6.28, sp:.35+r2()*.5, s:.8+r2()*.5}); } }
  // 줄기에서 갈라진 큰 가지마다 첫 몇 마디의 경로 (줄기의 띠가 이 길을 따라 이어 올라감)
  const kids=out.map(()=>[]); out.forEach((n,i)=>{ if(n.p>=0) kids[n.p].push(i); });
  LIMBPATHS=[]; out.forEach((n,i)=>{ if(n.kind!=='branch' || n.p<0 || out[n.p].kind!=='trunk') return;
    const path=[i]; let cur=i;
    for(let k=0;k<5;k++){ const c=kids[cur].filter(q=>out[q].kind==='branch'); if(!c.length) break;
      c.sort((a,b)=>Math.abs(out[a].rel)-Math.abs(out[b].rel)); path.push(c[0]); cur=c[0]; }
    LIMBPATHS.push(path); });
  // 데이터 트리: 뿌리에서의 누적 길이(값), 큰 가지 번호, 수치 라벨, 계보선
  let maxLen=1, lid=0;
  out.forEach((n,i)=>{ const p=n.p<0?null:out[n.p];
    n.plen=(p?p.plen:0)+n.len; maxLen=Math.max(maxLen,n.plen);
    n.limb = !p ? 0 : (p.kind==='trunk' && n.kind!=='trunk' ? ++lid : p.limb); });
  out.forEach((n,i)=>{ n.val=1-n.plen/maxLen; n.label = (n.kind==='branch' && n.ft===4); });
  const leaves=[]; out.forEach((n,i)=>{ if(n.leaf) leaves.push(i); });
  const stepL=Math.max(1,Math.ceil(leaves.length/380));
  LINEAGE=[]; LEAVES=leaves;
  for(let q=0;q<leaves.length;q+=stepL){ const chain=[]; let k=leaves[q]; while(k>=0){ chain.push(k); k=out[k].p; } chain.reverse();
    LINEAGE.push({chain, limb:out[leaves[q]].limb, off:rnd()-.5}); }
  // 칼더식 모빌: 가지 몇 곳에 실로 매단 막대와 원반
  MOBILES=[]; const cand=[]; if(false) out.forEach((n,i)=>{ if(n.kind==='branch' && n.ft>=5 && n.ft<=14 && n.y1<520 && n.y1>160) cand.push(i); });
  for(let tries=0; tries<400 && MOBILES.length<5; tries++){ const i=cand[Math.floor(rnd()*cand.length)]; if(i===undefined) break;
    if(MOBILES.some(m=>Math.abs(out[m.node].x1-out[i].x1)<480)) continue;
    MOBILES.push({node:i, len:95+rnd()*80, arm:70+rnd()*60, phi:0, vphi:0, th:rnd()*6.28, w:(rnd()<.5?-1:1)*(.18+rnd()*.25), sub:rnd()<.6, sth:rnd()*6.28, sw:(rnd()-.5)*.8, r1:11+rnd()*9, r2:7+rnd()*6}); }
  // 수액 빛: 뿌리에서 가지 끝으로 흐르는 작은 점
  SAP=[...Array(80)].map(()=>({g:Math.floor(rnd()*1e6), pos:rnd()*30, sp:.9+rnd()*1.4}));
  N=out; tipIdx=[];
  N.forEach((n,i)=>{ if(n.anchor && n.y1<540 && Math.abs(n.x1-CX)<HALF-40) tipIdx.push(i); });
}
function stepTree(dt,t){
  for(const n of N){
    const p = n.p<0 ? null : N[n.p];
    const bx = p ? p.x1 : WW/2, by = p ? p.y1 : GROUND, pa = p ? p.ang : -Math.PI/2;
    const w = wind(bx,t)*(.0021 + .0019*n.depth) * (REDUCE?.3:1);
    n.v += (-n.k*n.a - 2.2*n.v)*dt; n.a += n.v*dt;
    n.ang = pa + n.rel + n.a + w;
    n.x0=bx; n.y0=by;
    n.x1=bx+Math.cos(n.ang)*n.len; n.y1=by+Math.sin(n.ang)*n.len;
    const mx=(bx+n.x1)/2, my=(by+n.y1)/2, nx=-Math.sin(n.ang), ny=Math.cos(n.ang);
    n.cx=mx+nx*n.bend*n.len; n.cy=my+ny*n.bend*n.len;
  }
}
function kick(i, amt){ let k=i, f=1; while(k>=0 && f>.05){ N[k].v += amt*f; f*=.45; k=N[k].p; } }

let ropes=[];
const LAYER=[{fs:28,a:1},{fs:23,a:.85},{fs:19,a:.62}];
function makeRope(text, node, opts={}){
  const chars=[...text];
  const dense=visibleTarget()>=50, rl=Math.random();
  const r={ text, chars, node, layer: opts.layer ?? (dense ? (rl<.18?0:rl<.5?1:2) : (Math.random()<.4?0:Math.random()<.6?1:2)), pts:[], shown: opts.instant?chars.length:0,
    state: opts.instant?'hang':'typing', alpha:1, seed:Math.random()*1000, born:performance.now()/1000-(opts.instant?Math.random()*600:0), clock:new Date(Date.now()-(opts.instant?Math.random()*5.4e6:0)), fresh: opts.instant?0:1 };
  const a=N[node];
  // 세로 자간: 글자 높이의 1.32배 간격을 지키고, 길면 간격 대신 글자 크기를 줄임
  const GAP=1.32;
  let fs=LAYER[r.layer].fs*FONT_SCALE[sel.font];
  const avail=SAFE.bottom-60-(a.y1+18);
  const SPACE=.5, units=chars.reduce((u,c)=>u+(c===' '?SPACE:1),0);   // 띄어쓰기는 글자 칸의 절반만 차지
  if(units*fs*GAP>avail) fs=avail/(units*GAP);   // 넘치면 간격은 지키고 글자를 줄임
  const step=fs*GAP;
  r.step=step; r.fs=fs; r.seg=chars.map(c=>c===' '?step*SPACE:step);
  let acc=0; for(let i=0;i<=chars.length;i++){ const y=a.y1+14+(opts.instant?acc:0); r.pts.push({x:a.x1,y,px:a.x1,py:y}); if(i<chars.length) acc+=r.seg[i]; }
  ropes.push(r); return r;
}
function stepRopes(dt,t){
  const g=520, damp=.985;
  for(const r of ropes){
    const a=N[r.node];
    if(r.state==='typing'){ const before=Math.ceil(r.shown); r.shown=Math.min(r.chars.length, r.shown+dt*5); const after=Math.ceil(r.shown);
      for(let q=before;q<after;q++){ (r.ct||(r.ct=[]))[q]=S.t; if(CH.ctx && r===S.lastNew && r.chars[q] && r.chars[q].trim()) chimeLetter(); } if(r.shown>=r.chars.length) r.state='hang'; }
    r.fresh=Math.max(0,r.fresh-dt*.12);
    const n=Math.ceil(r.shown);
    const pin=r.state!=='falling';
    if(pin){ r.pts[0].x=a.x1; r.pts[0].y=a.y1+14; r.pts[0].px=r.pts[0].x; r.pts[0].py=r.pts[0].y; }
    else { r.alpha-=dt*.32; }
    const start=pin?1:0;
    for(let i=start;i<=n && i<r.pts.length;i++){
      const p=r.pts[i]; const vx=(p.x-p.px)*damp, vy=(p.y-p.py)*damp; p.px=p.x; p.py=p.y;
      const w=wind(p.x,t)*(28+i*1.6)*(REDUCE?.3:1);
      p.x+=vx + w*dt*dt; p.y+=vy + (r.state==='falling'?g*.35:g)*dt*dt;
    }
    for(let it=0;it<(pin?22:4);it++){
      for(let i=1;i<=n && i<r.pts.length;i++){
        const p0=r.pts[i-1], p1=r.pts[i]; const dx=p1.x-p0.x, dy=p1.y-p0.y, d=Math.hypot(dx,dy)||1e-4, diff=(d-r.seg[i-1])/d;
        if(i===1&&pin){ p1.x-=dx*diff; p1.y-=dy*diff; } else { p0.x+=dx*diff*.5; p0.y+=dy*diff*.5; p1.x-=dx*diff*.5; p1.y-=dy*diff*.5; }
      }
    }
    // 아직 나오지 않은 글자는 마지막 글자 자리에서 대기 (타이핑하며 아래로 펼쳐짐)
    for(let i=n+1;i<r.pts.length;i++){ const q=r.pts[Math.min(n,r.pts.length-1)]; r.pts[i].x=r.pts[i].px=q.x; r.pts[i].y=r.pts[i].py=q.y; }
  }
  ropes=ropes.filter(r=>r.alpha>0);
}

function newBird(x,y,alpha=0){ return {x,y,vx:0,vy:0,ang:Math.random()*6.28,mode:'fly',node:-1,until:0,phase:Math.random()*6,alpha,courier:null,seed:Math.random()*100,heading:0,leave:false}; }

function steer(b,tx,ty,maxSp,maxAcc,dt,arrive){
  const dx=tx-b.x, dy=ty-b.y, d=Math.hypot(dx,dy)||1e-3;
  let sp=maxSp; if(arrive && d<arrive) sp=maxSp*Math.max(.03,d/arrive);
  const dvx=dx/d*sp-b.vx, dvy=dy/d*sp-b.vy, dl=Math.hypot(dvx,dvy)||1e-3, acc=Math.min(dl,maxAcc*dt);
  b.vx+=dvx/dl*acc; b.vy+=dvy/dl*acc; b.x+=b.vx*dt; b.y+=b.vy*dt; return d;
}

function usedNodes(){ return new Set(ropes.filter(r=>r.state!=='falling').map(r=>r.node)); }
function roomFor(i,len){ return (SAFE.bottom-60-(N[i].y1+18)) >= len*LAYER[1].fs*FONT_SCALE[sel.font]*1.32*.8; }
function freeTip(len=30){
  const used=usedNodes(); const xs=ropes.filter(r=>r.state!=='falling').map(r=>N[r.node].x1);
  const sep=Math.min(140, 3300/visibleTarget()*.78);   // 많이 걸수록 간격을 좁힘
  const ok=i=>!used.has(i) && xs.every(x=>Math.abs(x-N[i].x1)>sep);
  let list=tipIdx.filter(i=>ok(i) && roomFor(i,len));
  if(!list.length) list=tipIdx.filter(ok).sort((a,b)=>N[a].y1-N[b].y1).slice(0,6);
  if(!list.length) list=tipIdx.filter(i=>!used.has(i));
  return list[Math.floor(Math.random()*list.length)];
}
function unusedText(){ const shown=new Set(ropes.filter(r=>r.state!=='falling').map(r=>r.text)); const c=pool().filter(s=>!shown.has(s)); const L=c.length?c:pool(); return L[Math.floor(Math.random()*L.length)]; }
function seedRopes(){
  ropes=[]; const k=visibleTarget();
  for(let i=0;i<k;i++){ const t=unusedText(); const n=freeTip([...t].length); if(n===undefined) break; makeRope(t, n, {instant:true}); }
}

// ================================================================ 랜딩용: 한 프레임 진행
let birds=[...Array(16)].map(()=>newBird(Math.random()*WW, 110+Math.random()*240, 1));
function stepBirds(dt){
  for(let i=0;i<birds.length;i++){ const b=birds[i];
    b.ang+=dt*(.05+.02*(i%4));
    const ahead=b.ang+.35, R=1500;
    const tx=WW/2+Math.cos(ahead+i)*R+Math.sin(S.t*.11+b.seed)*180;
    const ty=200+Math.sin(ahead*1.7+b.seed)*95+Math.sin(S.t*.27+b.seed)*30;
    steer(b,tx,ty,150,60,dt,0);
    const target=Math.atan2(b.vy,b.vx); let d=target-b.heading; d=Math.atan2(Math.sin(d),Math.cos(d)); if(Math.hypot(b.vx,b.vy)>8) b.heading+=d*Math.min(1,dt*2.5);
    b.phase+=dt*(5.2+Math.hypot(b.vx,b.vy)*.01);
  }
}
function simStep(dt){
  dt=Math.min(.033,dt); S.t+=dt; WT+=dt*SWAY.spd;
  WIND.next-=dt; if(WIND.next<0){ WIND.next=16+Math.random()*14; WIND.gustT=0; }
  WIND.gustT=(WIND.gustT??9)+dt; WIND.gust=Math.max(0,Math.sin(Math.min(1,WIND.gustT/5)*Math.PI))*.9;
  stepTree(dt,S.t); stepRopes(dt,S.t); stepBirds(dt);
}
// 랜딩에서 한마디 걸기: 빈 가지에 한 글자씩 내려옴
function hangWord(text){
  text=(text||'').trim(); if(!text) return null;
  const live=ropes.filter(r=>r.state==='hang');
  if(live.length>=visibleTarget()){ const r=live.sort((a,b)=>a.born-b.born)[0]; r.state='falling'; }
  const node=freeTip([...text].length); if(node===undefined) return null;
  const r=makeRope(text,node,{layer:0}); S.lastNew=r; kick(node,.7); return r;
}
grow(.5); stepTree(0,0);
