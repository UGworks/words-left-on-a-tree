#!/bin/bash
# 관객 감지 서버 설치 (처음 한 번). 인터넷 연결 필요, 10분 정도 걸릴 수 있음.
cd "$(dirname "$0")" || exit 1
PY=$(command -v python3.12 || command -v python3.11 || command -v python3.10 || command -v python3)
echo "파이썬: $PY ($($PY --version))"
$PY -m venv .venv || { echo "가상환경을 만들지 못했습니다. python.org에서 Python 3.11 이상을 설치해 주세요."; exit 1; }
.venv/bin/pip install --upgrade pip
.venv/bin/pip install torch torchvision "transformers>=4.57" accelerate opencv-python websockets ultralytics huggingface_hub
echo
echo "SAM 3를 쓰려면 Hugging Face에서 facebook/sam3 모델 접근 승인을 받은 뒤 로그인하세요."
echo "  https://huggingface.co/facebook/sam3  (페이지에서 접근 요청)"
read -p "지금 Hugging Face에 로그인할까요? (y/N) " yn
if [ "$yn" = "y" ]; then .venv/bin/hf auth login; fi
echo
echo "설치 완료. 카메라 번호 확인:"
.venv/bin/python vision_server.py --list
echo "점검 창과 함께 실행해 보려면: ./start_vision.command --show"
