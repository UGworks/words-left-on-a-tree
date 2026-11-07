#!/bin/bash
# 관객 감지 서버 실행. 예) ./start_vision.command --backend sam2 --camera 1 --show
cd "$(dirname "$0")" || exit 1
[ -x .venv/bin/python ] || { echo "먼저 setup_vision.command를 실행해 주세요."; exit 1; }
exec .venv/bin/python vision_server.py "$@"
