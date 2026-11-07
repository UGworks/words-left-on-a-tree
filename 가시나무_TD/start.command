#!/bin/bash
# 가시나무에 매달린 말들 — TouchDesigner로 열기 (더블클릭)
cd "$(dirname "$0")" || exit 1
open -a TouchDesigner "$(pwd)/가시나무.toe"
