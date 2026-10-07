"use client"

import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  XIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import type {
  Announcement,
  AnnouncementLevel,
} from "../../shared/announcement/announcement-schema"
import {
  dismissAnnouncement,
  filterDismissedAnnouncements,
  loadDismissedAnnouncements,
  resolveNextAnnouncementIndex,
} from "./announcement-dismissal"

/** 轮播自动切换间隔。低于 5 秒会让用户来不及读完正文。 */
export const announcementRotationIntervalMs = 8000

const levelIcons: Record<AnnouncementLevel, typeof InfoIcon> = {
  info: InfoIcon,
  success: CheckCircle2Icon,
  warning: AlertTriangleIcon,
  danger: AlertTriangleIcon,
}

const levelLabels: Record<AnnouncementLevel, string> = {
  info: "通知",
  success: "消息",
  warning: "提醒",
  danger: "重要",
}

interface AnnouncementCarouselProps {
  announcements: Announcement[]
}

/**
 * 全局公告轮播槽位。
 *
 * 数据由服务端在登录后下发，关闭状态存在浏览器本地。
 * 组件在无可见公告时返回 null，不占用任何布局空间。
 */
export function AnnouncementCarousel({ announcements }: AnnouncementCarouselProps) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isRotationStopped, setIsRotationStopped] = useState(false)

  // 关闭记录只能从 localStorage 读取，必须挂载后再回填，
  // 否则服务端渲染与首次客户端渲染的可见条目不一致。
  useEffect(() => {
    setDismissed(loadDismissedAnnouncements(window.localStorage))
  }, [])

  const visibleAnnouncements = useMemo(
    () => filterDismissedAnnouncements(announcements, dismissed),
    [announcements, dismissed],
  )

  // 关闭公告后剩余条目变少，索引需要收敛，否则会指向不存在的条目。
  const currentIndex = Math.min(
    activeIndex,
    Math.max(visibleAnnouncements.length - 1, 0),
  )
  const activeAnnouncement = visibleAnnouncements[currentIndex]
  const rotationEnabled =
    visibleAnnouncements.length > 1 && !isPaused && !isRotationStopped

  useEffect(() => {
    if (!rotationEnabled) {
      return
    }
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % visibleAnnouncements.length)
    }, announcementRotationIntervalMs)
    return () => window.clearInterval(timer)
  }, [rotationEnabled, visibleAnnouncements.length])

  const handleDismiss = useCallback(
    (announcement: Announcement) => {
      const nextIndex = resolveNextAnnouncementIndex(
        visibleAnnouncements,
        currentIndex,
        announcement.id,
      )
      setDismissed(dismissAnnouncement(window.localStorage, announcement))
      setActiveIndex(nextIndex)
    },
    [currentIndex, visibleAnnouncements],
  )

  if (!activeAnnouncement) {
    return null
  }

  const Icon = levelIcons[activeAnnouncement.level]
  const hasMultiple = visibleAnnouncements.length > 1

  return (
    <section
      className="announcement-carousel"
      data-level={activeAnnouncement.level}
      data-testid="announcement-carousel"
      aria-label="平台公告"
      data-announcement-paused={isPaused || isRotationStopped}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <Icon className="announcement-carousel-icon" aria-hidden="true" />
      <span className="announcement-carousel-level">
        {levelLabels[activeAnnouncement.level]}
      </span>

      <div className="announcement-carousel-body">
        <strong>{activeAnnouncement.title}</strong>
        <span>{activeAnnouncement.body}</span>
      </div>

      {activeAnnouncement.linkHref ? (
        <a
          className="announcement-carousel-link"
          href={activeAnnouncement.linkHref}
          {...(activeAnnouncement.linkHref.startsWith("/")
            ? {}
            : { target: "_blank", rel: "noopener noreferrer" })}
        >
          {activeAnnouncement.linkLabel}
          <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
        </a>
      ) : null}

      {hasMultiple ? (
        <fieldset className="announcement-carousel-dots">
          <legend className="sr-only">公告切换</legend>
          {visibleAnnouncements.map((announcement, index) => (
            <button
              key={announcement.id}
              type="button"
              className="announcement-carousel-dot"
              aria-label={`查看第 ${index + 1} 条公告`}
              aria-current={index === currentIndex}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </fieldset>
      ) : null}

      {/*
        自动轮播必须提供用户可控的暂停，WCAG 2.2.2。
        hover 和 focus 只能临时暂停，无法满足「用户主动控制」的要求。
      */}
      {hasMultiple ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={isRotationStopped ? "继续自动轮播" : "暂停自动轮播"}
          aria-pressed={isRotationStopped}
          data-testid="announcement-rotation-toggle"
          onClick={() => setIsRotationStopped((stopped) => !stopped)}
        >
          {isRotationStopped ? <PlayIcon /> : <PauseIcon />}
        </Button>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="关闭公告"
        data-testid="announcement-dismiss"
        onClick={() => handleDismiss(activeAnnouncement)}
      >
        <XIcon />
      </Button>
    </section>
  )
}
