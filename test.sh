#!/bin/sh
# 계산 로직 테스트 (macOS 내장 JavaScriptCore 사용, node가 있으면 node 사용)
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then exec node tests/calc.test.js; fi
exec /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/calc.test.js -- assets/calc.js
