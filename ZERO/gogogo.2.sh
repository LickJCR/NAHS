#!/bin/bash
# ================================================================
# 文件名: gogogo.2.sh
# 中文名: 选项 2 - 部署到服务器
# 创建时间: 2025-12-30
# ================================================================
#
# 【文件职责】
# 将项目部署到远程服务器
#
# 【部署步骤】
# 1. 读取 .deployignore 排除规则
# 2. 同步文件到服务器（rsync）
# 3. 修复文件权限
# 4. 验证部署结果
#
# 【依赖文件】
# - .deployignore: 部署排除规则配置
# - gogogo.lib.sh: 通用库（包含 RSYNC_EXCLUDES）
#
# ================================================================

step "部署到服务器"

# ============================================================
# 配置（请根据实际情况修改）
# ============================================================

# 服务器配置
REMOTE_USER="your_user"
REMOTE_HOST="your_server.com"
REMOTE_PATH="/var/www/your_project"
SITE_URL="https://your_domain.com"

# SSH 配置（可选）
# SSH_KEY="~/.ssh/id_rsa"

# ============================================================
# 1. 检查 .deployignore
# ============================================================

if [ ! -f ".deployignore" ]; then
	warn "未找到 .deployignore 文件，将同步所有文件"
	warn "建议创建 .deployignore 配置部署排除规则"
fi

# ============================================================
# 2. 同步文件到服务器
# ============================================================

step "同步文件到服务器..."

# 使用 gogogo.lib.sh 中预构建的 RSYNC_EXCLUDES
eval "rsync -avz --delete --no-owner --no-group --no-perms $RSYNC_EXCLUDES ./ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

if [ $? -ne 0 ]; then
	error "文件同步失败"
	exit 1
fi
success "文件同步完成"

# ============================================================
# 3. 修复文件权限
# ============================================================

step "修复文件权限..."

ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && \
    find . -type d -exec chmod 755 {} \; 2>/dev/null; \
    find . -type f -exec chmod 644 {} \; 2>/dev/null; \
    find . -name '*.sh' -exec chmod 755 {} \; 2>/dev/null"

if [ $? -ne 0 ]; then
	warn "权限修复可能未完全成功"
else
	success "权限修复完成"
fi

# ============================================================
# 4. 验证部署
# ============================================================

step "验证部署..."

# 检查网站响应（根据实际情况调整 URL）
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SITE_URL}" --max-time 10 2>/dev/null)

if [ "$HTTP_CODE" == "000" ]; then
	warn "无法连接到 ${SITE_URL}，请手动验证"
elif [ "$HTTP_CODE" == "403" ]; then
	error "网站返回 403，权限可能有问题"
	exit 1
elif [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "301" ] || [ "$HTTP_CODE" == "302" ]; then
	success "网站响应正常 (HTTP ${HTTP_CODE})"
else
	warn "网站返回 HTTP ${HTTP_CODE}，请检查"
fi

# ============================================================
# 完成
# ============================================================

echo ""
success "部署完成！"
info "访问地址: ${SITE_URL}"
