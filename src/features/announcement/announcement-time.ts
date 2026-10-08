/**
 * 公告生效时间的本地时间换算。
 *
 * 公告的开始/结束时间在库里是 UTC ISO 字符串，管理员在界面上按本地时间填写，
 * 因此所有换算都必须走「本地年月日时分 → 本地 Date → ISO」这一条路径，
 * 不能用 `new Date("YYYY-MM-DDTHH:mm")`，那条路会按 UTC 解析并偏移时区。
 */

export interface AnnouncementDateTimeParts {
  /** 只使用年月日，时分由 hour/minute 单独承载。 */
  date: Date
  hour: number
  minute: number
}

/** 公告时间选择器的分钟步长。5 分钟足够表达公告窗口，也避免 60 项下拉。 */
export const announcementMinuteStep = 5

/**
 * 未设置时间时首次选择的默认时刻。
 *
 * 单独导出常量而不是让调用方各调一次 `createDefaultAnnouncementParts()`：
 * 那个函数会求值 `new Date()`，在模块顶层调用等于把「导入时刻」固化下来。
 */
export const announcementDefaultHour = 9
export const announcementDefaultMinute = 0

/** 分钟下拉的候选项。 */
export const announcementMinuteOptions = Array.from(
  { length: 60 / announcementMinuteStep },
  (_, index) => index * announcementMinuteStep,
)

/** 把 UTC ISO 拆成本地年月日时分；无效或空值返回 null。 */
export function readAnnouncementDateTimeParts(
  iso: string | null,
): AnnouncementDateTimeParts | null {
  if (!iso) {
    return null
  }
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return {
    date: parsed,
    hour: parsed.getHours(),
    minute: parsed.getMinutes(),
  }
}

/** 把本地年月日时分组装成 UTC ISO；时间不完整时返回 null。 */
export function composeAnnouncementIso(
  parts: AnnouncementDateTimeParts | null,
): string | null {
  if (!parts) {
    return null
  }
  const composed = new Date(
    parts.date.getFullYear(),
    parts.date.getMonth(),
    parts.date.getDate(),
    parts.hour,
    parts.minute,
    0,
    0,
  )
  return Number.isNaN(composed.getTime()) ? null : composed.toISOString()
}

/** 触发按钮上显示的本地时间文本。 */
export function formatAnnouncementDateTime(iso: string | null): string {
  const parts = readAnnouncementDateTimeParts(iso)
  if (!parts) {
    return ""
  }
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${parts.date.getFullYear()}-${pad(parts.date.getMonth() + 1)}-${pad(
    parts.date.getDate(),
  )} ${pad(parts.hour)}:${pad(parts.minute)}`
}

/**
 * 列表里展示的生效时间窗口。
 *
 * 两端都为空表示不设边界，文案必须写出来而不是留白：
 * 管理员需要区分「长期有效」和「还没配置过」，留白会读成后者。
 */
export function formatAnnouncementWindow(
  startsAt: string | null,
  endsAt: string | null,
): string {
  const start = formatAnnouncementDateTime(startsAt)
  const end = formatAnnouncementDateTime(endsAt)
  if (start && end) {
    return `${start} 至 ${end}`
  }
  if (start) {
    return `${start} 起`
  }
  if (end) {
    return `至 ${end}`
  }
  return "长期有效"
}

/**
 * 未设置时间时，管理员第一次选日期应该落在哪个时间点。
 * 用当天的 09:00 而不是「此刻」，避免深夜配置时默认落到不可预期的时段。
 */
export function createDefaultAnnouncementParts(
  now: Date = new Date(),
): AnnouncementDateTimeParts {
  return {
    date: now,
    hour: announcementDefaultHour,
    minute: announcementDefaultMinute,
  }
}
