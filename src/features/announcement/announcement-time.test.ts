import { describe, expect, it } from "vitest"
import {
  announcementDefaultHour,
  announcementDefaultMinute,
  announcementMinuteOptions,
  composeAnnouncementIso,
  createDefaultAnnouncementParts,
  formatAnnouncementDateTime,
  readAnnouncementDateTimeParts,
} from "./announcement-time"

describe("announcement local time conversion", () => {
  it("round-trips local date and time through a UTC ISO string", () => {
    const iso = composeAnnouncementIso({
      date: new Date(2026, 9, 5, 0, 0, 0, 0),
      hour: 14,
      minute: 35,
    })

    expect(iso).not.toBeNull()
    const parts = readAnnouncementDateTimeParts(iso)
    expect(parts?.date.getFullYear()).toBe(2026)
    expect(parts?.date.getMonth()).toBe(9)
    expect(parts?.date.getDate()).toBe(5)
    expect(parts?.hour).toBe(14)
    expect(parts?.minute).toBe(35)
  })

  it("keeps the picked calendar day instead of shifting it across time zones", () => {
    // 选 1 月 1 日 00:00 时，东八区会落成前一天的 16:00 UTC；
    // 读回来必须是同一个本地日期，否则管理员会看到「差一天」。
    const iso = composeAnnouncementIso({
      date: new Date(2026, 0, 1, 0, 0, 0, 0),
      hour: 0,
      minute: 0,
    })

    expect(readAnnouncementDateTimeParts(iso)?.date.getDate()).toBe(1)
    expect(formatAnnouncementDateTime(iso)).toBe("2026-01-01 00:00")
  })

  it("treats empty and invalid values as unset", () => {
    expect(readAnnouncementDateTimeParts(null)).toBeNull()
    expect(readAnnouncementDateTimeParts("not-a-date")).toBeNull()
    expect(composeAnnouncementIso(null)).toBeNull()
    expect(formatAnnouncementDateTime(null)).toBe("")
    expect(formatAnnouncementDateTime("not-a-date")).toBe("")
  })

  it("defaults a fresh pick to 09:00 of the current day", () => {
    const parts = createDefaultAnnouncementParts(new Date(2026, 4, 20, 23, 30))

    expect(parts.hour).toBe(announcementDefaultHour)
    expect(parts.minute).toBe(announcementDefaultMinute)
    expect(parts.date.getDate()).toBe(20)
    // 默认时刻必须是常量：组件在模块顶层用它当下拉的初始值，
    // 如果这里随调用时刻变化，触发器文案会和服务端不一致。
    expect(announcementDefaultHour).toBe(9)
    expect(announcementDefaultMinute).toBe(0)
  })

  it("offers minute options on the configured step", () => {
    expect(announcementMinuteOptions[0]).toBe(0)
    expect(announcementMinuteOptions.at(-1)).toBe(55)
    expect(announcementMinuteOptions.every((value) => value % 5 === 0)).toBe(true)
  })
})
