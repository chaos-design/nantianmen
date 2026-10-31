"use client"

import { AppWindowIcon, FileTextIcon, LinkIcon, PrinterIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "../../components/ui/button"
import { copyTextToClipboard } from "../../lib/clipboard"

interface PublicResumeActionsProps {
  mode: "a4" | "web"
  publicSlug: string
}

/**
 * 公开分享页的操作区。
 *
 * 复制结果直接在按钮上回显，而不是弹 toast：分享页的访客只做「复制 / 打印 / 切换
 * 版式」这几件事，为此把 sonner（10 kB）打进首屏不划算——这一页的 LCP 是简历里的
 * 图片，首屏每多一份脚本都会推迟图片拿到带宽的时间。
 */
export function PublicResumeActions({ mode, publicSlug }: PublicResumeActionsProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        onClick={() => {
          void copyTextToClipboard(window.location.href).then((didCopy) => {
            if (didCopy) {
              setCopied(true)
            }
          })
        }}
      >
        <LinkIcon data-icon="inline-start" />
        {copied ? "已复制" : "复制链接"}
      </Button>
      {mode === "a4" ? (
        <Button asChild variant="outline" size="xs">
          <Link href={`/r/${encodeURIComponent(publicSlug)}/web`}>
            <AppWindowIcon data-icon="inline-start" />
            互动版
          </Link>
        </Button>
      ) : null}
      {mode === "a4" ? (
        <Button size="xs" onClick={() => window.print()}>
          <PrinterIcon data-icon="inline-start" />
          打印
        </Button>
      ) : null}
      {mode === "web" ? (
        <Button size="xs" variant="outline" asChild>
          <Link
            href={`/r/${encodeURIComponent(publicSlug)}`}
            aria-label="查看 A4 版简历"
          >
            <FileTextIcon data-icon="inline-start" />
            查看 A4 版
          </Link>
        </Button>
      ) : null}
    </>
  )
}
