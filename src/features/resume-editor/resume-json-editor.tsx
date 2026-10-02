"use client"

import MonacoEditor, {
  type BeforeMount,
  loader as monacoLoader,
  type OnMount,
} from "@monaco-editor/react"
import { BracesIcon, CheckIcon, Maximize2Icon, Minimize2Icon } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import { Button } from "../../components/ui/button"
import { FieldError } from "../../components/ui/field"
import { Skeleton } from "../../components/ui/skeleton"
import type { ResumeLinkTarget } from "../../shared/resume-schema/resume-link-target"
import {
  findResumeJsonLink,
  type ResumeJsonLink,
  resolveResumeJsonLinkAtOffset,
} from "./resume-json-link"

const monacoVsPath =
  typeof window === "undefined"
    ? "/monaco/vs"
    : new URL("/monaco/vs", window.location.origin).toString()

monacoLoader.config({
  paths: {
    vs: monacoVsPath,
  },
})

interface ResumeJsonEditorProps {
  modelPath: string
  value: string
  error: string
  onChange: (value: string) => void
  onApply: () => void
  maximized: boolean
  onMaximizedChange: (maximized: boolean) => void
  linkedTarget: ResumeLinkTarget | null
  onLinkedTargetChange: (target: ResumeLinkTarget | null) => void
}

function JsonEditorSkeleton() {
  return (
    <output className="resume-json-editor-loading" aria-live="polite">
      <span className="sr-only">JSON 编辑器加载中</span>
      <Skeleton />
      <Skeleton />
      <Skeleton />
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </output>
  )
}

const configureJsonLanguage: BeforeMount = (monaco) => {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    enableSchemaRequest: false,
    schemas: [],
  })
}

export function ResumeJsonEditor({
  modelPath,
  value,
  error,
  onChange,
  onApply,
  maximized,
  onMaximizedChange,
  linkedTarget,
  onLinkedTargetChange,
}: ResumeJsonEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const decorationsRef = useRef<ReturnType<
    Parameters<OnMount>[0]["createDecorationsCollection"]
  > | null>(null)
  const cursorListenerRef = useRef<{ dispose: () => void } | null>(null)
  const onLinkedTargetChangeRef = useRef(onLinkedTargetChange)
  onLinkedTargetChangeRef.current = onLinkedTargetChange

  const updateLinkedRange = useCallback(
    (link: ResumeJsonLink | null, reveal: boolean) => {
      const editor = editorRef.current
      const model = editor?.getModel()
      if (!editor || !model) {
        return
      }
      const decorations = decorationsRef.current ?? editor.createDecorationsCollection()
      decorationsRef.current = decorations
      if (!link) {
        decorations.clear()
        return
      }
      const start = model.getPositionAt(link.offset)
      const end = model.getPositionAt(link.offset + link.length)
      const range = {
        startLineNumber: start.lineNumber,
        startColumn: 1,
        endLineNumber: end.lineNumber,
        endColumn: model.getLineMaxColumn(end.lineNumber),
      }
      decorations.set([
        {
          range,
          options: {
            className: "resume-json-linked-line",
            isWholeLine: true,
            linesDecorationsClassName: "resume-json-linked-gutter",
          },
        },
      ])
      if (reveal) {
        editor.revealRangeInCenterIfOutsideViewport(range)
      }
    },
    [],
  )

  function updateTargetFromCursor() {
    const editor = editorRef.current
    const model = editor?.getModel()
    const position = editor?.getPosition()
    if (!model || !position) {
      return
    }
    const link = resolveResumeJsonLinkAtOffset(
      model.getValue(),
      model.getOffsetAt(position),
    )
    onLinkedTargetChangeRef.current(link?.target ?? null)
  }

  const handleMount: OnMount = (editor) => {
    cursorListenerRef.current?.dispose()
    editorRef.current = editor
    decorationsRef.current = editor.createDecorationsCollection()
    cursorListenerRef.current = editor.onDidChangeCursorPosition(updateTargetFromCursor)
    updateLinkedRange(
      linkedTarget ? findResumeJsonLink(editor.getValue(), linkedTarget) : null,
      false,
    )
  }

  useEffect(() => {
    updateLinkedRange(
      linkedTarget ? findResumeJsonLink(value, linkedTarget) : null,
      Boolean(linkedTarget),
    )
  }, [linkedTarget, updateLinkedRange, value])

  useEffect(
    () => () => {
      cursorListenerRef.current?.dispose()
      decorationsRef.current?.clear()
    },
    [],
  )

  return (
    <section className="resume-json-editor" aria-label="简历 JSON 编辑">
      <div className="resume-json-toolbar">
        <h2>
          <BracesIcon aria-hidden="true" />
          JSON 编辑
        </h2>
        <div className="resume-json-actions">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={maximized ? "恢复 JSON 编辑宽度" : "放大 JSON 编辑区域"}
            aria-pressed={maximized}
            onClick={() => onMaximizedChange(!maximized)}
          >
            {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
          </Button>
          <Button type="button" size="sm" onClick={onApply}>
            <CheckIcon data-icon="inline-start" />
            应用 JSON
          </Button>
        </div>
      </div>
      {error && <FieldError className="resume-json-error">{error}</FieldError>}
      <div className="resume-json-editor-frame" data-testid="monaco-json-editor">
        <MonacoEditor
          path={modelPath}
          language="json"
          theme="vs-dark"
          value={value}
          beforeMount={configureJsonLanguage}
          onMount={handleMount}
          onChange={(nextValue) => {
            onChange(nextValue ?? "")
            updateTargetFromCursor()
          }}
          loading={<JsonEditorSkeleton />}
          options={{
            ariaLabel: "简历 JSON 代码编辑器",
            automaticLayout: true,
            bracketPairColorization: { enabled: true },
            folding: true,
            fontFamily: '"SFMono-Regular", Consolas, monospace',
            fontSize: 12,
            formatOnPaste: true,
            formatOnType: true,
            insertSpaces: true,
            lineNumbers: "on",
            minimap: { enabled: false },
            padding: { top: 14, bottom: 14 },
            renderLineHighlight: "line",
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            tabSize: 2,
            wordWrap: "off",
          }}
        />
      </div>
    </section>
  )
}
