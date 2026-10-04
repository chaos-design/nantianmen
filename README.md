# Résumé Lab

[中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="docs/assets/readme-hero.svg" alt="Résumé Lab 产品概览" />
</p>

<p align="center"><em>Résumé Lab 将结构化简历内容复用到 A4 排版、Web 展示和公开分享链路。</em></p>

Résumé Lab 是一个面向简历创作、A4 排版和在线展示的可视化平台。它把简历内容保存为结构化 JSON，让用户在表单、JSON、A4 画布、Web 页面和公开分享之间复用同一份职业档案。

项目更关注真实页面体验，而不是只提供模板文件：用户可以先选择模板，再进入工作台维护内容；可以在编辑器里同时查看结构化字段和分页结果；可以发布不可变快照，让外部访问者看到稳定的 A4 或 Web 分享页。

账号体系支持邮箱密码注册、邮箱确认、登录和密码恢复。新账号仅允许常用邮箱服务商域名，
并由注册表单与 Supabase Auth Hook 执行双层校验。

## 页面功能

| 页面         | 预览                                                                           | 功能说明                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 着陆页        | ![Résumé Lab 着陆页](docs/assets/screenshots/landing-page.png)                  | 着陆页集中展示产品价值、模板效果和从内容维护到多端输出的完整路径，用产品叙事解释“内容维护一次，A4 和 Web 多端复用”；展示 24 套真实 A4 模板、模板轮播、工作流对比和最终输出，并适配 Preview 只读体验、移动端横向浏览和减少动画偏好。 |
| 工作台与模板库    | ![Résumé Lab 工作台模板库](docs/assets/screenshots/workspace-template-library.png) | 工作台先引导用户选择 A4 模板，再进入简历创建、筛选、管理和预览流程。新用户先进入模板库，选择模板后创建简历；已有简历可按模板、发布状态和关键词筛选，支持编辑、A4 预览、Web 预览、Web 分享、删除和批量管理，Preview 账号保持只读。登录后页首展示全局公告轮播，用户可逐条关闭，管理员可配置公告内容、级别、生效时间与启停状态。    |
| 可视化编辑器     | ![Résumé Lab 可视化编辑器](docs/assets/screenshots/editor-workspace.png)           | 编辑器把结构化表单、JSON 输入、A4 实时分页画布和样式资源检查器放在同一工作区，支持表单填写、JSON 批量编辑和导入导出、A4 实时分页、文档级排版、区块级样式、图片资源管理、自动保存、撤销重做、乐观并发、AI 内容建议和发布分享。        |
| A4 全页预览    | ![Résumé Lab A4 全页预览](docs/assets/screenshots/a4-preview.png)                | A4 全页预览用于核对最终投递版简历的分页、版式和打印导出效果，按 A4 比例展示最终简历，支持多页查看、页面缩放、返回编辑器和浏览器打印导出；分页逻辑按像素预算贪心填充当前页，分栏背景和图片资源按发布快照稳定渲染。                    |
| Web 简历生成器  | ![Résumé Lab Web 简历生成器](docs/assets/screenshots/web-resume-builder.png)      | Web 简历生成器用同一份结构化内容切换 40 套在线展示风格并预览响应式效果。同一份结构化内容可生成 Web 展示页，支持 40 套 Web 风格、导航进度、滚动定位、主题动效、响应式布局、空内容过滤、最大化预览、复制分享链接和返回编辑器。       |
| 公开 Web 分享页 | ![Résumé Lab 公开 Web 分享页](docs/assets/screenshots/public-web-share.png)       | 公开 Web 分享页面向外部访问者展示最近一次发布生成的稳定快照，无需登录即可访问；A4 分享页适合正式投递，Web 分享页适合在线展示和快速浏览，草稿修改不会自动影响已分享版本。               |

## 核心模块

| 模块         | 说明                                                                    |
| ---------- | --------------------------------------------------------------------- |
| 结构化 Schema | `src/shared/resume-schema/` 统一约束客户端、服务端和 JSON 编辑器的数据结构                |
| AI 上下文     | `llm.txt` 是面向大语言模型的导航索引；`AGENTS.md` 是面向在本仓库工作的 AI Agent 的强制规则     |
| A4 模板系统    | `src/shared/resume-template/template-schemes.ts` 管理 24 套 A4 模板配置      |
| Web 模板系统   | `src/shared/resume-template/web-template-schemes.ts` 管理 40 套 Web 风格配置 |
| 编辑器        | `src/features/resume-editor/` 负责表单、JSON、样式、资源、AI 和保存体验                |
| 渲染器        | `src/features/resume-renderer/` 负责 A4 分页、公开页面和 Web 简历渲染               |
| 工作台        | `src/features/workspace/` 负责模板选择、简历列表、筛选和批量管理                         |
| 账号认证       | `src/features/auth/` 负责常用邮箱注册限制、登录、邮箱确认和密码恢复                       |
| 平台公告       | `src/features/announcement/` 和 `src/shared/announcement/` 负责登录后公告轮播、用户本地关闭和管理员配置 |
| 领域服务       | `src/server/domain/` 负责所有权、管理员权限、Preview 只读和发布流程                      |
| 持久化        | `src/server/repositories/` 和 `src/server/assets/` 适配 Supabase 与测试文件后端 |
| 数据库        | `supabase/platform.sql` 是唯一初始化脚本，包含表、索引、RLS、认证 Hook、函数和私有 Bucket；`supabase/update.sql` 仅用于给已有库补齐公告表     |

## 注册邮箱限制

新账号允许以下常用邮箱域名：

```text
qq.com
163.com / 126.com / yeah.net
foxmail.com / sina.com / sina.cn / sohu.com / aliyun.com
139.com / 189.cn / wo.cn
gmail.com / outlook.com / hotmail.com / live.com
icloud.com / me.com / yahoo.com / proton.me / protonmail.com
```

该规则只限制新账号注册，不影响已有账号登录、邮箱验证码登录或找回密码。前端负责即时反馈，
`supabase/platform.sql` 中的 `restrict_registration_email_domain` Hook 负责服务端最终校验。

## 如何开发

日常开发从 Node.js 22.13 以上、pnpm 和一个独立的 Supabase 开发项目开始。首次接入时，先执行 Supabase 初始化脚本，再复制环境变量模板并填写本地开发值。开发联调和生产运行都使用 Supabase；文件后端只用于自动化测试和隔离测试。

推荐开发顺序：先在工作台创建样例简历，再进入编辑器验证表单、JSON、A4 画布和 Web 生成器。涉及 Schema、权限、发布、资源或 AI 的改动，应同步查看对应的服务端领域服务和测试。涉及页面体验的改动，应同时检查桌面端、移动端、减少动画偏好和 Preview 只读模式。

详细命令、环境变量、分支流程、测试策略和排障方式见 [开发共享手册](docs/development-guide.md)。AI 辅助开发时只使用根目录 [AGENTS.md](AGENTS.md) 作为规则入口。

## 如何部署

项目使用 Vercel 托管 Next.js 应用，使用 Supabase 提供 Auth、PostgreSQL 和私有 Storage。推送代码到 Vercel 已关联的 Git 仓库即触发自动部署：`main` 部署到 Production，其他分支和 PR 生成 Preview Deployment。构建命令由仓库根目录的 `vercel.json` 固定，Node 版本由 `package.json` 的 `engines` 声明。

GitHub Actions 负责质量门禁（Biome、TypeScript、Vitest、Playwright）和可审计的构建归档与 Release，两条通道职责分离。

部署前需要准备三类环境：开发环境用于本地联调，测试环境用于 Vercel Preview 和集成验证，生产环境用于真实用户流量。三个环境应使用不同 Supabase 项目，Preview 和 Production 不共享 service role key、数据库或 Storage。

部署流程概览：

1. 在目标 Supabase 项目执行 `supabase/platform.sql` 的完整内容。
2. 在 Supabase Auth 中启用 Email Provider 和邮箱确认，并配置 Site URL 与 `/auth/callback` 回调地址。
3. 启用 Before User Created Hook，并绑定 `public.restrict_registration_email_domain`。
4. 在 Vercel 中导入并关联本仓库，Framework Preset 选择 Next.js，Root Directory 保持仓库根目录。
5. 在 Vercel Project Settings 中为 Development、Preview 和 Production 分别配置环境变量。
6. 在 GitHub 分支保护中把 `quality` 和 `e2e` 设为必需检查，确保只有通过测试的代码才能合并。
7. 需要版本化归档时，在 GitHub Environments 中配置 Vercel 凭据，启用 `publish.yml`。
8. 生产故障优先回滚到已验证的 Vercel Deployment，再定位根因。

完整发布、回滚、监控和手动部署流程见 [部署手册](docs/deployment-guide.md)。Supabase 初始化和安全检查见 [Supabase SQL 说明](supabase/README.md)。

## 数据与权限边界

- 浏览器只通过 Supabase Auth 建立会话，不直接写业务表或私有 Storage。
- 登录界面当前只展示账号密码方式；邮箱验证码实现仍保留，但入口暂时隐藏。
- 登录或注册前，需要勾选同意《服务条款》与《隐私政策》。
- 注册仅接受常用邮箱服务商域名，使用邮箱和密码创建账号并发送确认链接；用户打开确认链接后通过 `/auth/callback` 建立会话并登录。
- 找回密码会向已注册邮箱发送恢复链接；链接通过 `/auth/callback` 建立恢复会话，用户设置新密码后返回原目标页面。
- 所有业务写操作经过 Next.js Route Handlers，并在服务端验证 JWT、所有权、管理员权限和 Same-Origin。
- 草稿保存写入 `resumes.draft_document` 并递增版本号。
- 发布通过 `publish_resume_snapshot` 数据库函数创建不可变快照。
- 私有图片按简历归属授权，公开图片只允许读取最新发布快照实际引用的资源。
- Preview 账号只能查看固定样例，不支持保存、发布、创建、删除或 AI。
- 全局 AI Provider 只有在模型名、Base URL 和 API Key 同时配置时才启用，建议使用可轮换的最小权限 Key。

## 文档入口

| 文档                                                                                               | 说明                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------ |
| [README.en.md](README.en.md)                                                                     | 英文版项目介绍                              |
| [AGENTS.md](AGENTS.md)                                                                           | 唯一 AI Coding Agent 规则文件              |
| [docs/development-guide.md](docs/development-guide.md) / [English](docs/development-guide.en.md) | 本地开发、测试、代码风格和排障                      |
| [docs/deployment-guide.md](docs/deployment-guide.md) / [English](docs/deployment-guide.en.md)    | Vercel、Supabase、GitHub Actions、发布和回滚 |
| [supabase/README.md](supabase/README.md) / [English](supabase/README.en.md)                      | Supabase 初始化脚本说明                     |
| [LICENSE](LICENSE)                                                                               | Apache License 2.0                   |

## 开源许可

本项目采用 [Apache License 2.0](LICENSE)。`package.json` 中的 `private: true` 仅用于防止误发布包，不影响仓库开源许可。
