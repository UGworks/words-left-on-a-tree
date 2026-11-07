#!/bin/bash
# 가시나무에 매달린 말들 — 실행 (macOS)
# 더블클릭: 창 모드 / ./start.command kiosk : 전시용 전체화면 + 음악 자동 재생
cd "$(dirname "$0")/.." || exit 1
PORT=8766
URL="http://localhost:$PORT/가시나무에_매달린_말들/index.html"
SERVER_PID=""
if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  if command -v python3 >/dev/null 2>&1 && python3 -c "pass" >/dev/null 2>&1; then
    python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
  else
    ruby -run -e httpd . -p $PORT -b 127.0.0.1 >/dev/null 2>&1 &
  fi
  SERVER_PID=$!; sleep 1
fi
# 관객 감지 서버(SAM 3/SAM 2)가 설치돼 있으면 함께 실행
VISION_PID=""
VDIR="가시나무에_매달린_말들/vision"
if [ -x "$VDIR/.venv/bin/python" ] && ! lsof -iTCP:8770 -sTCP:LISTEN >/dev/null 2>&1; then
  (cd "$VDIR" && .venv/bin/python vision_server.py >> vision.log 2>&1) &
  VISION_PID=$!
fi
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then
  FLAGS=(--user-data-dir="$HOME/.gasinamu-chrome" --no-first-run --autoplay-policy=no-user-gesture-required)
  if [ "$1" = "kiosk" ]; then "$CHROME" "${FLAGS[@]}" --kiosk "$URL?autostart"; else "$CHROME" "${FLAGS[@]}" --app="$URL"; fi
else
  open "$URL"; echo "창을 닫은 뒤 Ctrl+C로 종료하세요."; wait
fi
[ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null
[ -n "$VISION_PID" ] && kill $VISION_PID 2>/dev/null
