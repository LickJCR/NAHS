#!/bin/bash
# ================================================================
# 文件名: gogogo.sh
# 中文名: Zero 项目统一入口脚本
# 创建时间: 2025-12-30
# ================================================================
#
# 【文件职责】
# 统一入口脚本，负责加载库文件、显示菜单、调度子脚本
#
# 【拆分结构】
# gogogo.sh          - 主入口（本文件）
# gogogo.lib.sh      - 通用库：颜色定义、工具函数
# gogogo.1.sh        - 选项 1: 本地开发服务器
# gogogo.2.sh        - 选项 2: 部署到服务器
# gogogo.3.sh        - 选项 3: 清除缓存
# gogogo.ai.sh       - 选项 ai: AI 记忆体系管理
# ...                - 按需扩展
#
# 【使用方法】
# ./gogogo.sh        # 交互式菜单
# ./gogogo.sh 1      # 直接执行选项1
# ./gogogo.sh ai     # AI 记忆体系管理
#
# ================================================================

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载库文件
if [ -f "$SCRIPT_DIR/gogogo.lib.sh" ]; then
	source "$SCRIPT_DIR/gogogo.lib.sh"
else
	echo "❌ 错误：找不到 gogogo.lib.sh"
	exit 1
fi

# 检查项目根目录
check_project_root

# 显示标题
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}    ZERO - PathKing${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 获取选择（支持命令行参数或交互式输入）
if [ -n "$1" ]; then
	choice="$1"
	# 检查是否有子选项（如 8f 中的 f）
	if [[ "$choice" =~ ^([0-9]+|ai)(.*)$ ]]; then
		main_choice="${BASH_REMATCH[1]}"
		sub_choice="${BASH_REMATCH[2]}"
		echo -e "${GREEN}📌 执行选项: ${main_choice}${sub_choice}${NC}"
		choice="$main_choice"
	else
		echo -e "${GREEN}📌 执行选项: ${choice}${NC}"
		sub_choice=""
	fi
else
	echo -e "${YELLOW}请选择操作：${NC}"
	echo "1. 启动本地开发服务器"
	echo "2. 部署到服务器"
	echo "3. 清除缓存"
	echo "4. 运行测试"
	echo "5. 构建生产版本"
	echo "8. AI 记忆体系映射管理（8f=映射所有 8g=移除所有）"
	echo "ai. AI 记忆体系管理"
	echo "0. 退出"
	echo ""
	read -t 10 -p "请输入选择 (1/2/3/4/5/8/ai/0，10秒后自动选择1): " choice

	if [ -z "$choice" ]; then
		choice=1
		echo -e "\n${GREEN}⏱️  自动选择：启动本地开发服务器${NC}"
	fi
fi
echo ""

# 退出选项
if [ "$choice" = "0" ]; then
	echo -e "${GREEN}👋 再见！${NC}"
	exit 0
fi

# 记录开始时间
START_TIME=$(date +%s)
export START_TIME

# 检查对应的子脚本是否存在
SUB_SCRIPT="$SCRIPT_DIR/gogogo.${choice}.sh"
if [ -f "$SUB_SCRIPT" ]; then
	# 如果有子选项，将其作为参数传递给子脚本
	if [ -n "${sub_choice:-}" ]; then
		source "$SUB_SCRIPT" "$sub_choice"
	else
		source "$SUB_SCRIPT"
	fi

	# 显示耗时
	show_elapsed_time "$START_TIME"
else
	echo -e "${RED}❌ 无效选择：${choice}${NC}"
	echo -e "${YELLOW}💡 可用的子脚本：${NC}"
	ls -1 "$SCRIPT_DIR"/gogogo.*.sh 2>/dev/null | grep -v "gogogo.lib.sh" | while read f; do
		basename "$f"
	done
	exit 1
fi
