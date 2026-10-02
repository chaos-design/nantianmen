"use client"

import { LinkIcon, PrinterIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"

interface PublicResumeActionsProps {
  mode: "a4" | "web"
}

export function PublicResumeActions({ mode }: PublicResumeActionsProps) {
  return (
    <>
      <Button
        variant="outline"
        size="xs"
        onClick={() => {
          void navigator.clipboard
            .writeText(window.location.href)
            .then(() => toast.success("链接已复制"))
            .catch(() => toast.error("链接复制失败，请手动复制地址栏"))
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
    </>
  )
}
