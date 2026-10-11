# AGENTS.md

本文面向在 Résumé Lab 仓库内工作的 AI Coding Agent。它描述项目事实、协作规则、质量门禁和禁止事项，目标是让任何 Agent 在改动代码或文档前先理解系统边界。

## 适用范围

- 本文件适用于仓库根目录及其所有子目录。
- 如果未来某个子目录新增更近的 `AGENTS.md`，更近的文件优先约束该子树。
- 用户的最新明确指令优先级高于本文，但不得违反安全、隐私和项目硬性约束。

## 项目概览

Résumé Lab 是一个基于结构化 JSON、可视化编辑器和发布快照的简历可视化平台。

核心路径：

- `src/app/`：Next.js App Router 页面、布局和 Route Handlers。
- `src/features/`：编辑器、渲染器、模板库、工作台、认证 UI 和着陆页功能。
- `src/components/ui/`：基础 UI 组件。
- `src/shared/`：客户端和服务端共享的简历 Schema、模板配置和设计令牌。
- `src/server/`：认证、领域服务、仓储、资产存储、AI Gateway 和服务端配置。
- `supabase/platform.sql`：唯一 Supabase 初始化脚本。
- `docs/`：中文开发、部署和历史设计文档。
- `tests/e2e/`：Playwright 端到端测试。
- `scripts/`：开发和运维辅助脚本。

运行边界：

- 开发联调和生产运行使用 Supabase。
- 文件 Repository 仅用于自动化测试和隔离测试。
- 浏览器只通过 Supabase Auth 建立会话，不直接写业务表或私有 Storage。
- 所有业务写操作必须经过 Next.js 服务端，由服务端校验身份、所有权和管理员权限。
- 公开分享页只读取最近一次发布生成的不可变快照。

## 必守规则

- 不运行任何 Git 命令。不要使用 `git status`、`git diff`、`git checkout`、`git reset`、`git commit` 等命令。
- 不使用 ESLint。静态检查统一使用 Biome。
- 不读取、打印、复制或提交 `.env` 中的真实密钥。需要说明变量时只参考 `.env.example`。
- 不把 `SUPABASE_SERVICE_ROLE_KEY`、AI Key 或其他服务端密钥写入浏览器代码、README、测试快照或日志。
- 不把 `.next/`、`coverage/`、`.data/`、`playwright-report/`、`test-results/`、`node_modules/` 等生成目录作为手工改动对象。
- 不在生产路径引入本地文件 Repository；它只属于测试路径。
- 不新增分散的 Supabase 迁移或种子 SQL；项目唯一初始化入口是 `supabase/platform.sql`。
  唯一例外是 `supabase/update.sql`：它只摘录 `platform.sql` 中 `public.announcements`
  的语句，供已初始化的库补齐公告表。它不是第二事实来源，改公告表结构时必须
  同步改两个文件。
- 不用兜底模板伪造 AI 结果。AI 未配置、超时或输出结构非法时必须明确报错。
- 数字输入组件不得自动修正用户输入。失焦或回车时仅在非法时抛错或保留原状。
- 图片尺寸允许宽高为 `0`；边界校验需要满足 A4 画布限制。

## 常用命令

安装依赖：

```bash
pnpm install --frozen-lockfile
```

本地开发：

```bash
pnpm dev
```

质量检查：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm check:budget
```

端到端测试：

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

组合检查：

```bash
pnpm check
```

说明：

- 项目包管理器固定为 `pnpm@11.21.0`，使用 `pnpm-lock.yaml` 锁定依赖。
- `pnpm lint` 实际执行 `biome check .`。
- `pnpm lint:fix` 执行 `biome check --write .`。
- `pnpm format` 执行 `biome format --write .`。
- 覆盖率门禁只统计共享 Schema、认证和领域服务，语句/函数/行不低于 90%，分支不低于 75%。

## 代码风格

- TypeScript 使用严格类型，不为省事引入 `any`。
- 前端文件名统一小写并使用连字符，例如 `resume-json-editor.tsx`。
- 函数名使用小驼峰，例如 `createResumeService`。
- React 组件、类型、接口使用符合 TypeScript/React 习惯的 PascalCase。
- 遵循 Biome 配置：2 空格缩进、双引号、按需分号、尾随逗号。
- 优先复用项目内已有 helper、domain service、repository adapter、UI primitive 和 design tokens。
- 保持模块边界清晰，不把服务端 Supabase service role 逻辑移入客户端。
- 新增复杂逻辑时优先拆到纯函数，并补单元测试。
- 只在代码不易自解释时添加简短注释，避免重复代码本身含义。

## React 和 Next.js 约定

- App Router 页面和 Route Handlers 位于 `src/app/`。
- 需要服务端密钥、所有权校验、发布事务或私有资产访问的逻辑必须留在服务端。
- 客户端组件只处理交互状态、会话驱动 UI、编辑器体验和本地预览。
- Supabase 浏览器客户端只用于认证会话，不直接操作业务表或私有 Storage。
- Monaco Editor 使用 `public/monaco/vs` 的本地托管资源，不随意改 CDN 加载方式。
- 缩放交互使用 `requestAnimationFrame`，并保持以鼠标位置为锚点的体验。
- 文本选择、输入框快捷键、拖拽排序等高频交互改动必须补回归测试。

## 简历 Schema 和模板规则

- 结构化简历数据以 `src/shared/resume-schema/` 为准，客户端和服务端共享同一套 Zod Schema。
- 模板系统以 `TemplateScheme` 和 `WebTemplateScheme` 配置为主，不为单个模板复制大段渲染逻辑。
- A4 模板变更需要关注分页、分栏、字体、间距、颜色和导出效果。
- Web 模板变更需要关注响应式布局、导航、空内容过滤、动效和可读性。
- 左右分栏模板中，左栏优先放联系方式、技能与证书。
- 如果左栏包含时间信息，时间必须独立成行。
- 后续页面若左侧分栏无内容，禁止显示序号、页码或占位符，只保留视觉背景。
- 创意分栏或深色模板必须确保正文高对比度，目标对比度大于 4.5:1。
- 分页逻辑遵循像素预算贪心算法，确保内容填满当前页后再创建新页。

## Supabase 和数据规则

- `supabase/platform.sql` 是唯一数据库初始化脚本，包含业务表、约束、索引、RLS、权限、认证 Hook、发布函数和私有 `resume-assets` Bucket。
- 所有业务表启用 RLS，且不向 `anon` 或 `authenticated` 开放业务表直连策略。
- `service_role` 只在 Next.js 服务端使用。
- 草稿保存通过 `PATCH /api/resumes/:id` 写入 `resumes.draft_document` 并递增 `draft_version`。
- 发布通过 `publish_resume_snapshot` 数据库函数在单个事务中生成不可变快照。
- 私有资源按 JWT 用户归属授权；公开资源只允许读取最新发布快照实际引用的文件。
- Storage 资源类型限制为 PNG、JPEG、WebP，单文件不超过 5 MiB。

## AI 功能规则

- 服务端 AI 入口位于 `src/server/ai/` 和相关 API Route。
- 全局 AI Provider 需要 `AI_MODEL_NAME`、`AI_BASE_URL`、`AI_API_KEY` 三项同时配置才启用。
- 全局 AI 配置会下发给可编辑用户浏览器，只能使用可轮换的最小权限 Key。
- 浏览器个人模型配置优先，且应保持用户本地隔离。
- Preview 账号不支持 AI。
- AI 建议必须由用户确认后再写入简历，不应自动覆盖用户内容。
- system prompt 整块交给用户编辑，服务端不做任何拼接：`composeAiSystemPrompt`
  对自定义内容原样返回。用户保存什么，模型就收到什么。
- prompt 里的「输出结构」一行是服务端 Zod 校验的硬依赖，删除后模型无法返回可解析结果。
  前端用 `findMissingStructureMarkers` 检测并在保存前提醒，但不阻止保存。

## 测试策略

- Schema、认证、领域服务、仓储、资产服务和 AI 解析逻辑优先补 Vitest。
- 编辑器交互、输入快捷键、模板缩略图、分页和布局行为优先补靠近功能的测试。
- 用户完整流程、登录、工作台、预览和分享页优先补 Playwright。
- 修复 Bug 时至少补一个能失败后通过的回归测试，除非改动纯文档。
- 大改共享 Schema、发布流程、权限边界或资源访问时，需要运行更完整的质量门禁。

## 文档规则

- 项目文档统一使用中文，包括 README、开发手册、部署手册、变更说明和设计说明。
- 需要面向英文读者或英文上下文 AI Agent 时，可以维护英文伴随文档，但中文文件仍是默认入口。
- README 面向首次了解项目的人，优先说明产品、启动、架构、环境、测试、部署、贡献和许可。
- `docs/development-guide.md` 面向日常开发细节。
- `docs/deployment-guide.md` 面向 Vercel、Supabase、GitHub Actions 和回滚发布。
- `supabase/README.md` 面向数据库初始化和安全边界。
- 新增环境变量时必须同步更新 `.env.example`、README 和相关开发/部署文档。
- 不在文档中出现真实域名、密钥、用户 UUID 或生产私有配置，除非用户明确要求且确认可公开。

## 改动前检查清单

开始改动前：

- 明确用户要的是代码、文档、审查、解释还是排障。
- 读取相关源文件和测试，不凭文件名猜测行为。
- 确认是否涉及服务端密钥、RLS、发布快照、资源授权或公开分享。
- 确认是否需要同步 README、开发手册、部署手册或 `.env.example`。

提交给用户前：

- 说明改了哪些文件和为什么。
- 说明运行了哪些检查，或为什么没有运行。
- 如果引入了限制、假设或未验证项，要明确列出。

## 禁止的实现方式

- 禁止绕过领域服务直接在 UI 中拼业务写请求。
- 禁止在客户端持久化服务端密钥。
- 禁止用字符串拼接替代已有 Schema、结构化解析或类型约束。
- 禁止为了通过测试削弱权限校验、RLS 假设或版本冲突处理。
- 禁止在生产代码中依赖测试账号、Playwright 注入变量或 `.data` 文件。
- 禁止把 AI 失败静默吞掉并展示看似成功的内容。
- 禁止顺手重构无关模块或批量改格式，除非用户明确要求。
