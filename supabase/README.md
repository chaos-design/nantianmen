# Supabase SQL 说明

[中文](README.md) | [English](README.en.md)

本目录的初始化入口只有 `platform.sql`。新建开发、测试或生产环境时，均使用该文件完整初始化 Supabase 数据库、Auth Hook 和 Storage。

`update.sql` 是给**已存在的数据库**补齐新功能用的增量脚本，不参与新环境初始化，也不改变 `platform.sql` 作为唯一事实来源的地位。

## 目录内容

| 路径 | 说明 |
| --- | --- |
| `platform.sql` | 唯一 SQL 初始化脚本，包含表结构、约束、索引、RLS、权限、认证 Hook、发布函数和私有 Storage Bucket |
| `update.sql` | 增量脚本，仅包含 `platform.sql` 中与 `public.announcements` 相关的语句，供旧库补齐公告功能；全新环境不需要执行 |
| `config.toml` | Supabase CLI 本地服务配置，不负责自动创建业务表 |
| `.gitignore` | Supabase CLI 本地临时文件忽略规则 |

## 初始化步骤

1. 打开目标 Supabase 项目。
2. 进入 SQL Editor。
3. 粘贴并执行 `platform.sql` 的完整内容。
4. 检查执行结果，确认没有未处理错误。
5. 启用 Email Provider 和邮箱确认，并按应用环境配置 Site URL 与 Redirect URLs。
6. 在 Authentication → Hooks 启用 Before User Created Hook，选择 Postgres 函数
   `public.restrict_registration_email_domain`。

`platform.sql` 使用可重复执行的对象创建方式，主要用于新环境完整初始化。它不代替旧数据库的增量升级方案；已有环境涉及字段、约束或数据变更时，必须先在测试项目评估并准备专用变更 SQL。

## 初始化内容

执行 `platform.sql` 后会创建或配置：

- 简历草稿、发布快照、资源元数据、AI 审计和全局公告相关业务表。
- 工作台、公开分享、资源读取和 AI 审计查询所需索引。
- 表约束和外键约束。
- Row Level Security 和直接角色权限收敛。
- 限制注册邮箱域名的 `restrict_registration_email_domain` Auth Hook 函数。
- `publish_resume_snapshot` 事务函数。
- 私有 `resume-assets` Storage Bucket。
- 图片类型、大小和访问边界相关策略。

## 注册邮箱域名

新账号仅允许以下域名：

```text
qq.com
163.com / 126.com / yeah.net
foxmail.com / sina.com / sina.cn / sohu.com / aliyun.com
139.com / 189.cn / wo.cn
gmail.com / outlook.com / hotmail.com / live.com
icloud.com / me.com / yahoo.com / proton.me / protonmail.com
```

前端注册表单会先执行同一规则；`platform.sql` 创建
`public.restrict_registration_email_domain`，用于阻止绕过页面的直接注册请求。该函数创建
后仍需在 Authentication → Hooks 中绑定为 Before User Created Hook。此规则不影响已有账号
登录、邮箱验证码登录和找回密码。

## 本地 CLI 行为

`config.toml` 已关闭自动迁移和种子加载，因此 `supabase db reset` 不会自动创建项目业务表。需要重建本地环境时，应在本地 SQL Editor 中重新执行 `platform.sql` 的完整内容。

项目不维护拆分迁移或种子 SQL，避免同一数据库结构存在多个初始化来源。`update.sql` 是唯一的例外，它只是 `platform.sql` 中公告相关语句的摘录，用于把已初始化的库升级到当前结构；修改公告表结构时必须同步修改两个文件。

## 增量更新

已初始化的数据库需要升级到当前结构时，在 SQL Editor 执行 `update.sql` 的完整内容。脚本可重复执行，不会覆盖管理员已修改的公告内容。

执行后若接口仍返回 `PGRST205`（找不到表），是 PostgREST schema cache 尚未刷新，等待片刻重试即可，不要据此判断建表失败。

## 执行后检查

完成初始化后至少检查：

- `resumes`、`resume_publications`、`resume_assets`、`announcements` 等业务表已存在。
- `announcements` 表已写入一条欢迎公告。
- 所有业务表已启用 Row Level Security。
- `anon` 和 `authenticated` 没有业务表直连权限。
- Before User Created Hook 已绑定 `public.restrict_registration_email_domain`。
- `publish_resume_snapshot` 只允许 `service_role` 执行。
- `resume-assets` Bucket 存在且保持私有。
- Storage 限制 PNG、JPEG、WebP，单文件不超过 5 MiB。

## 安全要求

- `SUPABASE_SERVICE_ROLE_KEY` 只能配置在服务端环境变量、Vercel Environment Variables 或 GitHub Secrets 中。
- 不要把 service role key 写入浏览器代码、SQL 文件、README 或 Issue。
- 生产变更前先在测试 Supabase 项目完整验证。
- 删除列、修改类型或重写数据前，必须准备可验证的回滚方案。
- 生产环境应启用备份和 Point-in-Time Recovery 策略。
