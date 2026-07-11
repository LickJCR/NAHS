#!/bin/bash
# ================================================================
# 文件名: gogogo.ai.sh
# 中文名: AI 函数库 + AI 记忆体系管理入口
# 创建时间: 2026-04-14
# ================================================================
#
# 【文件职责】
# 1. 提供 AI 相关函数给其他 gogogo 子脚本使用
# 2. 当以 `./gogogo.sh ai` 方式进入时，显示 AI 记忆体系管理菜单
#
# ================================================================

if [ -z "${SCRIPT_DIR:-}" ]; then
	SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

AI_DIR="$SCRIPT_DIR/.ai"
L0_DIR="$AI_DIR/L0#Execution"
L1_DIR="$AI_DIR/L1#Overview"
L2_DIR="$AI_DIR/L2#Index"
L3_DIR="$AI_DIR/L3#Standards"
L4_DIR="$AI_DIR/L4#Changelog"

call_ai_api() {
	local prompt="$1"
	local fallback="${2:-}"
	if [ -n "$fallback" ]; then
		echo "$fallback"
	else
		echo "update project files"
	fi
}

get_ai_commit_message() {
	local status_summary
	status_summary="$(git status --short 2>/dev/null || true)"
	if [ -z "$status_summary" ]; then
		echo "chore: sync workspace changes"
		return 0
	fi
	call_ai_api "$status_summary" "chore: update project files"
}

AI_LINKS="claude:$SCRIPT_DIR/.claude/rules
cursor:$SCRIPT_DIR/.cursor/rules
continue:$SCRIPT_DIR/.continue/rules
windsurf:$SCRIPT_DIR/.windsurf/rules
trae:$SCRIPT_DIR/.trae/rules
roo:$SCRIPT_DIR/.roo/rules"

# L2#规范索引 (Index) 文件列表（逐文件链接到各 IDE）
L2_INDEX_FILES="README toc"

# L1 概览文件映射（单文件链接）
L1_OVERVIEW_TARGETS="AGENTS.md CLAUDE.md .cursorrules .windsurfrules"

create_ai_link() {
	local tool="$1"
	local target="$2"
	local parent
	parent="$(dirname "$target")"
	mkdir -p "$parent"
	# target 是目录，改为逐文件链接
	[ -L "$target" ] && rm "$target"
	[ -d "$target" ] || mkdir -p "$target"
	for f in $L2_INDEX_FILES; do
		local src="$L2_DIR/${f}.md"
		local dst="$target/${f}.md"
		[ -f "$src" ] || continue
		[ -L "$dst" ] && rm "$dst"
		ln -s "$src" "$dst"
	done
	echo -e "  ${GREEN}✅ $tool: 逐文件链接 → .ai/L2#Index/ ($(echo "$L2_INDEX_FILES" | wc -w | tr -d ' ') 文件)${NC}"
}

# 创建 L1#项目概览 (Overview) 文件链接
create_l1_links() {
	local overview_file="$L1_DIR/guide.md"
	[ -f "$overview_file" ] || { echo -e "  ${RED}❌ L1#Overview/guide.md 不存在${NC}"; return 1; }
	for target in $L1_OVERVIEW_TARGETS; do
		local full_target="$SCRIPT_DIR/$target"
		[ -L "$full_target" ] && rm "$full_target"
		ln -s "$overview_file" "$full_target"
		echo -e "  ${GREEN}✅ $target → .ai/L1#Overview/guide.md${NC}"
	done
}

# 创建 L2#规范索引 (Index) 逐文件链接到 .kiro/steering/
create_l2_steering_links() {
	local steering_dir="$SCRIPT_DIR/.kiro/steering"
	mkdir -p "$steering_dir"
	for f in $L2_INDEX_FILES; do
		local src="$L2_DIR/${f}.md"
		local dst="$steering_dir/${f}.md"
		[ -f "$src" ] || { echo -e "  ${YELLOW}⚠️  .ai/L2#Index/${f}.md 不存在，跳过${NC}"; continue; }
		[ -L "$dst" ] && rm "$dst"
		ln -s "$src" "$dst"
		echo -e "  ${GREEN}✅ .kiro/steering/${f}.md → .ai/L2#Index/${f}.md${NC}"
	done
}

each_ai_link() {
	local action="$1"
	echo "$AI_LINKS" | while IFS=: read -r tool target; do
		[ -z "$tool" ] && continue
		$action "$tool" "$target"
	done
}

rebuild_ai_link() {
	local tool="$1"
	local target="$2"
	[ -L "$target" ] && rm "$target"
	create_ai_link "$tool" "$target"
}

sync_kiro_specs() {
	echo -e "${BLUE}📋 同步 Kiro specs...${NC}"
	local kiro_specs_dir="$SCRIPT_DIR/.kiro/specs"
	local active_dir="$L0_DIR/specs/active"
	local completed_dir="$L0_DIR/specs/completed"
	local found_specs=0
	mkdir -p "$kiro_specs_dir"

	local spec_pairs="00.spec-01.requirements.md:requirements.md
00.spec-02.design.md:design.md
00.spec-03.tasks.md:tasks.md
00.spec-04.decisions.md:decisions.md"

	for source_dir in "$completed_dir" "$active_dir"; do
		[ -d "$source_dir" ] || continue
		for feature_dir in "$source_dir"/*/; do
			[ -d "$feature_dir" ] || continue
			found_specs=1
			local feature
			feature="$(basename "$feature_dir")"
			local kiro_feature_dir="$kiro_specs_dir/$feature"
			mkdir -p "$kiro_feature_dir"
			echo "$spec_pairs" | while IFS=: read -r src_name dst_name; do
				[ -z "$src_name" ] && continue
				local src_file="$feature_dir/$src_name"
				local dst_file="$kiro_feature_dir/$dst_name"
				if [ -f "$src_file" ]; then
					[ -L "$dst_file" ] && rm "$dst_file"
					ln -s "$src_file" "$dst_file"
					echo -e "  ${GREEN}✅ $feature/$dst_name → $src_name${NC}"
				fi
			done
		done
	done

	if [ "$found_specs" -eq 0 ]; then
		echo -e "  ${YELLOW}⚠️  无可同步的 L0#Execution specs${NC}"
	fi
}

verify_ai_links() {
	echo -e "${BLUE}🔍 验证链接完整性...${NC}"
	echo "$AI_LINKS" | while IFS=: read -r tool target; do
		[ -z "$tool" ] && continue
		if [ -L "$target" ]; then
			local real
			real="$(readlink "$target")"
			if [ -d "$target" ]; then
				echo -e "  ${GREEN}✅ $tool: → $real${NC}"
			else
				echo -e "  ${RED}❌ $tool: 链接断裂 (→ $real)${NC}"
			fi
		elif [ -d "$target" ]; then
			echo -e "  ${YELLOW}⚠️  $tool: 是实体目录（非 symlink）${NC}"
		else
			echo -e "  ${YELLOW}—  $tool: 不存在（未配置）${NC}"
		fi
	done
}

show_ai_status() {
	echo -e "${BLUE}📊 当前状态${NC}"
	echo ""
	echo -e "  L0#Execution: $(find "$L0_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ') 文件"
	echo -e "  L1#Overview: $(ls "$L1_DIR/"*.md 2>/dev/null | wc -l | tr -d ' ') 文件"
	echo -e "  L2#Index: $(ls "$L2_DIR/"*.md 2>/dev/null | wc -l | tr -d ' ') 文件"
	echo -e "  L0#Execution/specs/active: $(ls -d "$L0_DIR/specs/active/"*/ 2>/dev/null | wc -l | tr -d ' ') 功能"
	echo -e "  L0#Execution/specs/completed: $(ls -d "$L0_DIR/specs/completed/"*/ 2>/dev/null | wc -l | tr -d ' ') 功能"
	echo -e "  L3#Standards/standards: $(ls "$L3_DIR/standards/"*.md 2>/dev/null | wc -l | tr -d ' ') 文件"
	echo -e "  L4#Changelog: $(find "$L4_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ') 日志"
	echo ""
	verify_ai_links
}

write_l4_log() {
	echo -e "${BLUE}📝 写入 L4#操作日志 (Changelog)${NC}"
	local log_date
	log_date="$(date +%Y-%m-%d)"
	local year
	year="$(date +%Y)"
	local month
	month="$(date +%m)"
	local target_dir="$L4_DIR/$year/$month"
	mkdir -p "$target_dir"

	echo "请选择日志类型："
	echo "1. task     - 任务完成"
	echo "2. debug    - 调试记录"
	echo "3. decision - 决策变更"
	echo "4. session  - 会话摘要"
	read -p "请输入类型编号: " log_type_choice

	local log_type
	case "$log_type_choice" in
	1) log_type="task" ;;
	2) log_type="debug" ;;
	3) log_type="decision" ;;
	4) log_type="session" ;;
	*)
		echo -e "${RED}❌ 无效类型${NC}"
		return 1
		;;
	esac

	read -p "请输入主题（英文连字符，如 ai-memory-migration）: " log_topic
	if [ -z "$log_topic" ]; then
		echo -e "${RED}❌ 主题不能为空${NC}"
		return 1
	fi

	local seq
	seq=$(find "$target_dir" -maxdepth 1 -name "$log_date.$log_type-*.${log_topic}.md" 2>/dev/null | wc -l | tr -d ' ')
	seq=$((seq + 1))
	local seq_padded
	seq_padded=$(printf "%02d" "$seq")

	local log_file="$target_dir/$log_date.$log_type-$seq_padded.$log_topic.md"

	read -p "请输入简短标题: " log_title
	echo "请输入内容（结束请输入单独一行 EOF）："
	local log_body=""
	while IFS= read -r line; do
		[ "$line" = "EOF" ] && break
		log_body="${log_body}${line}
"
	done

	cat >"$log_file" <<EOF
# ${log_title:-$log_topic}

> 日期：$log_date
> 类型：$log_type
> 主题：$log_topic

## 内容

${log_body}
EOF

	echo -e "${GREEN}✅ L4#Changelog 日志已写入: ${log_file#$SCRIPT_DIR/}${NC}"
}

run_ai_manager_menu() {
	echo -e "${BLUE}================================${NC}"
	echo -e "${BLUE}    AI 记忆体系管理${NC}"
	echo -e "${BLUE}================================${NC}"
	echo ""

	echo -e "${YELLOW}请选择操作：${NC}"
	echo "1. 初始化/重建所有链接（L1#Overview + L2#Index）"
	echo "2. 检查 AI 体系状态"
	echo "3. 同步 Kiro specs（L0#Execution→.kiro/specs/）"
	echo "4. 写入 L4#操作日志 (Changelog)"
	echo "0. 返回"
	echo ""
	read -p "请输入选择: " ai_choice
	echo ""

	case "$ai_choice" in
	1)
		echo -e "${GREEN}🔗 建立所有链接...${NC}"
		echo ""
		echo -e "${BLUE}L1#项目概览 (Overview) 文件链接：${NC}"
		create_l1_links
		echo ""
		echo -e "${BLUE}L2#规范索引 (Index) 链接（→ .kiro/steering/）：${NC}"
		create_l2_steering_links
		echo ""
		each_ai_link create_ai_link
		echo ""
		sync_kiro_specs
		;;
	2)
		show_ai_status
		;;
	3)
		sync_kiro_specs
		;;
	4)
		write_l4_log
		;;
	0)
		echo -e "${GREEN}👋 返回主菜单${NC}"
		;;
	*)
		echo -e "${RED}❌ 无效选择：${ai_choice}${NC}"
		return 1
		;;
	esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]] || [ "${choice:-}" = "ai" ]; then
	run_ai_manager_menu
fi
