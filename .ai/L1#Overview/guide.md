# NAHS 开发指南

> 版本：v0.1.0
> 来源：参考 `ZERO/.ai` 六层规范体系，按 NAHS 项目裁剪。

## 项目定位

NAHS 是 NewAPI 管理后台辅助油猴脚本。源码采用多文件开发、单文件发布：

- `src/`：开发源码。
- `scripts/build.mjs`：将源码拼成 `newapi-helper-suite.user.js`。
- `newapi-helper-suite.user.js`：Tampermonkey / Violentmonkey 安装和自动更新使用的发布产物。

## 零容忍规则

1. 开发源码单文件不超过 1000 行。
2. 不直接编辑生成文件 `newapi-helper-suite.user.js`，必须改 `src/` 后运行构建。
3. 远端 NewAPI 台子的数据必须按台子隔离：key 池、作业、日志、渠道/用户/日志列表都不能串。
4. 提交前必须运行 `npm run check` 和 `git diff --check`。
5. Git 作者必须使用本仓库本地配置：`LickJCR <Lick.JCR@gmail.com>`。

## 常用命令

```bash
npm run build
npm run check
git diff --check
```

## 快速导航

- 索引：`../L2#Index/toc.md`
- 元规范：`../L3#Standards/standards/00.meta-01.core.md`
- 代码大小规范：`../L3#Standards/standards/06.quality-01.size.md`

