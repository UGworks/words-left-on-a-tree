# 이성훈 · 미디어아트

첨단영상대학원 예술공학 이성훈의 인터랙티브 미디어아트 작업과 소개 사이트를 모은 저장소입니다.

| 작품 | 연도 | 폴더 | 실행 |
|---|---|---|---|
| **말을 걸어 두는 나무** · Words Left on a Tree | 2026 | [`가시나무에_매달린_말들/`](가시나무에_매달린_말들/) | `start.command` (전시용 `start_kiosk.command`) |
| 말을 걸어 두는 나무 · TouchDesigner 버전 | 2026 | [`가시나무_TD/`](가시나무_TD/) | `start.command` → `가시나무.toe` |
| **Granite Resonance** · FeedbackNoise (첫 실험) | 2026 | [`FeedbackNoise/`](FeedbackNoise/) | `start.command` |
| 소개 사이트 (랜딩페이지) | 2026 | [`site/`](site/) | 아래 "사이트 보기" |

## 폴더 구조

```
.
├─ site/                         소개 랜딩페이지 (HTML · CSS · JS, 빌드 과정 없음)
│  ├─ index.html
│  ├─ css/style.css
│  ├─ js/hands.js                히어로: 두 손을 LED 하프톤으로 그리는 캔버스
│  ├─ js/main.js                 스크롤하면 섹션이 드러나는 효과
│  └─ img/                       작품 스틸 (작품을 실제로 실행해 캡처)
├─ 가시나무에_매달린_말들/         말을 걸어 두는 나무 (브라우저 작품)
│  ├─ index.html                 작품 본체 (Canvas 2D · WebGL2 · Web Audio)
│  ├─ opening3d.js               3D 오프닝: 뿌리에서 오빗하며 줌아웃 (아스키 → 원래 화면)
│  ├─ wish.mp3 · winter.mp3      음악
│  └─ vision/                    관객 감지 서버 (SAM 3 → SAM 2, WebSocket 8770)
├─ 가시나무_TD/                   같은 작품의 TouchDesigner 네이티브 버전
├─ FeedbackNoise/                Granite Resonance (오디오 반응 피드백·입자)
├─ previz/opening/               오프닝 카메라웍 단독 프리비즈 (프레임 단위 렌더, 영상 추출용)
├─ video/                        FeedbackNoise의 대체 영상
└─ board.html                    시안 보드 (3D 오프닝을 붙이기 전의 작품 index.html)
```

## 3D 오프닝

작품(`가시나무에_매달린_말들/index.html`)을 열면 약 15초 동안 3D 오프닝이 먼저 재생됩니다.
뿌리와 줄기 클로즈업에서 시작해 나무를 오빗으로 훑으며 줌아웃하고, 그동안 장면은 아스키로, 걸린 말은 실제 글자로 그립니다.
정면 풀샷에 닿으면 글자 칸이 줄 단위로 흩어지며 원래 화면으로 넘어가고, 이후에는 원래 작품 그대로 돌아갑니다.

- 작품의 시뮬레이션(나무, 말, 새, 전구)을 그대로 읽어 그리므로 나무 모양과 걸린 말이 실제 작품과 같습니다.
- 끄기: 주소 뒤에 `?noopening` (예: `index.html?autostart&noopening`)
- 다시 보기: 화면 아래 '오프닝 다시' 버튼

## 사이트 보기

저장소 루트에서 로컬 서버를 띄우고 `/site/`를 엽니다. 작품 실행 링크(`../가시나무에_매달린_말들/` 등)가 저장소 안의 작품으로 이어지므로 루트에서 띄워야 합니다.

```bash
python3 -m http.server 8790
```

브라우저에서 http://127.0.0.1:8790/site/ 를 엽니다. Claude 데스크톱 앱에서는 `.claude/launch.json`의 `site` 미리보기가 이 주소에 연결됩니다.

히어로의 손 이미지는 외부 주소(images.higgs.ai)에서 불러옵니다. 인터넷 연결이 없으면 히어로 배경 없이 문구만 보입니다.

## 저장소에 넣지 않은 것

`.gitignore` 참고. 원본은 이 컴퓨터의 같은 폴더에 그대로 있습니다.

- 대용량 원본: `*.wav`, `*.flac`, `*.mp4`(단 `video/` 데모 제외), 루트의 중복 mp3
- 발표 자료 `*.pptx`: 표지에 학번 등 개인 정보가 있음
- 감지 서버 가상환경 `vision/.venv`(약 800MB): `vision/setup_vision.command`로 다시 만듦
- TouchDesigner 자동 백업과 개발용 파일
- `지은박사_TEST/`: 다른 작업의 테스트

## 다음 단계

- GitHub에 연결: 원격 저장소를 만든 뒤 `git remote add origin <주소>` → `git push -u origin main`
- GitHub Pages로 공개할 때는 저장소 루트를 배포하고 `/site/`로 들어가거나, 루트에 `/site/`로 보내는 `index.html`을 둡니다.
