import { FileQuestionIcon } from "lucide-react"
import Link from "next/link"
import { Button } from "../components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../components/ui/empty"

export default function NotFoundPage() {
  return (
    <main className="not-found-shell">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon />
          </EmptyMedia>
          <EmptyTitle>没有找到这份简历</EmptyTitle>
          <EmptyDescription>
            链接可能有误，或者该简历还没有发布任何公开版本。
          </EmptyDescription>
        </EmptyHeader>
        <Button asChild>
          <Link href="/">返回 Résumé Lab</Link>
        </Button>
      </Empty>
    </main>
  )
}
