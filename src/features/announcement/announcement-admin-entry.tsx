"use client"

import { SettingsIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../components/ui/sheet"
import { Spinner } from "../../components/ui/spinner"
import type { AnnouncementOverview } from "../../server/domain/announcement-service"

/**
 * 公告配置面板体。
 *
 * 只有管理员首次打开抽屉时才会下载：面板里带 Calendar、Select 和整套表单，
 * 静态引入会让所有登录用户为这个低频管理界面多付约 50 kB 首屏脚本。
 */
const AnnouncementAdminPanel = dynamic(
  () =>
    import("./announcement-admin-panel").then(
      (module) => module.AnnouncementAdminPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="announcement-admin-loading">
        <Spinner />
        <span>正在加载公告配置…</span>
      </div>
    ),
  },
)

/**
 * 公告配置抽屉入口。
 *
 * 触发按钮由这里渲染，面板体拆成独立 chunk。抽屉关闭时面板体直接卸载，
 * 未保存的新草稿随之丢弃，不需要额外的清理逻辑。
 */
export function AnnouncementAdminEntry({
  initialAnnouncements,
}: {
  initialAnnouncements: AnnouncementOverview
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          // 关闭时重新拉一次列表，避免下次打开看到上一次会话留下的状态。
          router.refresh()
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="open-announcement-admin"
        >
          <SettingsIcon data-icon="inline-start" />
          公告配置
        </Button>
      </SheetTrigger>
      <SheetContent
        className="announcement-admin-sheet"
        data-testid="announcement-admin-panel"
        side="right"
      >
        <SheetHeader>
          <SheetTitle>全局公告配置</SheetTitle>
          <SheetDescription>
            公告在登录后对所有用户展示。用户可以自行关闭单条公告，停用公告则对所有人隐藏。
          </SheetDescription>
        </SheetHeader>

        <div className="announcement-admin-body">
          {open ? (
            <AnnouncementAdminPanel initialAnnouncements={initialAnnouncements} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
