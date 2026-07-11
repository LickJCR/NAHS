#!/bin/bash
# ================================================================
# 文件名: gogogo.3.sh
# 中文名: 选项 3 - 清除缓存
# 创建时间: 2025-12-30
# ================================================================
#
# 【文件职责】
# 清除项目各类缓存，解决常见问题
#
# ================================================================

step "清除缓存"

# ============================================================
# 1. 清除前端缓存
# ============================================================

step "清除前端缓存..."

# 清除 node_modules/.cache
if [ -d "node_modules/.cache" ]; then
	rm -rf node_modules/.cache
	success "已清除 node_modules/.cache"
fi

# 清除构建输出
if [ -d "dist" ]; then
	rm -rf dist
	success "已清除 dist/"
fi

if [ -d "build" ]; then
	rm -rf build
	success "已清除 build/"
fi

# ============================================================
# 2. 清除后端缓存（根据框架调整）
# ============================================================

step "清除后端缓存..."

# PHP Laravel
if [ -f "artisan" ]; then
	php artisan config:clear 2>/dev/null && success "已清除 Laravel config 缓存"
	php artisan route:clear 2>/dev/null && success "已清除 Laravel route 缓存"
	php artisan view:clear 2>/dev/null && success "已清除 Laravel view 缓存"
	php artisan cache:clear 2>/dev/null && success "已清除 Laravel cache"
fi

# Python Django
if [ -f "manage.py" ]; then
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
	success "已清除 Python __pycache__"
fi

# ============================================================
# 3. 清除其他缓存
# ============================================================

# 清除日志（可选）
# if [ -d "storage/logs" ]; then
#     rm -f storage/logs/*.log
#     success "已清除日志文件"
# fi

echo ""
success "缓存清除完成"
