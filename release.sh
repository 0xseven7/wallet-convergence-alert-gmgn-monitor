#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

VERSION=$(grep -oP '"version"\s*:\s*"\K[^"]+' manifest.json)
[ -z "$VERSION" ] && { echo "[ERR] 无法解析版本号"; exit 1; }

mkdir -p dist
OUT="dist/xxyy-convergence-alert-v${VERSION}.zip"
rm -f "$OUT"

echo "[INFO] 打包 v${VERSION} -> $OUT"

# 优先用 7z（自带不依赖 zip 命令），没装就走 PowerShell
if command -v 7z >/dev/null 2>&1; then
  7z a -tzip "$OUT" manifest.json content.js network-hook.js styles.css icons/ >/dev/null
elif command -v zip >/dev/null 2>&1; then
  zip -r "$OUT" manifest.json content.js network-hook.js styles.css icons/ >/dev/null
else
  powershell.exe -NoProfile -Command "Compress-Archive -Path 'manifest.json','content.js','network-hook.js','styles.css','icons' -DestinationPath '$OUT' -Force"
fi

SIZE=$(stat -c %s "$OUT" 2>/dev/null || stat -f %z "$OUT" 2>/dev/null || echo "?")
echo "[OK] 完成: $OUT ($SIZE bytes)"
echo
echo "上传到 GitHub Release:"
echo "  gh release create v${VERSION} \"$OUT\" --title \"v${VERSION}\" --notes \"见 README\""
