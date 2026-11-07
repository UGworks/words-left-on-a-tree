#!/bin/bash
# Granite Resonance — 실행 스크립트 (macOS)
# 더블클릭: 창 모드로 실행 / 터미널에서 ./start.command kiosk : 전시용 전체화면(키오스크) 실행
cd "$(dirname "$0")/.." || exit 1
PORT=8765
URL="http://localhost:$PORT/FeedbackNoise/index.html"
SERVER_PID=""

if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  if command -v python3 >/dev/null 2>&1 && python3 -c "pass" >/dev/null 2>&1; then
    python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
  elif command -v ruby >/dev/null 2>&1; then
    ruby -run -e httpd . -p $PORT -b 127.0.0.1 >/dev/null 2>&1 &
  else
    echo "python3 또는 ruby가 없어 로컬 서버를 열 수 없습니다. index.html을 Chrome으로 직접 여세요(목록 자동 검색은 비활성)."
    open -a "Google Chrome" "FeedbackNoise/index.html" 2>/dev/null || open "FeedbackNoise/index.html"
    exit 0
  fi
  SERVER_PID=$!
  sleep 1
fi

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then
  FLAGS=(--user-data-dir="$HOME/.granite-resonance-chrome" --no-first-run --autoplay-policy=no-user-gesture-required)
  if [ "$1" = "kiosk" ]; then
    "$CHROME" "${FLAGS[@]}" --kiosk "$URL?autostart"
  else
    "$CHROME" "${FLAGS[@]}" --app="$URL"
  fi
else
  open "$URL"
  echo "Chrome이 없어 기본 브라우저로 열었습니다. 창을 닫은 뒤 이 터미널에서 Ctrl+C로 종료하세요."
  wait
fi

[ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null
