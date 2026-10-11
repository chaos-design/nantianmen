"use client"

import { FileTextIcon, LinkIcon, PrinterIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import { copyTextToClipboard } from "../../lib/clipboard"

interface PublicResumeActionsProps {
  mode: "a4" | "web"
}

export function PublicResumeActions({ mode }: PublicResumeActionsProps) {
  const pathname = usePathname()
  const a4Pathname =
    mode === "web" && pathname.endsWith("/web")
      ? pathname.slice(0, -"/web".length)
      : null

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        onClick={() => {
          void copyTextToClipboard(window.location.href).then((copied) => {
            if (copied) {
              toast.success("链接已复制")
            }
          })
        }}
      >
        <LinkIcon data-icon="inline-start" />
        复制链接
      </Button>
      {mode === "a4" ? (
        <Button size="xs" onClick={() => window.print()}>
          <PrinterIcon data-icon="inline-start" />
          打印
        </Button>
      ) : null}
      {mode === "web" && a4Pathname ? (
        <Button size="xs" variant="outline" asChild>
          <Link href={a4Pathname} aria-label="查看 A4 版简历">
            <FileTextIcon data-icon="inline-start" />
            查看 A4 版
          </Link>
        </Button>
      ) : null}
    </>
  )
}
