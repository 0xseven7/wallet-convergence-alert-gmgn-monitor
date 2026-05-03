#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

VERSION=$(grep -oP '"version"\s*:\s*"\K[^"]+' manifest.json)
[ -z "$VERSION" ] && { echo "[ERR] 无法解析版本号"; exit 1; }

mkdir -p dist
OUT="dist/wallet-convergence-alert-v${VERSION}.zip"
rm -f "$OUT"

echo "[INFO] 打包 v${VERSION} -> $OUT"

ITEMS=(manifest.json icons xxyy gmgn)

if command -v 7z >/dev/null 2>&1; then
  7z a -tzip "$OUT" "${ITEMS[@]}" >/dev/null
elif command -v zip >/dev/null 2>&1; then
  zip -r "$OUT" "${ITEMS[@]}" >/dev/null
else
  powershell.exe -NoProfile -Command "Compress-Archive -Path 'manifest.json','icons','xxyy','gmgn' -DestinationPath '$OUT' -Force"
fi

SIZE=$(stat -c %s "$OUT" 2>/dev/null || stat -f %z "$OUT" 2>/dev/null || echo "?")
echo "[OK] 完成: $OUT ($SIZE bytes)"

# 自动生成发布用的 release notes（含本版本说明 + 通用使用教程）
NOTES_FILE="dist/RELEASE_NOTES_v${VERSION}.md"
{
  if [ -f CHANGELOG_NEXT.md ]; then
    cat CHANGELOG_NEXT.md
    echo
    echo "---"
    echo
  fi
  echo "# 📖 使用教程"
  echo
  cat USAGE.md
} > "$NOTES_FILE"

echo
echo "下一步发布命令："
echo "  gh release create v${VERSION} \"$OUT\" --title \"v${VERSION}\" --notes-file \"$NOTES_FILE\""
echo
echo "（本版本简介可放进 CHANGELOG_NEXT.md，发布完后清空它）"
