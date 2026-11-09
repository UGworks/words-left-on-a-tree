# GPT 핸드오프 · 웹 링크 만들기

〈말을 걸어 두는 나무〉 작품 사이트를 **누구나 열 수 있는 HTTPS 주소 하나**로 배포하기 위한 문서다.
GPT에게 이 파일과 업로드용 zip을 함께 주고 아래 "붙여넣을 요청"을 그대로 보내면 된다.

- 업로드용 zip: `deploy/words-left-on-a-tree_web.zip` (약 15MB, 48개 파일, 저장소에 커밋된 파일만)
- 다시 만들 때: 저장소 폴더에서 `git archive --format=zip -o deploy/words-left-on-a-tree_web.zip HEAD -- . ':(exclude).claude' ':(exclude)가시나무_TD'`
- 저장소 전체 상태와 규칙은 `HANDOFF.md`에 있다.

---

## 붙여넣을 요청

```
첨부한 zip은 빌드 과정이 없는 정적 웹사이트야(HTML·CSS·JS, 이미지, mp3/mp4).
압축을 푼 폴더를 그대로 정적 호스팅에 올려서 HTTPS 공개 주소를 하나 만들어 줘.
자세한 조건은 같이 첨부한 HANDOFF_GPT.md를 따라 줘.

1. 네가 직접 배포할 수 있으면(GitHub·Netlify·Cloudflare 연결이 있으면) 배포하고 주소를 알려 줘.
2. 직접 못 하면, 내가 그대로 따라 할 수 있게 클릭 단위로 안내해 줘. 1순위는 Netlify Drop, 2순위는 Cloudflare Pages.
   검색·수집을 막아야 해서 _headers와 robots.txt가 먹히는 곳이어야 해. GitHub Pages는 쓰지 마.
3. 파일 내용은 고치지 말고, 빌드 도구나 프레임워크로 바꾸지 마. 서버(WebSocket 포함)도 만들지 마.
4. 배포가 끝나면 HANDOFF_GPT.md의 "배포 후 확인" 목록대로 확인한 결과를 알려 줘.
```

---

## 1. 무엇을 올리나

zip을 풀면 이 구조다. **압축을 푼 폴더 자체가 사이트 루트**다(그 안에 폴더를 한 겹 더 만들지 않는다).

```
index.html                      루트 → landing/ 으로 바로 넘김
landing/                        첫 화면: 3D 나무 오프닝
site/                           작업 소개 (img/, css/, js/)
가시나무에_매달린_말들/           작품 본체 (index.html, wish.mp3, winter.mp3)
FeedbackNoise/                  첫 실험 Granite Resonance
previz/opening/                 오프닝 프리비즈
video/                          FeedbackNoise 대체 영상 (mp4)
board.html, README.md, HANDOFF.md, .gitignore
robots.txt                      모든 크롤러·AI 수집기 거부 (Disallow: /)
_headers                        Netlify·Cloudflare: 모든 파일에 X-Robots-Tag: noindex 헤더
```

- 진입점은 루트 `index.html`. 공유할 주소는 사이트 루트 하나면 된다.
- 모든 링크는 상대 경로라 하위 경로(`/<저장소이름>/`)에 올려도 동작한다.
- 한글 폴더명 `가시나무에_매달린_말들`은 링크가 그 이름을 그대로 가리킨다. **이름을 바꾸지 않는다.** zip 안의 경로는 UTF-8(NFC)로 저장돼 있어 Linux 호스트에서도 맞는다.
- `*.command`, `vision/` 폴더는 전시 컴퓨터용 실행 파일이다. 웹에서는 쓰이지 않지만 함께 올려도 무해하다.

## 2. 배포 방법 (택 1)

### A. Netlify Drop (가장 빠름, 계정만 있으면 1분)
1. https://app.netlify.com/drop 접속, 로그인
2. 압축을 푼 **폴더**를 페이지에 끌어다 놓기
3. 나온 주소(`https://<임의이름>.netlify.app`)가 공개 링크. Site configuration → Change site name으로 `words-left-on-a-tree` 같은 이름으로 바꿀 수 있다.
4. 수정본을 올릴 때: Deploys 탭에 새 폴더를 다시 끌어다 놓기

### B. GitHub Pages (권장하지 않음: 아래 7번 검색·수집 거부가 반만 적용됨)
1. GitHub 계정 `UGworks`에 새 공개 저장소 만들기 (예: `words-left-on-a-tree`)
2. 압축을 푼 파일 전부를 저장소 루트에 업로드(Add file → Upload files, 또는 git push)
3. Settings → Pages → Source: Deploy from a branch → Branch `main`, 폴더 `/ (root)` → Save
4. 1~2분 뒤 주소: `https://ugworks.github.io/words-left-on-a-tree/`

### C. Cloudflare Pages (Netlify 대신 쓸 때)
Workers & Pages → Create → Pages → Upload assets → 폴더 업로드. 빌드 명령 없음, 출력 폴더는 루트. `_headers`가 그대로 적용된다.

어느 쪽이든 **빌드 명령은 비워 두고, 출력(publish) 폴더는 루트**다.

## 3. 하지 말 것

- 파일 내용 수정, 번들러·프레임워크(React, Vite, Next 등)로 변환, 파일·폴더 이름 변경
- 서버나 WebSocket 백엔드 만들기 (아래 4번 참고)
- 분석·추적 스크립트, 광고, 쿠키 배너 추가
- 발표 자료(`*.pptx`)나 원본 오디오(`*.wav`)를 구해서 올리기: 개인 정보가 있거나 용량이 커서 일부러 뺀 것이다
- 공개 화면에 개인 정보 넣기 (학번, 이메일·전화 같은 연락처, 다른 사람의 이름, 컴퓨터 폴더 경로)
- `robots.txt`, `_headers`, 각 페이지의 `<meta name="robots" content="noindex, ...">` 지우기. 사이트맵 만들기, 검색엔진(Google Search Console 등)에 등록하기

## 4. 카메라와 WebSocket에 대해

- 작품은 관객을 두 가지로 읽는다. 1순위는 **전시 컴퓨터 안에서만** 도는 감지 서버(`vision/vision_server.py`, SAM 3 → SAM 2)가 `ws://127.0.0.1:8770`으로 보내는 사람 목록이다. 코드가 localhost에서만 이 연결을 시도한다.
- 웹 주소에서는 자동으로 2순위(브라우저 카메라의 움직임을 사람 단위로 나눈 근사값)로 돈다. 브라우저 카메라는 HTTPS에서만 열리므로 위 호스팅은 모두 조건을 만족한다.
- 그러니 **링크를 만드는 데에 서버는 필요 없다.** 서버가 필요한 건 "여러 관객의 말을 한 나무에 함께 걸어 모두가 보게" 하는 기능을 새로 만들 때뿐이고, 이번 작업 범위가 아니다.

## 5. 배포 후 확인

주소를 `<URL>`이라 할 때:

| 확인 | 기대 결과 |
|---|---|
| `<URL>/` | 바로 `<URL>/landing/`으로 넘어감 |
| `<URL>/landing/` | 검은 화면에서 아스키 나무 오프닝이 시작되고 약 13초 뒤 제목 「말을 걸어 두는 나무」와 버튼 두 개 |
| 랜딩의 「작업 소개」 | `<URL>/site/` 열림, 미색 바탕에 아스키 새가 날아감, 글꼴은 명조(Noto Serif KR) |
| 소개의 04 · 설치 | 검은 배치도에서 사람 점이 다가오고 새가 내려앉는 반복 애니메이션 |
| 「작품 열기 ↗」 | 새 탭에서 `<URL>/가시나무에_매달린_말들/index.html` 열림, 나무와 걸린 말이 보임, 카메라 권한을 물음 |
| 이름·프로필 이미지 클릭 | 랜딩 오프닝 첫 장면으로 |
| 브라우저 탭 아이콘 | 깃허브 프로필 일러스트 |
| `<URL>/robots.txt` | `User-agent: *` 아래 `Disallow: /` |
| 응답 헤더 (`curl -I <URL>/landing/`) | `x-robots-tag: noindex, nofollow, noarchive, nosnippet, noimageindex` |
| 개발자 도구 콘솔 | 404 없음. 단, 작품 설정에서 곡을 Saltwater Silence로 고르면 `saltwater.mp3`와 대체 wav 경로가 404로 나오는데, 알려진 누락이다 |

## 6. 알려진 사항

- 작품의 세 번째 곡(Saltwater Silence)은 원본 wav만 로컬에 있고 업로드 묶음에는 없다. 나머지 두 곡(wish.mp3, winter.mp3)은 들어 있다. 필요하면 mp3로 변환해 `가시나무에_매달린_말들/saltwater.mp3`로 넣고 다시 배포한다.
- 공유 미리보기 이미지(`og:image`)는 아직 없다. 메신저에 링크를 붙이면 제목과 설명만 나온다.
- 웹폰트는 Google Fonts에서 받는다. 차단된 네트워크에서는 기본 명조로 보인다.

## 7. 검색·수집 거부

작가가 이 사이트가 **검색에 나오지 않고 외부에서 긁어 가지 않기를** 원한다. 링크를 받은 사람만 보는 사이트다.

- 각 페이지 `<head>`의 `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">`
- 루트 `robots.txt`: 모든 크롤러와 이름을 밝힌 AI 수집기(GPTBot, ClaudeBot, Google-Extended, CCBot, PerplexityBot 등) 거부
- 루트 `_headers`: Netlify·Cloudflare Pages에서 모든 파일(이미지·mp3 포함)에 `X-Robots-Tag` 헤더
- 작품 본체 `가시나무에_매달린_말들/index.html`은 손대지 않는 파일이라 meta 태그가 없다. 그래서 헤더를 붙일 수 있는 Netlify·Cloudflare가 필요하다.
- GitHub Pages의 프로젝트 사이트(`ugworks.github.io/<저장소>/`)는 `_headers`를 무시하고, `robots.txt`도 도메인 루트(`ugworks.github.io/robots.txt`)에 있어야만 읽혀서 이 저장소의 것은 효과가 없다.
- 이것들은 규칙을 지키는 검색엔진과 수집기에 대한 거부 표시다. 규칙을 무시하는 수집기까지 막으려면 접근 제한(Cloudflare Access 이메일 인증, Netlify 비밀번호 보호 등)이 따로 필요하다. 이번 범위는 아니고, 필요하면 작가에게 먼저 물어본다.

## 8. GPT가 돌려줄 것

1. 공개 주소 (HTTPS)
2. 사용한 호스팅과 계정/사이트 이름
3. 5번 확인 결과 (항목별 통과·실패)
4. 다음에 수정본을 올리는 방법 한두 줄
