import { z } from "zod"

/**
 * 全局公告轮播槽位。
 *
 * 公告是平台级共享数据，没有归属用户，所有登录用户读取同一条列表。
 * 只有管理员可以写入，读取不区分身份（Preview 也可见）。
 */

export const announcementLevels = ["info", "success", "warning", "danger"] as const

export const announcementLevelSchema = z.enum(announcementLevels)

/**
 * 公告数量上限。轮播槽位属于轻量通知，超过这个量级应该拆分成其他产品能力。
 */
export const maximumAnnouncementCount = 20

export const maximumAnnouncementTextLength = 240
export const maximumAnnouncementTitleLength = 80
export const maximumAnnouncementLinkLabelLength = 24
export const maximumAnnouncementLinkHrefLength = 500

/**
 * 公告链接只允许站内绝对路径或 http(s) 地址，空字符串表示不提供链接。
 * 公告正文由管理员编辑但仍会渲染到 DOM，放开 javascript: 等协议等于把存储型 XSS 交给配置者。
 */
const announcementLinkHrefSchema = z
  .string()
  .trim()
  .max(maximumAnnouncementLinkHrefLength)
  .refine(
    (value) => {
      if (value === "") {
        return true
      }
      if (value.startsWith("//")) {
        return false
      }
      if (value.startsWith("/")) {
        return true
      }
      try {
        const { protocol } = new URL(value)
        return protocol === "http:" || protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "公告链接只允许站内绝对路径或 http(s) 地址" },
  )

export const announcementInputSchema = z
  .object({
    level: announcementLevelSchema,
    title: z.string().trim().min(1).max(maximumAnnouncementTitleLength),
    body: z.string().trim().min(1).max(maximumAnnouncementTextLength),
    linkLabel: z.string().trim().max(maximumAnnouncementLinkLabelLength),
    linkHref: announcementLinkHrefSchema,
    enabled: z.boolean(),
    sortOrder: z.number().int().min(0).max(999),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
  })
  .strict()
  .refine(
    (value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt,
    { message: "结束时间必须晚于开始时间", path: ["endsAt"] },
  )
  .refine((value) => !value.linkHref || Boolean(value.linkLabel), {
    message: "填写公告链接时必须同时提供链接文案",
    path: ["linkLabel"],
  })
  .refine((value) => !value.linkLabel || Boolean(value.linkHref), {
    message: "填写链接文案时必须同时提供公告链接",
    path: ["linkHref"],
  })

export const announcementSchema = announcementInputSchema
  .extend({
    id: z.string().min(1).max(64),
    createdAt: z.string().min(1).max(40),
    updatedAt: z.string().min(1).max(40),
  })
  .strict()

export type AnnouncementLevel = z.infer<typeof announcementLevelSchema>
export type AnnouncementInput = z.infer<typeof announcementInputSchema>
export type Announcement = z.infer<typeof announcementSchema>

export function createEmptyAnnouncementInput(): AnnouncementInput {
  return {
    level: "info",
    title: "",
    body: "",
    linkLabel: "",
    linkHref: "",
    enabled: true,
    sortOrder: 0,
    startsAt: null,
    endsAt: null,
  }
}

/**
 * 判断公告在指定时刻是否应该出现在轮播里。
 * 时间窗口为空表示不设边界，避免管理员为了「一直显示」被迫填写占位时间。
 */
export function isAnnouncementVisibleAt(
  announcement: Pick<Announcement, "enabled" | "startsAt" | "endsAt">,
  now: Date,
): boolean {
  if (!announcement.enabled) {
    return false
  }
  if (announcement.startsAt && now.getTime() < Date.parse(announcement.startsAt)) {
    return false
  }
  if (announcement.endsAt && now.getTime() >= Date.parse(announcement.endsAt)) {
    return false
  }
  return true
}
