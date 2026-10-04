-- Résumé Lab 完整 Supabase 初始化脚本。
--
-- 使用方式：
--   在新环境的 Supabase SQL Editor 中完整执行本文件。
--   当前数据库对象使用可重复执行的创建方式，开发、测试和生产环境统一
--   使用本文件初始化。本文件不代替旧数据库的增量升级方案。
--
-- 安全模型：
--   浏览器仅使用 Supabase Auth，不直接读写业务表或私有 Storage Bucket。
--   Next.js Route Handlers 负责验证用户身份、执行所有者或管理员授权，
--   再使用仅限服务端的 service role key 访问 PostgreSQL 和 Storage。
--
--   所有业务表均启用 RLS，且不为 anon 或 authenticated 创建策略，
--   因此 Data API 默认拒绝直接访问。service_role 被显式授予表和函数权限，
--   该密钥必须只保存在服务端运行环境变量中。

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 注册邮箱域名限制。
-- ---------------------------------------------------------------------------
-- 前端会先做相同校验；此 Hook 在 Auth 创建用户前执行，防止绕过页面直接注册。
create or replace function public.restrict_registration_email_domain(event jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(split_part(coalesce(event->'user'->>'email', ''), '@', 2)) = any (
      array[
        '126.com',
        '139.com',
        '163.com',
        '189.cn',
        'aliyun.com',
        'foxmail.com',
        'gmail.com',
        'hotmail.com',
        'icloud.com',
        'live.com',
        'me.com',
        'outlook.com',
        'proton.me',
        'protonmail.com',
        'qq.com',
        'sina.cn',
        'sina.com',
        'sohu.com',
        'wo.cn',
        'yahoo.com',
        'yeah.net'
      ]::text[]
    )
      then '{}'::jsonb
    else jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code',
        422,
        'message',
        'Unsupported registration email domain'
      )
    )
  end;
$$;

comment on function public.restrict_registration_email_domain(jsonb) is
  'Supabase Auth 创建用户前，仅允许常用邮箱服务商域名注册。';

grant usage on schema public to supabase_auth_admin;
revoke execute
  on function public.restrict_registration_email_domain(jsonb)
  from public, anon, authenticated;
grant execute
  on function public.restrict_registration_email_domain(jsonb)
  to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- 简历草稿主表。
-- ---------------------------------------------------------------------------
-- 每行表示一份可编辑简历草稿，draft_document 是编辑器的数据源。
-- 已发布分享页不直接读取草稿，而是读取 resume_publications 中的不可变快照。
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  public_slug text not null unique,
  edit_token_hash text,
  draft_document jsonb not null,
  draft_schema_version text not null,
  draft_version integer not null default 1 check (draft_version > 0),
  latest_publication_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.resumes is
  '可编辑简历草稿，由 Next.js 服务端路由统一控制访问。';
comment on column public.resumes.owner_id is
  '草稿所属的 Supabase Auth 用户 ID；空值仅保留给历史数据或固定预览数据。';
comment on column public.resumes.public_slug is
  '匿名分享 URL 使用的不透明公开标识，不得包含草稿 ID 或所有者信息。';
comment on column public.resumes.edit_token_hash is
  '为兼容历史数据保留的旧编辑令牌哈希；当前主要使用邮箱认证。';
comment on column public.resumes.draft_document is
  '当前可编辑的 ResumeDocument JSON，由应用 Zod Schema 校验。';
comment on column public.resumes.draft_version is
  '乐观并发版本号，每次保存草稿时递增。';
comment on column public.resumes.latest_publication_id is
  '指向公开页面使用的最新不可变发布快照。';

-- ---------------------------------------------------------------------------
-- 不可变发布快照。
-- ---------------------------------------------------------------------------
-- 发布时将当前草稿 JSON 复制到本表，并在同一次数据库函数调用中更新
-- resumes.latest_publication_id。
create table if not exists public.resume_publications (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  publication_version integer not null check (publication_version > 0),
  published_document jsonb not null,
  schema_version text not null,
  template_id text not null,
  published_at timestamptz not null default now(),
  unique (resume_id, publication_version)
);

comment on table public.resume_publications is
  '匿名 A4 和 Web 分享页使用的不可变发布快照。';
comment on column public.resume_publications.published_document is
  '发布时从草稿复制并冻结的 ResumeDocument JSON。';
comment on column public.resume_publications.publication_version is
  '每份简历单调递增的发布版本，由 publish_resume_snapshot 分配。';
comment on column public.resume_publications.template_id is
  '为便于查询和审计而冗余保存的 A4 模板 ID。';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resumes_latest_publication_fk'
      and conrelid = 'public.resumes'::regclass
  ) then
    alter table public.resumes
      add constraint resumes_latest_publication_fk
      foreign key (latest_publication_id)
      references public.resume_publications(id)
      on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 私有图片资源元数据。
-- ---------------------------------------------------------------------------
-- 二进制内容存储在私有 Storage Bucket 中，本表记录归属、尺寸和检索元数据。
-- 只有最新发布快照 JSON 实际引用资源 ID 时，公开页面才允许读取该资源。
create table if not exists public.resume_assets (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  storage_path text not null unique,
  asset_type text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size >= 0),
  original_name text not null default 'image',
  width integer not null default 1,
  height integer not null default 1,
  created_at timestamptz not null default now()
);

comment on table public.resume_assets is
  '存储在 Supabase Storage 中的私有简历图片资源元数据。';
comment on column public.resume_assets.storage_path is
  '私有 Storage 对象路径，当前格式为 <resume_id>/<asset_id>.<ext>。';
comment on column public.resume_assets.asset_type is
  '资源类别，当前支持值为 image。';
comment on column public.resume_assets.mime_type is
  '校验后的 MIME 类型，当前支持 image/png、image/jpeg 和 image/webp。';
comment on column public.resume_assets.byte_size is
  '校验后的上传字节数，应用限制每张图片不超过 5 MiB。';
comment on column public.resume_assets.original_name is
  '经过清理的原始文件名，用于编辑器展示。';
comment on column public.resume_assets.width is
  '图片固有宽度，单位为像素，写入元数据前完成校验。';
comment on column public.resume_assets.height is
  '图片固有高度，单位为像素，写入元数据前完成校验。';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resume_assets_width_check'
      and conrelid = 'public.resume_assets'::regclass
  ) then
    alter table public.resume_assets
      add constraint resume_assets_width_check
      check (width between 1 and 6000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'resume_assets_height_check'
      and conrelid = 'public.resume_assets'::regclass
  ) then
    alter table public.resume_assets
      add constraint resume_assets_height_check
      check (height between 1 and 6000);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- AI 生成审计表。
-- ---------------------------------------------------------------------------
-- 应用仅存储精简的结构化审计数据，不存储 Provider API Key、完整提示词、
-- 完整简历 JSON、邮箱地址或电话号码。
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  task_type text not null,
  target_section_id text,
  input_summary jsonb not null default '{}'::jsonb,
  output jsonb not null,
  provider text not null,
  latency_ms integer not null check (latency_ms >= 0),
  created_at timestamptz not null default now()
);

comment on table public.ai_generations is
  '不包含密钥或完整简历内容的精简 AI 请求审计记录。';
comment on column public.ai_generations.input_summary is
  '不含个人信息的简要请求摘要，例如 Schema 版本和上下文数量。';
comment on column public.ai_generations.output is
  '精简的结构化输出摘要，例如建议数量或问题数量。';
comment on column public.ai_generations.provider is
  '返回给用户并用于基础观测的 Provider 或模型标识。';

-- ---------------------------------------------------------------------------
-- 可选模板注册表。
-- ---------------------------------------------------------------------------
-- 应用当前通过 TypeScript 内置模板定义。本表预留给未来的服务端模板注册能力，
-- 提前创建以保持 Schema 的向前兼容性。
create table if not exists public.templates (
  id text primary key,
  name text not null,
  category text not null,
  definition jsonb not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.templates is
  '为未来服务端管理模板定义预留的模板注册表。';
comment on column public.templates.definition is
  '用于未来动态加载模板的模板定义 JSON。';

-- ---------------------------------------------------------------------------
-- 全局公告轮播槽位。
-- 公告是平台级共享数据，没有归属用户；应用在服务端校验管理员身份后
-- 使用 service role 读写，浏览器始终不直接访问本表。
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info' check (level in ('info', 'success', 'warning', 'danger')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 240),
  link_label text not null default '' check (char_length(link_label) <= 24),
  link_href text not null default ''
    check (
      char_length(link_href) <= 500
      -- 使用 ~* 而不是 ~：应用侧 URL 解析会把协议归一化为小写，
      -- 这里必须同样接受 HTTP:// 这类大写写法，否则合法输入会被数据库拒绝。
      and (link_href = '' or link_href ~* '^(/|https?://)')
      and link_href not like '//%'
    ),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_link_pair_check check (
    (link_label = '') = (link_href = '')
  ),
  constraint announcements_time_window_check check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

comment on table public.announcements is
  '登录后对所有用户展示的全局公告轮播条目，只有管理员可以写入。';
comment on column public.announcements.level is
  '展示级别，决定轮播槽位的配色：info、success、warning、danger。';
comment on column public.announcements.enabled is
  '管理员停用开关。停用后对所有用户隐藏，与用户本地关闭无关。';
comment on column public.announcements.sort_order is
  '排序权重，数值越小越靠前。';
comment on column public.announcements.starts_at is
  '可选生效开始时间，为空表示不设下界。';
comment on column public.announcements.ends_at is
  '可选生效结束时间，为空表示不设上界，到达该时刻后不再展示。';
comment on column public.announcements.link_href is
  '可选公告链接，只允许站内绝对路径或 http(s) 地址，为空表示不提供链接。';

insert into public.announcements (id, level, title, body, sort_order)
values (
  '00000000-0000-4000-8000-00000000a001',
  'info',
  '欢迎使用 Résumé Lab',
  '所有简历数据都保存在你自己的账号下，草稿会自动保存。',
  0
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 应用查询路径所需索引。
-- ---------------------------------------------------------------------------
create index if not exists resumes_owner_updated_at_idx
  on public.resumes (owner_id, updated_at desc);
create index if not exists resume_publications_resume_id_idx
  on public.resume_publications (resume_id, publication_version desc);
create index if not exists ai_generations_resume_id_idx
  on public.ai_generations (resume_id, created_at desc);
create index if not exists resume_assets_resume_id_idx
  on public.resume_assets (resume_id);
create index if not exists announcements_sort_order_idx
  on public.announcements (sort_order, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS 和权限。
-- ---------------------------------------------------------------------------
alter table public.resumes enable row level security;
alter table public.resume_publications enable row level security;
alter table public.resume_assets enable row level security;
alter table public.ai_generations enable row level security;
alter table public.templates enable row level security;
alter table public.announcements enable row level security;

revoke all on table public.resumes from anon, authenticated;
revoke all on table public.resume_publications from anon, authenticated;
revoke all on table public.resume_assets from anon, authenticated;
revoke all on table public.ai_generations from anon, authenticated;
revoke all on table public.templates from anon, authenticated;
revoke all on table public.announcements from anon, authenticated;

grant all on table public.resumes to service_role;
grant all on table public.resume_publications to service_role;
grant all on table public.resume_assets to service_role;
grant all on table public.ai_generations to service_role;
grant all on table public.templates to service_role;
grant all on table public.announcements to service_role;

-- ---------------------------------------------------------------------------
-- 发布函数。
-- ---------------------------------------------------------------------------
-- 应用在确认操作者是简历所有者或管理员后调用本函数。
-- 函数在同一事务中完成发布版本分配、不可变快照写入和最新快照指针更新。
create or replace function public.publish_resume_snapshot(p_resume_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_resume public.resumes%rowtype;
  new_publication public.resume_publications%rowtype;
  next_version integer;
begin
  select *
    into current_resume
    from public.resumes
    where id = p_resume_id
    for update;

  if not found then
    raise exception 'RESUME_NOT_FOUND';
  end if;

  select coalesce(max(publication_version), 0) + 1
    into next_version
    from public.resume_publications
    where resume_id = p_resume_id;

  insert into public.resume_publications (
    resume_id,
    publication_version,
    published_document,
    schema_version,
    template_id
  )
  values (
    current_resume.id,
    next_version,
    current_resume.draft_document,
    current_resume.draft_schema_version,
    current_resume.draft_document #>> '{template,id}'
  )
  returning * into new_publication;

  update public.resumes
    set latest_publication_id = new_publication.id,
        updated_at = now()
    where id = p_resume_id
    returning * into current_resume;

  return jsonb_build_object(
    'resume', to_jsonb(current_resume),
    'publication', to_jsonb(new_publication)
  );
end;
$$;

comment on function public.publish_resume_snapshot(uuid) is
  '以原子方式创建不可变发布快照并更新 resumes.latest_publication_id。';

revoke all on function public.publish_resume_snapshot(uuid) from public;
revoke all on function public.publish_resume_snapshot(uuid) from anon;
revoke all on function public.publish_resume_snapshot(uuid) from authenticated;
grant execute on function public.publish_resume_snapshot(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 私有 Storage Bucket。
-- ---------------------------------------------------------------------------
-- 二进制资源通过 Next.js Route Handlers 代理访问。
-- Bucket 保持私有，并使用与应用一致的 MIME 类型和文件大小限制。
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'resume-assets',
  'resume-assets',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
