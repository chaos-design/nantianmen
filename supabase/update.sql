-- ===========================================================================
-- 增量更新脚本：全局公告轮播槽位
-- ===========================================================================
--
-- 用途
--   供「已经执行过早期版本 platform.sql」的数据库补齐本次新增的公告功能。
--   全新环境请直接执行 platform.sql 的完整内容，不需要本文件。
--
-- 与 platform.sql 的关系
--   platform.sql 仍然是唯一的初始化入口和唯一事实来源。
--   本文件只包含 platform.sql 中与 public.announcements 相关的语句，
--   两者内容保持逐字一致。修改公告表结构时必须同步修改两个文件，
--   否则数据库结构会出现两个来源。
--
-- 幂等性
--   全部语句可重复执行：create table/index 使用 if not exists，
--   insert 使用 on conflict do nothing，RLS 收敛语句可重复应用。
--   重复执行不会破坏已有数据，也不会覆盖管理员已修改的公告内容。
--
-- 执行后校验
--   select count(*) from public.announcements;                  -- 期望 >= 1
--   select relrowsecurity from pg_class
--     where relname = 'announcements';                          -- 期望 true
--   select has_table_privilege('anon', 'public.announcements'); -- 期望 false
--
-- 注意
--   PostgREST 需要刷新 schema cache 才能识别新表。
--   建表后若仍返回 PGRST205（找不到表），等待片刻重试，不要据此判断建表失败。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 公告表
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
-- 查询索引
-- ---------------------------------------------------------------------------
create index if not exists announcements_sort_order_idx
  on public.announcements (sort_order, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS 和权限。
-- 与既有业务表一致：表级 revoke 阻断 Data API，
-- 开启 RLS 但不建 policy 保证权限泄漏时仍无行可见，service_role 走 grant。
-- ---------------------------------------------------------------------------
alter table public.announcements enable row level security;

revoke all on table public.announcements from anon, authenticated;

grant all on table public.announcements to service_role;