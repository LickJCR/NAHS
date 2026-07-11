#!/bin/bash
# ================================================================
# gogogo.8.sh - AI 记忆体系映射管理
# ================================================================
#
# 管理 .ai/ 各层到各 IDE/CLI 工具的符号链接映射
#
# 用法：
#   ./gogogo.sh 8     # 显示菜单
#   ./gogogo.sh 8a    # 映射到 Kiro
#   ./gogogo.sh 8b    # 映射到 Cursor
#   ./gogogo.sh 8c    # 映射到 Claude Code
#   ./gogogo.sh 8d    # 映射到 Windsurf
#   ./gogogo.sh 8e    # 映射到 Continue
#   ./gogogo.sh 8f    # 映射到所有工具
#   ./gogogo.sh 8g    # 移除所有映射（并检查非链接文件）
# ================================================================

if [ -z "$GREEN" ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'
    YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ================================================================
# L2#规范索引 (Index) 文件列表（所有工具共用）
# ================================================================
L2_FILES=(README toc)

# ================================================================
# 映射定义（单一数据源）
# ================================================================
# 格式：source_in_ai|target_path|description
build_mappings() {
    MAPPINGS=()

    # L1#项目概览 (Overview) → 各 IDE 的概览文件（单文件链接）
    MAPPINGS+=(
        "L1#Overview/guide.md|AGENTS.md|L1#Overview→AGENTS.md"
        "L1#Overview/guide.md|CLAUDE.md|L1#Overview→CLAUDE.md"
        "L1#Overview/guide.md|.cursorrules|L1#Overview→.cursorrules"
        "L1#Overview/guide.md|.windsurfrules|L1#Overview→.windsurfrules"
    )

    # L2#规范索引 (Index) → 各工具的自动载入目录（逐文件）
    for f in "${L2_FILES[@]}"; do
        MAPPINGS+=(
            "L2#Index/${f}.md|.kiro/steering/${f}.md|L2#Index→kiro/steering/${f}.md"
            "L2#Index/${f}.md|.cursor/rules/${f}.md|L2#Index→cursor/rules/${f}.md"
            "L2#Index/${f}.md|.claude/memories/${f}.md|L2#Index→claude/memories/${f}.md"
            "L2#Index/${f}.md|.continue/rules/${f}.md|L2#Index→continue/rules/${f}.md"
            "L2#Index/${f}.md|.windsurf/rules/${f}.md|L2#Index→windsurf/rules/${f}.md"
        )
    done

    # L3#完整规范 (Standards) → 各工具的按需规则目录（整目录链接）
    MAPPINGS+=(
        "L3#Standards/standards|.cursor/rules/zero-standards|L3#Standards→cursor/rules/zero-standards"
        "L3#Standards/standards|.claude/memories/zero-standards|L3#Standards→claude/memories/zero-standards"
        "L3#Standards/standards|.windsurf/rules/zero-standards|L3#Standards→windsurf/rules/zero-standards"
        "L3#Standards/standards|.continue/rules/zero-standards|L3#Standards→continue/rules/zero-standards"
    )
}

build_mappings

# ================================================================
# 按工具过滤映射
# ================================================================
get_mappings_for_tool() {
    local tool=$1
    for mapping in "${MAPPINGS[@]}"; do
        local target=$(echo "$mapping" | cut -d'|' -f2)
        case $tool in
            kiro)    [[ "$target" == *".kiro"* || "$target" == "AGENTS.md" ]] && echo "$mapping" ;;
            cursor)  [[ "$target" == *".cursor"* || "$target" == ".cursorrules" ]] && echo "$mapping" ;;
            claude)  [[ "$target" == *".claude"* || "$target" == "CLAUDE.md" ]] && echo "$mapping" ;;
            windsurf)[[ "$target" == *".windsurf"* || "$target" == ".windsurfrules" ]] && echo "$mapping" ;;
            continue)[[ "$target" == *".continue"* ]] && echo "$mapping" ;;
            all)     echo "$mapping" ;;
        esac
    done
}

# ================================================================
# 创建单个映射
# ================================================================
create_mapping() {
    local source="$PROJECT_ROOT/.ai/$1"
    local target="$PROJECT_ROOT/$2"
    local desc="$3"

    # 创建父目录
    mkdir -p "$(dirname "$target")"

    # 统一用符号链接
    if [ -L "$target" ]; then
        rm -f "$target"
    elif [ -e "$target" ]; then
        # 如果是实体文件/目录，备份
        local backup="${target}.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "  ${YELLOW}⚠️  备份现有文件/目录 → $(basename "$backup")${NC}"
        mv "$target" "$backup"
    fi
    
    ln -sf "$source" "$target"
    echo -e "  ${GREEN}✓${NC} $desc"
}

# ================================================================
# 映射到指定工具
# ================================================================
sync_to_tool() {
    local tool=$1
    local tool_name=$2
    echo -e "${BLUE}🔄 映射到 $tool_name...${NC}"
    while IFS= read -r mapping; do
        local src=$(echo "$mapping" | cut -d'|' -f1)
        local tgt=$(echo "$mapping" | cut -d'|' -f2)
        local desc=$(echo "$mapping" | cut -d'|' -f3)
        create_mapping "$src" "$tgt" "$desc"
    done < <(get_mappings_for_tool "$tool")
    echo -e "${GREEN}✅ $tool_name 映射完成${NC}"
}

# ================================================================
# 移除所有映射（选项 g）
# ================================================================
remove_all_mappings() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}    移除所有 IDE/CLI 映射${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""

    local removed=0
    local suspicious=0

    echo -e "${YELLOW}📋 检查并移除符号链接...${NC}"
    for mapping in "${MAPPINGS[@]}"; do
        local target="$PROJECT_ROOT/$(echo "$mapping" | cut -d'|' -f2)"
        local desc=$(echo "$mapping" | cut -d'|' -f3)
        if [ -L "$target" ]; then
            rm -f "$target"
            echo -e "  ${GREEN}✓ 已移除${NC}: $target"
            ((removed++))
        elif [ -e "$target" ]; then
            echo -e "  ${RED}⚠️  非链接文件（跳过）${NC}: $target"
            ((suspicious++))
        fi
    done

    echo ""
    echo -e "${YELLOW}🔍 检查 IDE 目录中的非链接文件...${NC}"

    # 检查各 IDE 目录中是否有非链接的意外文件
    local check_dirs=(
        ".kiro/steering"
        ".cursor/rules"
        ".claude/memories"
        ".windsurf/rules"
        ".continue/rules"
    )

    for dir in "${check_dirs[@]}"; do
        local full_dir="$PROJECT_ROOT/$dir"
        if [ -d "$full_dir" ] && [ ! -L "$full_dir" ]; then
            # 目录存在且不是链接，检查里面的文件
            while IFS= read -r -d '' item; do
                if [ ! -L "$item" ]; then
                    echo -e "  ${RED}⚠️  意外的非链接文件${NC}: $item"
                    ((suspicious++))
                fi
            done < <(find "$full_dir" -maxdepth 2 -not -type d -print0 2>/dev/null)
        fi
    done

    # 检查根目录的概览文件
    for f in AGENTS.md CLAUDE.md .cursorrules .windsurfrules; do
        local full_f="$PROJECT_ROOT/$f"
        if [ -e "$full_f" ] && [ ! -L "$full_f" ]; then
            echo -e "  ${RED}⚠️  非链接文件（跳过）${NC}: $f"
            ((suspicious++))
        fi
    done

    echo ""
    echo -e "${GREEN}✅ 移除完成：已移除 $removed 个链接${NC}"
    if [ $suspicious -gt 0 ]; then
        echo -e "${RED}⚠️  发现 $suspicious 个非链接文件，请手动检查${NC}"
    else
        echo -e "${GREEN}✅ 未发现意外的非链接文件${NC}"
    fi
    echo ""
    echo -e "${YELLOW}💡 重新映射：./gogogo.sh 8f${NC}"
}

# ================================================================
# 显示菜单
# ================================================================
show_menu() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}    AI 记忆体系映射管理${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    echo -e "${YELLOW}映射目标：${NC}"
    echo "  a. Kiro        (AGENTS.md + .kiro/steering)"
    echo "  b. Cursor      (.cursorrules + .cursor/rules)"
    echo "  c. Claude Code (CLAUDE.md + .claude/memories)"
    echo "  d. Windsurf    (.windsurfrules + .windsurf/rules)"
    echo "  e. Continue    (.continue/rules)"
    echo ""
    echo "  f. 映射到所有工具"
    echo "  g. 移除所有映射（并检查非链接文件）"
    echo ""
    echo "  0. 返回主菜单"
    echo ""
}

# ================================================================
# 主逻辑
# ================================================================
run() {
    local choice=$1

    case "$choice" in
        a) sync_to_tool "kiro"     "Kiro" ;;
        b) sync_to_tool "cursor"   "Cursor" ;;
        c) sync_to_tool "claude"   "Claude Code" ;;
        d) sync_to_tool "windsurf" "Windsurf" ;;
        e) sync_to_tool "continue" "Continue" ;;
        f)
            echo -e "${GREEN}🚀 映射到所有工具...${NC}"
            echo ""
            sync_to_tool "kiro"     "Kiro"
            echo ""
            sync_to_tool "cursor"   "Cursor"
            echo ""
            sync_to_tool "claude"   "Claude Code"
            echo ""
            sync_to_tool "windsurf" "Windsurf"
            echo ""
            sync_to_tool "continue" "Continue"
            echo ""
            echo -e "${GREEN}✅ 所有工具映射完成${NC}"
            ;;
        g) remove_all_mappings ;;
        0) echo -e "${YELLOW}返回主菜单${NC}"; exit 0 ;;
        *)
            echo -e "${RED}❌ 无效选择: $choice${NC}"
            show_menu
            exit 1
            ;;
    esac
}

if [ -n "$1" ]; then
    run "$1"
else
    show_menu
    read -p "请输入选择 (a/b/c/d/e/f/g/0): " choice
    run "$choice"
fi
