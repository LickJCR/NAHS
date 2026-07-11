#!/bin/bash
# ================================================================
# 文件名: gogogo.lib.sh
# 中文名: 通用库 - 颜色定义和工具函数
# 创建时间: 2025-12-30
# ================================================================

# ============================================================
# 颜色定义
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[1;36m'
MAGENTA='\033[1;35m'
NC='\033[0m' # No Color

# ============================================================
# 基础工具函数
# ============================================================

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 检查是否在正确的目录
check_project_root() {
	# 根据项目类型检查标志文件
	# 可以根据实际项目调整检查条件
	if [ ! -f "package.json" ] && [ ! -f "composer.json" ] && [ ! -f "requirements.txt" ] && [ ! -f "Cargo.toml" ]; then
		echo -e "${RED}❌ 错误：请在项目根目录执行此脚本${NC}"
		exit 1
	fi
}

# 计算并显示耗时
show_elapsed_time() {
	local start_time=$1
	local end_time=$(date +%s)
	local elapsed=$((end_time - start_time))
	local minutes=$((elapsed / 60))
	local seconds=$((elapsed % 60))
	echo ""
	echo -e "${CYAN}⏱️  总耗时: ${minutes}分${seconds}秒${NC}"
}

# ============================================================
# 输出函数
# ============================================================

# 成功消息
success() {
	echo -e "${GREEN}✅ $1${NC}"
}

# 错误消息
error() {
	echo -e "${RED}❌ $1${NC}"
}

# 警告消息
warn() {
	echo -e "${YELLOW}⚠️  $1${NC}"
}

# 信息消息
info() {
	echo -e "${BLUE}ℹ️  $1${NC}"
}

# 步骤提示
step() {
	echo -e "${CYAN}📌 $1${NC}"
}

# ============================================================
# 检查函数
# ============================================================

# 检查命令是否存在
check_command() {
	local cmd=$1
	local install_hint=$2
	if ! command -v "$cmd" &>/dev/null; then
		error "需要 $cmd，但未安装"
		if [ -n "$install_hint" ]; then
			info "安装方法: $install_hint"
		fi
		exit 1
	fi
}

# 检查端口是否被占用
check_port() {
	local port=$1
	if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
		return 0 # 端口被占用
	else
		return 1 # 端口空闲
	fi
}

# 杀死占用端口的进程
kill_port() {
	local port=$1
	if check_port $port; then
		warn "端口 $port 被占用，正在释放..."
		lsof -ti:$port | xargs kill -9 2>/dev/null
		sleep 1
		success "端口 $port 已释放"
	fi
}

# ============================================================
# 服务管理函数
# ============================================================

# 启动后台进程
start_background() {
	local name=$1
	local command=$2
	local log_file="${3:-/dev/null}"

	step "启动 $name..."
	nohup $command >"$log_file" 2>&1 &
	local pid=$!
	sleep 1

	if ps -p $pid >/dev/null 2>&1; then
		success "$name 已启动 (PID: $pid)"
		return 0
	else
		error "$name 启动失败"
		return 1
	fi
}

# 等待服务就绪
wait_for_service() {
	local url=$1
	local timeout=${2:-30}
	local name=${3:-"服务"}

	info "等待 $name 就绪..."
	local count=0
	while [ $count -lt $timeout ]; do
		if curl -s "$url" >/dev/null 2>&1; then
			success "$name 已就绪"
			return 0
		fi
		sleep 1
		count=$((count + 1))
	done

	error "$name 启动超时"
	return 1
}

# ============================================================
# 确认函数
# ============================================================

# 确认操作
confirm() {
	local message=${1:-"确认继续？"}
	read -p "$message (y/n): " answer
	case $answer in
	[Yy]*) return 0 ;;
	*) return 1 ;;
	esac
}

# ============================================================
# 部署排除规则
# ============================================================

DEPLOY_IGNORE=".deployignore"

# 构建 rsync 排除参数
build_rsync_excludes() {
	local excludes=""
	if [ -f "$DEPLOY_IGNORE" ]; then
		while IFS= read -r line || [ -n "$line" ]; do
			# 跳过空行和注释
			[[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
			# 去除首尾空格
			line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
			[ -n "$line" ] && excludes="$excludes --exclude='$line'"
		done <"$DEPLOY_IGNORE"
	fi
	echo "$excludes"
}

# 预构建排除参数
RSYNC_EXCLUDES=$(build_rsync_excludes)
