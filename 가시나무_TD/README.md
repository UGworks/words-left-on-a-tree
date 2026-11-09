# 가시나무에 매달린 말들 — TouchDesigner 버전

`board.html`(가시나무 시안 보드)을 TouchDesigner 2025 네트워크로 다시 만든 것입니다.
기본 결정값(데이터 트리 · 방명록 15 · 명조 · 처음부터 글자 · 아이보리 · 가로로 펼침 · 대기 카메라웍 · 디졸브)을 그대로 따릅니다.

## 여는 법
- **실행**: `start.command`를 더블클릭하면 TouchDesigner가 `가시나무.toe`를 엽니다(TouchDesigner 자체가 실행 프로그램).
  처음 한 번 macOS가 막으면 우클릭 › 열기.
- **화면 보기**: `/project1/gasinamu` 안의 `preview` 노드(오른쪽 아래 큰 노드)가 출력 모니터링 화면입니다.
  프로젝터로 보낼 때는 `window` 노드의 Open, 또는 F1(퍼폼 모드)로 출력만 전체 화면.
- **다른 프로젝트에 넣기**: `gasinamu.tox`를 네트워크에 끌어다 놓기. 이 폴더의 `gsn_sim.py`, `gsn_td.py`를 읽으므로 폴더째 함께 두세요.
- **다시 만들기**: Textport(Dialogs › Textport and DATs)에서
  ```
  import glob, os; exec(open(glob.glob(os.path.expanduser('~/Desktop/*/*/*_TD/build_gasinamu.py'))[0], encoding='utf-8').read())
  ```
- `가시나무.숫자.toe`는 TouchDesigner가 저장할 때 남기는 이전 버전 백업입니다.

## 구조
| 원본 (Canvas2D/WebGL) | TouchDesigner |
|---|---|
| 나무 스프링·글자 사슬 verlet·새 조향·대기 카메라웍 | `gsn_sim.py` (numpy, 매 프레임 `engine` Execute DAT가 실행) |
| 선(가지·계보선·뿌리·새·콜아웃) | `chop_segs` Script CHOP → `geo_segs` 사각형 인스턴싱 (선분마다 위치·각도·길이·폭·색) |
| 점·빛무리 | `geo_dots`(원), `geo_glows`(방사형 텍스처) 인스턴싱 |
| 글자 | 글자마다 Text TOP(`glyphs/`) → `geo_glyphs0~3` 텍스처 배열 인스턴싱 (배열 한도 256장이라 250장씩 나눔) |
| 배경 파티클 3.7만 개 | `ptc_seed` → `ptc_fb` → `ptc_update`(GLSL, 원본 셰이더 이식) → `ptc_xform`/`ptc_col` → `geo_ptc` 가산 합성 |
| 카메라 줌·이동 | `cam` 정사영 카메라 |
| 비네트·디졸브 | `vignette`(GLSL) · `snap`(Cache) · `dissolve`(Cross) |
| WebAudio 분석기 | `music`(Audio File In) → numpy 2048 FFT·블랙만 창·0.55 평활 → 원본과 같은 대역별 자동 레벨·킥 감지 |
| 감지 서버 웹소켓 | `vision_ws` WebSocket DAT (ws://127.0.0.1:8770, `vision_server.py`가 켜져 있으면 자동 연결) |

## 조작 (gasinamu COMP 파라미터)
- **작품**: 음악 재생·볼륨·음악 반응, 남길 말 + 걸기, 가상 관객 수·접근(감지 없을 때), 나무 상태, 문장/빛의 색/강조/장면 전환, 감지 좌우 반전·거리 기준, 문장 다시 걸기
- **파티클**: board의 파티클 설정과 같은 항목

## 알아둘 점
- **해상도**: Non-Commercial 라이선스는 1280×1280이 한도라 1280×320으로 렌더합니다. 상업/교육 라이선스면 다시 만들 때 3840×960(기준)으로 렌더합니다.
- **글꼴**: 나눔명조가 설치돼 있지 않아 macOS 기본 AppleMyungjo를 씁니다. 나눔명조를 설치하면 `gsn_td.py`의 `SERIF_FONT`를 그 파일로 바꾸세요.
- **프레임**: Python 시뮬레이션 때문에 이 Mac에서 약 50fps입니다(목표 60).
- **카메라**: TD 버전은 카메라를 직접 열지 않습니다. 사람 정보는 감지 서버(`vision_server.py`)에서만 받고, 없으면 가상 관객 파라미터로 동작합니다.
- **아직 옮기지 않은 것**: 나무 형태 B·C, 손글씨/고운바탕, 줄기 리본의 반투명 면(가장자리 선만 그림), 강조 문장의 글로우.
- `td_cmd.py` / `td_log.txt`: 개발용 브리지. `td_cmd.py`를 저장하면 TD가 실행하고 결과를 `td_log.txt`에 남깁니다.
