"use client"

import {
  CheckIcon,
  CrosshairIcon,
  EyeIcon,
  EyeOffIcon,
  LightbulbIcon,
  MessageSquareQuoteIcon,
  MessageSquareTextIcon,
  QuoteIcon,
  ScrollTextIcon,
  Settings2Icon,
  SparklesIcon,
  TargetIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react"
import { Fragment, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { ScrollArea } from "../../components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../components/ui/sheet"
import { Spinner } from "../../components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import type {
  AiContentSuggestion,
  AiOutput,
  AiProviderConfig,
  AiTask,
} from "../../shared/resume-ai/resume-ai-contract"
import type { ResumeDocument } from "../../shared/resume-schema/resume-schema"
import {
  type AiContentImprovementOutput,
  readAiContentSuggestionSession,
  saveAiContentSuggestionSession,
} from "./ai-content-suggestion-session"
import { AiPromptEditor } from "./ai-prompt-editor"
import { type AiTextDiffSegment, diffAiText } from "./ai-text-diff"
import {
  clearBrowserAiConfig,
  readBrowserAiConfig,
  saveBrowserAiConfig,
} from "./browser-ai-config"
import {
  type BrowserAiPrompts,
  emptyBrowserAiPrompts,
  readBrowserAiPrompts,
  readPromptGuidance,
  saveBrowserAiPrompts,
} from "./browser-ai-prompts"
import {
  generateAiContent,
  loadDefaultAiProviderConfig,
  testAiProvider,
} from "./editor-api"

interface AiAssistantProps {
  resumeId: string
  storageOwnerId: string
  document: ResumeDocument
  selectedSectionId: string
  onApplySuggestion: (suggestion: AiContentSuggestion) => { label: string } | null
  onLocateSuggestion: (suggestion: AiContentSuggestion) => boolean
  /** 上报仍有未应用建议的条目 ID，供表单侧渲染待应用标记。 */
  onPendingSuggestionItemsChange: (itemIds: string[]) => void
}

type AiInterviewQuestionOutput = Extract<AiOutput, { type: "interview-questions" }>

const suggestionFieldLabels: Record<AiContentSuggestion["target"]["field"], string> = {
  summary: "个人摘要",
  title: "标题",
  subtitle: "副标题",
  description: "描述",
  highlight: "亮点",
}

function getSuggestionTargetKey(suggestion: AiContentSuggestion): string {
  const { sectionId, itemId, field, index } = suggestion.target
  return JSON.stringify([sectionId, itemId, field, index])
}

/**
 * 差异片段用 <mark> 渲染：.ai-comparison span 是后代选择器，
 * 用 span 会被标签的 flex 样式污染，同时 mark 语义上也更准确。
 */
function renderDiffSegments(segments: AiTextDiffSegment[], kind: "added" | "removed") {
  // 用字符偏移而不是数组下标做 key：片段在该文本中互不重叠，偏移天然唯一，
  // 且对同一对原文/优化稿是稳定的。
  let offset = 0
  return segments.map((segment) => {
    const key = `${kind}-${offset}`
    offset += segment.text.length
    return segment.changed ? (
      <mark data-diff={kind} key={key}>
        {segment.text}
      </mark>
    ) : (
      <Fragment key={key}>{segment.text}</Fragment>
    )
  })
}

/** 建议所属条目的可读定位标签，用于在结果列表中区分同一区块下的不同条目。 */
function getSuggestionLocator(
  document: ResumeDocument,
  suggestion: AiContentSuggestion,
): string {
  const { sectionId, itemId, index } = suggestion.target
  if (!sectionId || !itemId) {
    return "个人信息 / 个人摘要"
  }
  const section = document.sections.find((entry) => entry.id === sectionId)
  if (!section) {
    return "AI 建议目标已失效"
  }
  const itemIndex = section.items.findIndex((entry) => entry.id === itemId)
  if (itemIndex < 0) {
    return "AI 建议目标已失效"
  }
  const item = section.items[itemIndex]
  const name = item.title || item.subtitle || `条目 ${itemIndex + 1}`
  return `${section.title} / ${name}${index === null ? "" : ` / 亮点 ${index + 1}`}`
}

const emptyProviderConfig: AiProviderConfig = {
  modelName: "",
  baseUrl: "",
  apiKey: "",
}

type AiProviderSource = "global" | "personal" | null

function getProviderStatus(
  config: AiProviderConfig | null,
  source: AiProviderSource,
): string {
  if (source === "global" && config) {
    return `当前使用服务端全局配置：${config.modelName}。保存后会转为当前浏览器的个人配置。`
  }
  if (source === "personal" && config) {
    return `当前使用个人配置：${config.modelName}。配置保存在当前浏览器中，不会同步到其他设备。`
  }
  return "没有可用的全局配置，请填写当前浏览器的个人配置。"
}

function getInterviewSourceLabel(
  document: ResumeDocument,
  itemId: string | null,
): string {
  if (!itemId) {
    return "综合经历"
  }
  for (const section of document.sections) {
    const item = section.items.find((entry) => entry.id === itemId)
    if (item) {
      return `${section.title} · ${item.title || item.subtitle || "未命名经历"}`
    }
  }
  return "综合经历"
}

export function AiAssistant({
  resumeId,
  storageOwnerId,
  document,
  selectedSectionId,
  onApplySuggestion,
  onLocateSuggestion,
  onPendingSuggestionItemsChange,
}: AiAssistantProps) {
  const [task, setTask] = useState<AiTask>("improve-content")
  const [contentOutput, setContentOutput] = useState<AiContentImprovementOutput | null>(
    null,
  )
  const [interviewOutput, setInterviewOutput] =
    useState<AiInterviewQuestionOutput | null>(null)
  const [contentProvider, setContentProvider] = useState("")
  const [interviewProvider, setInterviewProvider] = useState("")
  const [isGeneratingContent, setIsGeneratingContent] = useState(false)
  const [isGeneratingInterview, setIsGeneratingInterview] = useState(false)
  const [isTestingProvider, setIsTestingProvider] = useState(false)
  const [providerConfig, setProviderConfig] = useState<AiProviderConfig | null>(null)
  const [globalProviderConfig, setGlobalProviderConfig] =
    useState<AiProviderConfig | null>(null)
  const [providerSource, setProviderSource] = useState<AiProviderSource>(null)
  const [providerDraft, setProviderDraft] =
    useState<AiProviderConfig>(emptyProviderConfig)
  const [configOpen, setConfigOpen] = useState(true)
  const [promptEditorOpen, setPromptEditorOpen] = useState(false)
  const [aiPrompts, setAiPrompts] = useState<BrowserAiPrompts>(emptyBrowserAiPrompts)
  const [showApiKey, setShowApiKey] = useState(false)
  const [appliedTargetKeys, setAppliedTargetKeys] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    setAiPrompts(readBrowserAiPrompts(storageOwnerId))
  }, [storageOwnerId])

  useEffect(() => {
    const session = readAiContentSuggestionSession(storageOwnerId, resumeId)
    setContentOutput(session?.output ?? null)
    setContentProvider(session?.provider ?? "")
    setAppliedTargetKeys(new Set(session?.appliedTargetKeys ?? []))
    setInterviewOutput(null)
    setInterviewProvider("")
  }, [resumeId, storageOwnerId])

  useEffect(() => {
    const storedConfig = readBrowserAiConfig(storageOwnerId)
    if (storedConfig) {
      setGlobalProviderConfig(null)
      setProviderConfig(storedConfig)
      setProviderSource("personal")
      setProviderDraft(storedConfig)
      setConfigOpen(false)
      return
    }

    let cancelled = false
    setGlobalProviderConfig(null)
    setProviderConfig(null)
    setProviderSource(null)
    setProviderDraft(emptyProviderConfig)
    setConfigOpen(true)

    void loadDefaultAiProviderConfig()
      .then((defaultConfig) => {
        if (cancelled) {
          return
        }
        setGlobalProviderConfig(defaultConfig)
        setProviderConfig(defaultConfig)
        setProviderSource(defaultConfig ? "global" : null)
        setProviderDraft(defaultConfig ?? emptyProviderConfig)
        setConfigOpen(!defaultConfig)
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("全局模型配置不可用，可手动填写个人配置")
        }
      })

    return () => {
      cancelled = true
    }
  }, [storageOwnerId])

  function updateProviderDraft(field: keyof AiProviderConfig, value: string) {
    setProviderDraft((current) => ({ ...current, [field]: value }))
  }

  function handleSaveProvider() {
    try {
      const saved = saveBrowserAiConfig(storageOwnerId, providerDraft)
      setProviderConfig(saved)
      setProviderSource("personal")
      setProviderDraft(saved)
      toast.success("模型配置已保存在当前浏览器")
    } catch {
      toast.error("配置不合法，请检查模型名、Base URL 和 API Key")
    }
  }

  async function handleTestProvider() {
    setIsTestingProvider(true)
    try {
      const result = await testAiProvider(providerDraft)
      toast.success(`连接成功：${result.provider}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "模型连接失败")
    } finally {
      setIsTestingProvider(false)
    }
  }

  async function handleClearProvider() {
    try {
      clearBrowserAiConfig(storageOwnerId)
      const fallbackConfig =
        globalProviderConfig ?? (await loadDefaultAiProviderConfig())
      setGlobalProviderConfig(fallbackConfig)
      setProviderConfig(fallbackConfig)
      setProviderSource(fallbackConfig ? "global" : null)
      setProviderDraft(fallbackConfig ?? emptyProviderConfig)
      setConfigOpen(!fallbackConfig)
      toast.success(
        fallbackConfig
          ? "已删除个人配置，并恢复全局默认模型"
          : "已删除当前浏览器中的模型配置",
      )
    } catch {
      toast.error("无法删除当前浏览器中的模型配置")
    }
  }

  async function handleGenerate(nextTask: AiTask) {
    if (!providerConfig) {
      setConfigOpen(true)
      toast.error("请先配置自己的大模型")
      return
    }
    setTask(nextTask)
    if (nextTask === "improve-content") {
      setIsGeneratingContent(true)
    } else {
      setIsGeneratingInterview(true)
    }
    try {
      const result = await generateAiContent({
        resumeId,
        task: nextTask,
        document,
        targetSectionId:
          nextTask === "improve-content" && selectedSectionId !== "profile"
            ? selectedSectionId
            : null,
        providerConfig,
        promptGuidance: readPromptGuidance(aiPrompts, nextTask),
      })
      if (nextTask === "improve-content") {
        if (result.output.type !== "improve-content") {
          throw new Error("AI 返回类型与当前任务不一致，请重试")
        }
        setContentOutput(result.output)
        setContentProvider(result.provider)
        setAppliedTargetKeys(new Set())
        saveAiContentSuggestionSession(storageOwnerId, resumeId, {
          output: result.output,
          provider: result.provider,
          appliedTargetKeys: [],
        })
      } else {
        if (result.output.type !== "interview-questions") {
          throw new Error("AI 返回类型与当前任务不一致，请重试")
        }
        setInterviewOutput(result.output)
        setInterviewProvider(result.provider)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 生成失败")
    } finally {
      if (nextTask === "improve-content") {
        setIsGeneratingContent(false)
      } else {
        setIsGeneratingInterview(false)
      }
    }
  }

  function handleApplySuggestion(suggestion: AiContentSuggestion) {
    const application = onApplySuggestion(suggestion)
    if (!application) {
      toast.error("原内容已变化，请重新生成建议")
      return
    }
    const nextAppliedTargetKeys = new Set(appliedTargetKeys)
    nextAppliedTargetKeys.add(getSuggestionTargetKey(suggestion))
    setAppliedTargetKeys(nextAppliedTargetKeys)
    if (contentOutput) {
      saveAiContentSuggestionSession(storageOwnerId, resumeId, {
        output: contentOutput,
        provider: contentProvider,
        appliedTargetKeys: [...nextAppliedTargetKeys],
      })
    }
    toast.success(`已应用到：${application.label}`)
  }

  function handleLocateSuggestion(suggestion: AiContentSuggestion) {
    if (!onLocateSuggestion(suggestion)) {
      toast.error("原内容已变化，请重新生成建议")
    }
  }

  const output = task === "improve-content" ? contentOutput : interviewOutput
  const provider = task === "improve-content" ? contentProvider : interviewProvider
  const providerStatus = getProviderStatus(providerConfig, providerSource)
  const pendingSuggestions = useMemo(
    () =>
      contentOutput
        ? contentOutput.suggestions.filter(
            (suggestion) => !appliedTargetKeys.has(getSuggestionTargetKey(suggestion)),
          )
        : [],
    [contentOutput, appliedTargetKeys],
  )
  const pendingItemCount = pendingSuggestions.length
  const pendingItemIds = useMemo(
    () => [
      ...new Set(
        pendingSuggestions
          .map((suggestion) => suggestion.target.itemId)
          .filter((itemId): itemId is string => Boolean(itemId)),
      ),
    ],
    [pendingSuggestions],
  )
  const pendingItemIdsKey = pendingItemIds.join(",")

  useEffect(() => {
    onPendingSuggestionItemsChange(
      pendingItemIdsKey ? pendingItemIdsKey.split(",") : [],
    )
  }, [onPendingSuggestionItemsChange, pendingItemIdsKey])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" aria-label="AI 助手">
          <WandSparklesIcon data-icon="inline-start" />
          AI 助手
        </Button>
      </SheetTrigger>
      <SheetContent className="ai-sheet">
        <SheetHeader className="ai-sheet-header">
          <div className="ai-sheet-kicker">
            <Badge variant="secondary">AI COPILOT</Badge>
            <div className="ai-sheet-kicker-actions">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="ai-provider-trigger"
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-expanded={configOpen}
                    aria-label={`模型配置，${providerConfig?.modelName ?? "未配置"}`}
                    onClick={() => setConfigOpen((current) => !current)}
                  >
                    <Settings2Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>模型配置</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="ai-provider-trigger"
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="AI 指令"
                    onClick={() => setPromptEditorOpen(true)}
                  >
                    <ScrollTextIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>AI 指令</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <SheetTitle>让表达经得起追问</SheetTitle>
          <SheetDescription>
            AI 只提供建议，任何内容都需要你明确确认后才会写入草稿。
          </SheetDescription>
        </SheetHeader>

        {configOpen ? (
          <Card className="ai-provider-config">
            <CardHeader>
              <div className="ai-provider-title">
                <CardTitle>
                  {providerSource === "global"
                    ? "全局默认 Provider"
                    : "浏览器 Provider"}
                </CardTitle>
                <Badge variant="outline">{providerConfig?.modelName ?? "未配置"}</Badge>
              </div>
              <CardDescription className="ai-provider-description">
                <p>{providerStatus}</p>
                <p>
                  {providerSource === "global"
                    ? "当前值来自服务端全局配置，未写入 localStorage。该 API Key 已下发到当前浏览器；请勿在不受信任或共享设备中使用。"
                    : "配置只保存在此浏览器的 localStorage，不跨设备同步。清理站点数据会删除配置，同源脚本可以读取其中的 API Key；请勿在共享电脑保存高权限密钥，生产环境必须使用 HTTPS。"}
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent className="ai-provider-fields">
              <label htmlFor="ai-provider-model">
                <span>模型名称</span>
                <Input
                  id="ai-provider-model"
                  value={providerDraft.modelName}
                  placeholder="例如：gpt-4o-mini"
                  onChange={(event) =>
                    updateProviderDraft("modelName", event.target.value)
                  }
                />
                <small>填写 Provider 接受的 Chat Completions 模型名。</small>
              </label>
              <label htmlFor="ai-provider-base-url">
                <span>Base URL</span>
                <Input
                  id="ai-provider-base-url"
                  value={providerDraft.baseUrl}
                  placeholder="https://provider.example.com/v1"
                  onChange={(event) =>
                    updateProviderDraft("baseUrl", event.target.value)
                  }
                />
                <small>仅支持 HTTP(S)，服务端会自动追加 /chat/completions。</small>
              </label>
              <label htmlFor="ai-provider-api-key">
                <span>API Key</span>
                <div className="ai-provider-key-field">
                  <Input
                    id="ai-provider-api-key"
                    type={showApiKey ? "text" : "password"}
                    value={providerDraft.apiKey}
                    autoComplete="off"
                    placeholder="输入 Provider API Key"
                    onChange={(event) =>
                      updateProviderDraft("apiKey", event.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                    onClick={() => setShowApiKey((current) => !current)}
                  >
                    {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </div>
                <small>
                  Provider 必须支持 response_format JSON
                  Object。密钥不会写入服务器存储。
                </small>
              </label>
            </CardContent>
            <CardFooter className="ai-provider-actions">
              <Button
                type="button"
                variant="outline"
                disabled={isTestingProvider}
                onClick={handleTestProvider}
              >
                {isTestingProvider ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SparklesIcon data-icon="inline-start" />
                )}
                {isTestingProvider ? "测试中" : "测试连接"}
              </Button>
              <Button type="button" onClick={handleSaveProvider}>
                保存配置
              </Button>
              {providerSource === "personal" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handleClearProvider()}
                >
                  <Trash2Icon data-icon="inline-start" />
                  删除个人配置
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        ) : null}

        <div className="ai-sheet-controls">
          <Tabs value={task} onValueChange={(value) => setTask(value as AiTask)}>
            <TabsList>
              <TabsTrigger value="improve-content">
                <SparklesIcon />
                内容优化
              </TabsTrigger>
              <TabsTrigger value="interview-questions">
                <MessageSquareTextIcon />
                面试问题
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="ai-generation-actions">
            <Button
              disabled={isGeneratingContent || !providerConfig}
              onClick={() => void handleGenerate("improve-content")}
              variant={task === "improve-content" ? "default" : "outline"}
            >
              {isGeneratingContent ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SparklesIcon data-icon="inline-start" />
              )}
              {isGeneratingContent ? "优化中" : "生成内容优化"}
            </Button>
            <Button
              disabled={isGeneratingInterview || !providerConfig}
              onClick={() => void handleGenerate("interview-questions")}
              variant={task === "interview-questions" ? "default" : "outline"}
            >
              {isGeneratingInterview ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <MessageSquareTextIcon data-icon="inline-start" />
              )}
              {isGeneratingInterview ? "生成中" : "生成面试问题"}
            </Button>
          </div>
          {task === "improve-content" && pendingItemCount > 0 ? (
            <p className="ai-pending-count">
              共 {output?.type === "improve-content" ? output.suggestions.length : 0}{" "}
              条建议，待应用 {pendingItemCount} 条。
            </p>
          ) : null}
        </div>

        <ScrollArea className="ai-sheet-results">
          {!output && (
            <div className="ai-empty-state">
              <WandSparklesIcon aria-hidden="true" />
              <h3>
                {task === "improve-content"
                  ? "选择一个区块，获得更强的成果表达"
                  : "从工作与项目经历生成分层追问"}
              </h3>
              <p>
                {!providerConfig
                  ? "请先保存模型配置。配置仅保存在当前浏览器。"
                  : "联系方式、图片和发布信息不会发送给模型。所有建议均需确认后应用。"}
              </p>
              {pendingItemCount > 0 ? (
                <p className="ai-pending-hint">
                  {pendingItemIds.length} 个条目有待应用建议，可在左侧表单中查看标记。
                </p>
              ) : null}
            </div>
          )}

          {output?.type === "improve-content" && (
            <div className="ai-result-list">
              {output.suggestions.map((suggestion) => {
                const applied = appliedTargetKeys.has(
                  getSuggestionTargetKey(suggestion),
                )
                const diff = diffAiText(suggestion.original, suggestion.revised)
                return (
                  <Card
                    className="ai-result-card"
                    data-applied={applied}
                    data-result-kind="improvement"
                    key={suggestion.id}
                  >
                    <CardHeader>
                      <div className="ai-result-heading">
                        <Badge
                          className="ai-field-badge"
                          variant="outline"
                          data-locator={getSuggestionLocator(document, suggestion)}
                        >
                          {getSuggestionLocator(document, suggestion)}
                        </Badge>
                        <Badge className="ai-field-badge" variant="outline">
                          <SparklesIcon />
                          {suggestionFieldLabels[suggestion.target.field]}优化
                        </Badge>
                      </div>
                      <div className="ai-rationale">
                        <LightbulbIcon aria-hidden="true" />
                        <span>优化理由</span>
                        <p title={suggestion.rationale}>{suggestion.rationale}</p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="ai-comparison">
                        <div data-tone="original">
                          <span>
                            <QuoteIcon aria-hidden="true" />
                            原文
                          </span>
                          <p>
                            {diff.original.length > 0
                              ? renderDiffSegments(diff.original, "removed")
                              : "当前内容为空"}
                          </p>
                        </div>
                        <div data-tone="revised">
                          <span>
                            <SparklesIcon aria-hidden="true" />
                            优化稿
                          </span>
                          <p>{renderDiffSegments(diff.revised, "added")}</p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLocateSuggestion(suggestion)}
                      >
                        <CrosshairIcon data-icon="inline-start" />
                        定位
                      </Button>
                      <Button
                        size="sm"
                        disabled={applied}
                        onClick={() => handleApplySuggestion(suggestion)}
                      >
                        <CheckIcon data-icon="inline-start" />
                        {applied ? "已应用" : "应用建议"}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}

          {output?.type === "interview-questions" && (
            <div className="ai-result-list">
              <p className="ai-disclaimer">{output.disclaimer}</p>
              {output.questions.map((question, index) => {
                const sourceLabel = getInterviewSourceLabel(
                  document,
                  question.relatedItemId,
                )
                return (
                  <Card
                    className="ai-result-card ai-question-card"
                    data-difficulty={question.difficulty}
                    data-result-kind="interview"
                    key={question.id}
                  >
                    <CardHeader>
                      <div className="ai-question-meta">
                        <Badge className="ai-question-category" variant="outline">
                          {question.category}
                        </Badge>
                        <Badge
                          className="ai-question-difficulty"
                          data-difficulty={question.difficulty}
                          variant="secondary"
                        >
                          {question.difficulty}
                        </Badge>
                      </div>
                      <CardTitle className="ai-question-title">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{question.question}</strong>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="ai-question-content">
                      <section className="ai-key-points">
                        <header>
                          <TargetIcon aria-hidden="true" />
                          <span>回答重点</span>
                        </header>
                        <ul>
                          {question.keyPoints.map((point) => (
                            <li key={`${question.id}-${point}`}>{point}</li>
                          ))}
                        </ul>
                      </section>
                      <section className="ai-answer-direction">
                        <header>
                          <LightbulbIcon aria-hidden="true" />
                          <span>答题思路</span>
                        </header>
                        <p>{question.answerDirection}</p>
                      </section>
                      <section className="ai-suggested-answer">
                        <header>
                          <MessageSquareQuoteIcon aria-hidden="true" />
                          <span>建议回答</span>
                          <small title={sourceLabel}>依据：{sourceLabel}</small>
                        </header>
                        <p>{question.suggestedAnswer}</p>
                      </section>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {provider && <p className="ai-provider">模型：{provider}</p>}
      </SheetContent>

      <AiPromptEditor
        open={promptEditorOpen}
        onOpenChange={setPromptEditorOpen}
        prompts={aiPrompts}
        onSave={(next) => {
          // 恢复默认后再次保存即可清掉本地存储，无需单独的清除回调。
          setAiPrompts(saveBrowserAiPrompts(storageOwnerId, next))
        }}
      />
    </Sheet>
  )
}
