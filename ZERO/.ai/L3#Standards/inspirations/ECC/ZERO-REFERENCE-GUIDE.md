# ECC 参考指南（针对 ZERO）

> **文档定位**：说明如何从 ECC 中提取对 ZERO 有价值的内容

---

## 📖 关于 ECC

**Everything Claude Code (ECC)** 是一个为 Claude Code CLI 用户设计的配置集合。

- **作者**：Affaan Mustafa（Anthropic x Forum Ventures 黑客松获胜者）
- **GitHub**：https://github.com/affaan-m/everything-claude-code
- **实战经验**：10+ 个月日常使用
- **Star 数**：25,000+

---

## 🎯 核心差异

| 维度 | ZERO | ECC |
|------|------|-----|
| **定位** | 路径驱动的开发规范框架 | Claude Code 工作流配置 |
| **核心价值** | 统一命名和架构规范 | 优化 AI 辅助开发体验 |
| **技术依赖** | 技术栈无关 | 强依赖 Claude Code CLI |
| **自动化** | 低（bash 脚本） | 高（hooks 自动触发） |
| **适用场景** | 任何 Web 项目 | Claude Code 用户 |

---

## 📚 可参考的内容

### 🟢 高价值参考（技术栈无关）

#### 1. 代码风格规范
**位置**：`skills/coding-standards/SKILL.md`

**可参考内容**：
- ✅ 不可变性原则（CRITICAL 级别）
- ✅ 嵌套深度限制（最大 4 层）
- ✅ 输入验证规范（Zod schema）
- ✅ 代码质量检查清单（8 项）
- ✅ KISS/DRY/YAGNI 原则
- ✅ 代码异味检测

**何时参考**：
- ZERO 需要补充代码风格规范时
- 需要建立代码审查标准时

---

#### 2. 测试规范
**位置**：`skills/tdd-workflow/SKILL.md` + `rules/testing.md`

**可参考内容**：
- ✅ TDD 工作流（RED → GREEN → IMPROVE → VERIFY）
- ✅ 80% 测试覆盖率要求
- ✅ 三种测试类型（单元/集成/E2E）
- ✅ 测试文件组织结构
- ✅ Mock 策略

**何时参考**：
- ZERO 需要建立测试规范时
- 需要提高代码质量时

---

#### 3. 安全规范
**位置**：`skills/security-review/SKILL.md` + `rules/security.md`

**可参考内容**：
- ✅ 10 大安全检查清单
- ✅ 密钥管理规范
- ✅ SQL 注入防护
- ✅ XSS/CSRF 防护
- ✅ 认证授权模式
- ✅ 速率限制

**何时参考**：
- ZERO 需要完善安全规范时
- 遇到安全问题时

---

#### 4. 后端开发模式
**位置**：`skills/backend-patterns/SKILL.md`

**可参考内容**：
- ✅ Repository 模式
- ✅ Service 层模式
- ✅ 中间件模式
- ✅ 缓存策略
- ✅ 错误处理模式
- ✅ API 响应格式

**何时参考**：
- ZERO 需要补充后端模式时
- 需要统一 API 设计时

---

#### 5. 前端开发模式
**位置**：`skills/frontend-patterns/SKILL.md`

**可参考内容**：
- ✅ 组件模式（Composition、Compound Components）
- ✅ 自定义 Hooks（useDebounce、useQuery）
- ✅ 状态管理模式
- ✅ 性能优化（Memoization、虚拟滚动）
- ✅ 表单处理
- ✅ 错误边界

**何时参考**：
- ZERO 需要补充前端模式时
- 需要性能优化指导时

---

#### 6. Git 工作流
**位置**：`rules/git-workflow.md`

**可参考内容**：
- ✅ PR 创建完整流程
- ✅ 功能实现工作流（Plan → TDD → Review → Commit）
- ✅ 使用 `git diff [base]...HEAD` 分析完整变更

**何时参考**：
- ZERO 需要完善 Git 工作流时
- 需要规范 PR 流程时

---

### 🟡 中等价值参考（需适配）

#### 7. 性能优化
**位置**：`skills/frontend-patterns/SKILL.md` + `rules/performance.md`

**可参考内容**：
- 前端性能优化技巧
- 数据库查询优化
- 缓存策略

**注意事项**：
- ECC 包含 Claude 模型选择策略（Haiku/Sonnet/Opus），这部分不适用于 ZERO
- 需要提取技术栈无关的性能优化原则

---

#### 8. 注释与文档
**位置**：`skills/coding-standards/SKILL.md`

**可参考内容**：
- 何时写注释（解释 WHY 而非 WHAT）
- JSDoc 规范

**注意事项**：
- ZERO 已有文件头注释规范，可作为补充

---

### 🔴 不适合参考（Claude Code 专属）

以下内容与 Claude Code CLI 强相关，不适合 ZERO：

| 内容 | 原因 |
|------|------|
| **Agents（子代理）** | 依赖 Claude Code CLI 的 agent 系统 |
| **Hooks（事件触发器）** | 依赖 Claude Code CLI 的 hooks 系统 |
| **Commands（斜杠命令）** | 依赖 Claude Code CLI 的命令系统 |
| **MCP 配置** | 依赖 Claude Code CLI 的 MCP 集成 |
| **上下文管理技巧** | 针对 Claude Code CLI 的 token 优化 |
| **并行化策略** | 针对多个 Claude 实例的工作流 |
| **持续学习系统** | 依赖 Claude Code CLI 的 session 管理 |

---

## 🔍 如何使用这个参考

### 步骤 1：发现问题
在实际开发中遇到具体问题，例如：
- "代码中经常出现对象突变导致的 bug"
- "缺少统一的测试规范"
- "API 响应格式不统一"

### 步骤 2：查找参考
在 ECC 中查找相关内容：
- 对象突变问题 → 查看 `skills/coding-standards/SKILL.md` 的不可变性原则
- 测试规范 → 查看 `skills/tdd-workflow/SKILL.md`
- API 响应格式 → 查看 `skills/backend-patterns/SKILL.md`

### 步骤 3：提炼原则
提取技术栈无关的核心原则：
- 不可变性：使用展开运算符创建新对象
- TDD：RED → GREEN → IMPROVE → VERIFY
- API 响应：统一的 success/data/error 结构

### 步骤 4：适配 ZERO
根据 ZERO 的定位进行适配：
- 保持"路径为王"的核心理念
- 使用 ZERO 的文档格式
- 添加 ZERO 特有的示例

### 步骤 5：小步验证
在小范围内试验新规范：
- 在一个模块中试用
- 收集反馈
- 调整优化

### 步骤 6：更新文档
确认有效后更新 ZERO 文档：
- 创建新规范文档
- 更新 README 导航
- 创建 condensed 版本

---

## 📝 参考示例

### 示例 1：补充不可变性规范

**问题**：代码中经常出现对象突变导致的 bug

**参考 ECC**：`skills/coding-standards/SKILL.md` 的不可变性原则

**提炼原则**：
- 禁止直接修改对象和数组
- 使用展开运算符创建新对象
- 标注为 CRITICAL 级别

**适配 ZERO**：
创建 `06.quality-05.code-style.md`，包含：
- 不可变性原则说明
- 正确/错误示例对比
- 常见场景处理方法
- 检查清单

---

### 示例 2：建立测试规范

**问题**：项目缺少统一的测试规范

**参考 ECC**：`skills/tdd-workflow/SKILL.md` + `rules/testing.md`

**提炼原则**：
- TDD 工作流
- 80% 覆盖率要求
- 三种测试类型

**适配 ZERO**：
创建 `06.quality-06.testing.md`，包含：
- TDD 工作流步骤
- 测试类型说明
- 测试文件组织
- 覆盖率要求

---

## ⚠️ 注意事项

1. **不要照搬**：ECC 是为 Claude Code CLI 设计的，很多内容不适用于 ZERO
2. **保持特色**：ZERO 的核心是"路径为王"，不要被其他框架带偏
3. **渐进演进**：小步试验，验证有效后再推广
4. **技术栈无关**：只提取技术栈无关的原则
5. **实战验证**：在实际项目中验证效果

---

## 🔗 相关链接

- **ECC GitHub**：https://github.com/affaan-m/everything-claude-code
- **ECC Shortform Guide**：`./the-shortform-guide.md`
- **ECC Longform Guide**：`./the-longform-guide.md`
- **ZERO 主文档**：`../../README.md`

---

**最后更新**：2025-01-31
