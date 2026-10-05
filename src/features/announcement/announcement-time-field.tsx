"use client"

import { CalendarIcon, ClockIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import { Calendar } from "../../components/ui/calendar"
import { Field, FieldLabel } from "../../components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import {
  announcementDefaultHour,
  announcementDefaultMinute,
  announcementMinuteOptions,
  composeAnnouncementIso,
  createDefaultAnnouncementParts,
  formatAnnouncementDateTime,
  readAnnouncementDateTimeParts,
} from "./announcement-time"

const hourOptions = Array.from({ length: 24 }, (_, hour) => hour)

function padTime(value: number) {
  return String(value).padStart(2, "0")
}

interface AnnouncementTimeFieldProps {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
}

/**
 * 公告生效时间选择器。
 *
 * 用 shadcn 的 Popover + Calendar + Select 组合，不再依赖浏览器原生
 * `datetime-local`：原生控件在深色主题下样式不可控，且无法与项目字体对齐。
 *
 * 选择即生效，不做「暂存草稿」：面板本身就是逐项配置区，
 * 每次改动立即写回上层草稿，关闭面板时不存在需要确认的时间状态。
 *
 * 未设置时只改小时或分钟会以「当天」为日期，因为时间必须依附于某一天；
 * 面板里的「今天 09:00」按钮把这个隐含规则显式写了出来。
 */
export function AnnouncementTimeField({
  id,
  label,
  value,
  onChange,
}: AnnouncementTimeFieldProps) {
  const [open, setOpen] = useState(false)
  const parts = readAnnouncementDateTimeParts(value)
  const display = formatAnnouncementDateTime(value)
  // 用解析结果而不是原始 value 判断是否已设置：非法字符串不能显示成已设置。
  const isSet = display !== ""
  const hour = parts?.hour ?? announcementDefaultHour
  const minute = parts?.minute ?? announcementDefaultMinute

  function commit(next: { date?: Date; hour?: number; minute?: number }) {
    const base = parts ?? createDefaultAnnouncementParts()
    onChange(
      composeAnnouncementIso({
        date: next.date ?? base.date,
        hour: next.hour ?? base.hour,
        minute: next.minute ?? base.minute,
      }),
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="announcement-time-trigger h-9"
            aria-haspopup="dialog"
            data-testid={`${id}-trigger`}
          >
            {isSet ? <ClockIcon data-icon="inline-start" /> : null}
            <span className={isSet ? undefined : "text-muted-foreground"}>
              {display || "未设置"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="announcement-time-popover">
          <Calendar
            mode="single"
            selected={parts?.date}
            onSelect={(date) => {
              if (date) {
                commit({ date })
              }
            }}
            autoFocus
          />
          <div className="announcement-time-slots">
            <Select
              value={String(hour)}
              onValueChange={(next) => commit({ hour: Number(next) })}
            >
              <SelectTrigger aria-label={`${label}的小时`} className="flex-1">
                {/*
                 * SelectValue 不能只靠 items 解析文案：下拉内容默认不挂载，
                 * 受控 value 在首次展开前查不到对应项，触发器会显示成空白。
                 * 这里直接给出当前文案。
                 */}
                <SelectValue>{`${padTime(hour)} 时`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {hourOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {`${padTime(option)} 时`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(minute)}
              onValueChange={(next) => commit({ minute: Number(next) })}
            >
              <SelectTrigger aria-label={`${label}的分钟`} className="flex-1">
                <SelectValue>{`${padTime(minute)} 分`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {announcementMinuteOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {`${padTime(option)} 分`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="announcement-time-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => commit(createDefaultAnnouncementParts())}
            >
              <CalendarIcon data-icon="inline-start" />
              今天 09:00
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!value}
              onClick={() => onChange(null)}
            >
              清空
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  )
}
