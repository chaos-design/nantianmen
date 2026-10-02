"use client"

import { RotateCcwIcon, SaveIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog"
import { Button } from "../../components/ui/button"
import { ScrollArea } from "../../components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Textarea } from "../../components/ui/textarea"
import type { AiTask } from "../../shared/resume-ai/resume-ai-contract"
import { findMissingStructureMarkers } from "../../shared/resume-ai/resume-ai-prompt-text"
import {
  aiTaskLabels,
  type BrowserAiPrompts,
  emptyBrowserAiPrompts,
  hasCustomPrompt,
  readPromptText,
  supportedAiTasks,
  updatePromptText,
} from "./browser-ai-prompts"

interface AiPromptEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompts: BrowserAiPrompts
  onSave: (prompts: BrowserAiPrompts) => void
}

export function AiPromptEditor({
  open,
  onOpenChange,
  prompts,
  onSave,
}: AiPromptEditorProps) {
  const [draft, setDraft] = useState<BrowserAiPrompts>(prompts)
  const [task, setTask] = useState<AiTask>("improve-content")

  useEffect(() => {
    if (open) {
      setDraft(prompts)
    }
  }, [open, prompts])

  const isCustom = hasCustomPrompt(draft, task)
  const missingMarkers = findMissingStructureMarkers(task, readPromptText(draft, task))
  const [confirmOpen, setConfirmOpen] = useState(false)

  function commitSave() {
    onSave(draft)
    toast.success("指令已保存，下次生成时生效")
  }

  function handleSave() {
    // 结构缺失不阻止保存，但在真正落盘前必须让用户确认后果。
    if (missingMarkers.length > 0) {
      setConfirmOpen(true)
      return
    }
    commitSave()
  }

  function handleResetTask() {
    setDraft((previous) =>
      updatePromptText(previous, task, readPromptText(emptyBrowserAiPrompts, task)),
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // 与 AI 助手抽屉同宽，避免嵌套抽屉宽度跳变。
        className="ai-prompt-sheet"
        // 嵌套在 AI 抽屉之上，需要压过外层抽屉的 z-50。
        style={{ zIndex: 60 }}
        showCloseButton={false}
      >
        <SheetHeader>
          <div className="ai-prompt-heading">
            <div>
              <SheetTitle>AI 指令</SheetTitle>
              <SheetDescription>
                这就是完整发送给模型的 system prompt，保存后原样使用，没有任何隐藏内容。
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="关闭指令面板"
              onClick={() => onOpenChange(false)}
            >
              <XIcon />
            </Button>
          </div>
        </SheetHeader>

        <Tabs value={task} onValueChange={(value) => setTask(value as AiTask)}>
          <TabsList>
            {supportedAiTasks.map((value) => (
              <TabsTrigger key={value} value={value}>
                {aiTaskLabels[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ScrollArea className="ai-prompt-body">
          <section className="ai-prompt-section">
            <header className="ai-prompt-section-head">
              <span>完整 Prompt</span>
              <strong data-state={isCustom ? "custom" : "default"}>
                {isCustom ? "已自定义" : "使用默认"}
              </strong>
            </header>
            <Textarea
              value={readPromptText(draft, task)}
              onChange={(event) =>
                setDraft((previous) =>
                  updatePromptText(previous, task, event.target.value),
                )
              }
              aria-label="AI 指令全文"
              className="ai-prompt-textarea"
              rows={22}
              spellCheck={false}
            />
            {missingMarkers.length > 0 ? (
              <p className="ai-prompt-warning" role="alert">
                <TriangleAlertIcon aria-hidden="true" />
                <span>
                  输出结构定义不完整，保存后 AI 可能无法返回结果。缺失：
                  {missingMarkers.join("、")}
                </span>
              </p>
            ) : null}
            <small>一行一句。只保存在当前浏览器，不上传服务器。</small>
          </section>
        </ScrollArea>

        <SheetFooter>
          <Button variant="outline" onClick={handleResetTask}>
            <RotateCcwIcon data-icon="inline-start" />
            恢复默认
          </Button>
          <Button onClick={handleSave}>
            <SaveIcon data-icon="inline-start" />
            保存
          </Button>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="ai-prompt-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>指令缺少输出结构</AlertDialogTitle>
            <AlertDialogDescription>
              这段指令没有定义 AI 该返回什么格式的结果：
              <span className="ai-prompt-missing">{missingMarkers.join("、")}</span>
              。保存后 AI 大概率无法返回可解析的结果，功能会直接报错。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回修改</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false)
                commitSave()
              }}
            >
              仍然保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
