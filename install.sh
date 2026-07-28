#!/bin/bash
#
# mymore — 全局 Hook 安装脚本
#
# 将 mymore 的 Hook 机制安装到全局，使所有 Claude Code 项目都能自动
# 在 SessionStart / UserPromptSubmit / Stop / SessionEnd 时保存和注入记忆。
#
# 安装位置: ~/.mymore/hooks/
# 全局配置: ~/.claude/settings.json
# 数据存储: ~/.mymore/
#
# 用法:
#   bash install.sh              # 安装
#   bash install.sh --uninstall  # 卸载
#

set -e
cd "$(dirname "$0")"

MYMORE_ROOT="${MYMORE_ROOT:-$HOME/.mymore}"
HOOKS_DIR="$MYMORE_ROOT/hooks"
GLOBAL_SETTINGS="$HOME/.claude/settings.json"
PROJECT_ROOT="$(pwd)"

echo "📦 mymore 全局 Hook 安装"
echo "========================="
echo "  目标目录: $HOOKS_DIR"
echo "  全局配置: $GLOBAL_SETTINGS"
echo ""

# ── 卸载 ──
if [ "$1" = "--uninstall" ]; then
  echo "🗑️  卸载 mymore 全局 Hook..."
  rm -rf "$HOOKS_DIR"
  # 从全局 settings.json 移除 hook 块
  if [ -f "$GLOBAL_SETTINGS" ]; then
    # 使用临时文件过滤掉 mymore hooks
    node -e "
    const s = require('fs').readFileSync('$GLOBAL_SETTINGS','utf8');
    try {
      const j = JSON.parse(s);
      if (j.hooks) {
        delete j.hooks.SessionStart;
        delete j.hooks.UserPromptSubmit;
        delete j.hooks.Stop;
        delete j.hooks.SessionEnd;
        // 如果 hooks 空了也删掉
        if (Object.keys(j.hooks).length === 0) delete j.hooks;
      }
      require('fs').writeFileSync('$GLOBAL_SETTINGS', JSON.stringify(j, null, 2)+'\n');
      console.log('✅ 已从 $GLOBAL_SETTINGS 移除 mymore hooks');
    } catch(e) {
      console.error('⚠️  无法解析 $GLOBAL_SETTINGS:', e.message);
    }
    " 2>/dev/null || true
    # 后备: 用 sed 删掉 mymore 相关行 (简单方案)
  fi
  echo "✅ 卸载完成"
  exit 0
fi

# ── 1. 复制 Hook 脚本 ──
echo "📋 复制 Hook 脚本..."
mkdir -p "$HOOKS_DIR/scripts/utils"
cp hooks/scripts/session-context.js   "$HOOKS_DIR/scripts/" 2>/dev/null || true
cp hooks/scripts/inject-memories.js   "$HOOKS_DIR/scripts/" 2>/dev/null || true
cp hooks/scripts/store-memories.js    "$HOOKS_DIR/scripts/" 2>/dev/null || true
cp hooks/scripts/session-summary.js   "$HOOKS_DIR/scripts/" 2>/dev/null || true
cp hooks/scripts/utils/config.js      "$HOOKS_DIR/scripts/utils/" 2>/dev/null || true
cp hooks/scripts/utils/debug.js       "$HOOKS_DIR/scripts/utils/" 2>/dev/null || true

# ── 2. 创建 package.json ──
echo "📦 创建依赖配置..."
cat > "$HOOKS_DIR/package.json" << 'EOF'
{
  "name": "mymore-hooks",
  "private": true,
  "type": "module",
  "dependencies": {
    "better-sqlite3": "^13.0.1",
    "gray-matter": "^4.0.3"
  }
}
EOF

# ── 3. 安装 npm 依赖 ──
echo "⬇️  安装 npm 依赖..."
cd "$HOOKS_DIR"
npm install --omit=dev 2>&1 | tail -3
cd "$PROJECT_ROOT"

# ── 4. 注册全局 Hook ──
echo "🔧 注册全局 Hook..."
mkdir -p "$(dirname "$GLOBAL_SETTINGS")"

# 用 Node.js 来安全地合并 JSON (比 sed 可靠)
node -e "
const fs = require('fs');
const path = '$GLOBAL_SETTINGS';
const nodePath = 'node';

let settings = { hooks: {} };
try {
  if (fs.existsSync(path)) {
    const raw = fs.readFileSync(path, 'utf8');
    settings = JSON.parse(raw);
  }
} catch(e) {
  console.error('⚠️  无法解析 ' + path + ', 将创建新文件');
  settings = { hooks: {} };
}
if (!settings.hooks) settings.hooks = {};

const makeHook = (script) => ({
  type: 'command',
  command: nodePath + ' $HOOKS_DIR/scripts/' + script,
  timeout: 30
});

// 只添加，不覆盖已有的
if (!settings.hooks.SessionStart) {
  settings.hooks.SessionStart = [{ hooks: [makeHook('session-context.js')] }];
}
if (!settings.hooks.UserPromptSubmit) {
  settings.hooks.UserPromptSubmit = [{ hooks: [Object.assign(makeHook('inject-memories.js'), { timeout: 10 })] }];
}
if (!settings.hooks.Stop) {
  settings.hooks.Stop = [{ hooks: [makeHook('store-memories.js')] }];
}
if (!settings.hooks.SessionEnd) {
  settings.hooks.SessionEnd = [{ hooks: [makeHook('session-summary.js')] }];
}

const output = JSON.stringify(settings, null, 2) + '\n';
// 检查是否有变化
if (fs.existsSync(path) && fs.readFileSync(path, 'utf8') === output) {
  console.log('  → Hook 已注册，无变化');
} else {
  fs.writeFileSync(path, output);
  console.log('  → 已写入 ' + path);
}
"

echo ""
echo "✅ 安装完成！"
echo ""
echo "📌 现在所有 Claude Code 项目都会自动："
echo "   启动时   → 加载最近记忆 + 上次会话摘要"
echo "   发消息时 → 搜索相关记忆注入上下文"
echo "   停止时   → 自动保存对话到 ~/.mymore/ 存储"
echo "   结束会话 → 保存会话摘要"
echo ""
echo "📂 数据存储: ~/.mymore/"
echo "   ├── .index/memory.db    (FTS5 搜索索引)"
echo "   ├── memory/groups/      (人类可读 Markdown 记忆)"
echo "   └── sessions.jsonl      (会话摘要)"
echo ""
echo "💡 提示: 运行以下命令验证"
echo "   echo '{\"cwd\":\"'\"\$PWD\"'\"}' | node $HOOKS_DIR/scripts/session-context.js"
