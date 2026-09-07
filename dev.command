#!/bin/bash
# Finder からダブルクリックすると Terminal が開いて mikan-chat の dev 版を起動する。
# Desktop に symlink を貼って起動するパターンにも対応するため、
# シンボリックリンクを解決してから cd する。
set -e

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
PROJECT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
cd "$PROJECT_DIR"

# zsh で起動された場合に PATH が通らないことがあるので明示的に補う
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "▶ mikan-chat Dev"
echo "   project: $PROJECT_DIR"
echo

RUNNING_PIDS="$(pgrep -f "mikan-chat/node_modules/electron" 2>/dev/null || true)"
if [ -n "$RUNNING_PIDS" ]; then
  echo "⚠️  別の mikan-chat プロセスが起動中です。"
  echo "   Dev版を起動する前に、既存の mikan-chat を終了してください。"
  echo
  for PID in $RUNNING_PIDS; do
    CMD="$(ps -p "$PID" -o command= 2>/dev/null || true)"
    echo "   PID $PID: $CMD"
  done
  echo
  exit 1
fi

# 古いビルド成果物が残っているとチャンクハッシュ不整合でクラッシュする
rm -rf "$PROJECT_DIR/out"

exec npm run dev:electron
