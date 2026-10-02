"use client"

import {
  CheckIcon,
  ChevronDownIcon,
  ImagesIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PanelsTopLeftIcon,
  TypeIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible"
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { ScrollArea } from "../../components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group"
import {
  documentFontFamilies,
  type ResumeDocument,
  type ResumeSectionStyle,
  sectionFontFamilies,
  sectionStylePresets,
} from "../../shared/resume-schema/resume-schema"
import {
  getTemplateScheme,
  templateSchemes,
} from "../../shared/resume-template/template-schemes"
import { applyTemplateScheme } from "../resume-template/apply-template-scheme"
import { ResourceInspector } from "./resource-inspector"
import { TemplateThumbnail } from "./template-thumbnail"
import { ValidatedNumberField } from "./validated-number-field"

const fontLabels = {
  inherit: "跟随文档",
  sans: "现代无衬线",
  serif: "经典衬线",
  mono: "等宽技术",
  humanist: "人文无衬线",
} as const

const presetLabels = {
  default: "默认",
  compact: "紧凑",
  accent: "强调",
  timeline: "时间轴",
  card: "卡片",
} as const

interface StyleInspectorProps {
  resumeId: string
  document: ResumeDocument
  assetUrls: Record<string, string>
  selectedSectionId: string
  selectedPageIndex: number
  pageCount: number
  selectedPlacementId: string | null
  collapsed: boolean
  onChange: (document: ResumeDocument) => void
  onCollapsedChange: (collapsed: boolean) => void
  onSelectPlacement: (placementId: string | null) => void
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="style-color-control">
        <Input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label}颜色选择器`}
        />
        <Input
          value={value}
          maxLength={7}
          onChange={(event) => {
            if (/^#[0-9a-fA-F]{6}$/.test(event.target.value)) {
              onChange(event.target.value)
            }
          }}
          aria-label={`${label}十六进制值`}
        />
      </div>
    </Field>
  )
}

export function StyleInspector({
  resumeId,
  document,
  assetUrls,
  selectedSectionId,
  selectedPageIndex,
  pageCount,
  selectedPlacementId,
  collapsed,
  onChange,
  onCollapsedChange,
  onSelectPlacement,
}: StyleInspectorProps) {
  const selectedSection = document.sections.find(
    (section) => section.id === selectedSectionId,
  )
  const selectedTemplateScheme = getTemplateScheme(document.template.id)
  const [activeTab, setActiveTab] = useState(
    selectedPlacementId ? "resources" : selectedSection ? "section" : "document",
  )
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false)

  useEffect(() => {
    if (selectedPlacementId) {
      setActiveTab("resources")
    }
  }, [selectedPlacementId])

  function updateDocumentStyle(patch: Partial<ResumeDocument["style"]>): void {
    onChange({
      ...document,
      style: { ...document.style, ...patch },
    })
  }

  function updateSectionStyle(patch: Partial<ResumeSectionStyle>): void {
    if (!selectedSection) {
      return
    }
    onChange({
      ...document,
      sections: document.sections.map((section) =>
        section.id === selectedSection.id
          ? { ...section, style: { ...section.style, ...patch } }
          : section,
      ),
    })
  }

  if (collapsed) {
    return (
      <aside className="style-inspector" data-collapsed="true">
        <Button
          className="style-inspector-expand"
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="展开样式调整区域"
          onClick={() => onCollapsedChange(false)}
        >
          <PanelRightOpenIcon />
        </Button>
      </aside>
    )
  }

  return (
    <aside className="style-inspector" data-collapsed="false">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="style-inspector-tabs-root"
      >
        <div className="style-inspector-topbar">
          <TabsList className="style-inspector-tabs">
            <TabsTrigger value="document">
              <PanelsTopLeftIcon />
              文档
            </TabsTrigger>
            <TabsTrigger value="section">
              <TypeIcon />
              当前区块
            </TabsTrigger>
            <TabsTrigger value="resources">
              <ImagesIcon />
              资源
            </TabsTrigger>
          </TabsList>
          <Button
            className="style-inspector-collapse"
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="折叠样式调整区域"
            onClick={() => onCollapsedChange(true)}
          >
            <PanelRightCloseIcon />
          </Button>
        </div>

        <ScrollArea className="style-inspector-scroll">
          <TabsContent value="document" className="style-inspector-content">
            <Collapsible
              open={templateLibraryOpen}
              onOpenChange={setTemplateLibraryOpen}
            >
              <Card>
                <CardHeader>
                  <CardTitle>文档模板</CardTitle>
                  <CardDescription>当前模板与完整模板库。</CardDescription>
                  <div className="style-template-current">
                    <TemplateThumbnail scheme={selectedTemplateScheme} />
                    <div>
                      <strong>{selectedTemplateScheme.name}</strong>
                      <small>{selectedTemplateScheme.category}</small>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        aria-label={templateLibraryOpen ? "收起模板库" : "更换文档模板"}
                      >
                        {templateLibraryOpen ? "收起" : "更换"}
                        <ChevronDownIcon data-icon="inline-end" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent
                  className="style-template-library"
                  aria-label="完整模板库"
                >
                  <CardContent>
                    <div className="style-template-preview-grid">
                      {templateSchemes.map((scheme) => {
                        const selected = document.template.id === scheme.id
                        return (
                          <button
                            type="button"
                            className="style-template-option"
                            key={scheme.id}
                            data-selected={selected}
                            aria-pressed={selected}
                            aria-label={`应用${scheme.name}模板`}
                            onClick={() => {
                              onChange(applyTemplateScheme(document, scheme.id))
                            }}
                          >
                            <TemplateThumbnail scheme={scheme} />
                            <strong>{scheme.name}</strong>
                            <small>{scheme.category}</small>
                            {selected ? (
                              <CheckIcon
                                className="style-template-option-check"
                                aria-hidden="true"
                              />
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <Card>
              <CardHeader>
                <CardTitle>全局排版</CardTitle>
                <CardDescription>控制 A4 画布的基础阅读节奏。</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel>字体</FieldLabel>
                    <Select
                      value={document.style.fontFamily}
                      onValueChange={(value) =>
                        updateDocumentStyle({
                          fontFamily: value as ResumeDocument["style"]["fontFamily"],
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {documentFontFamilies.map((font) => (
                            <SelectItem key={font} value={font}>
                              {fontLabels[font]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="style-control-grid">
                    <ValidatedNumberField
                      id="document-font-size"
                      label="正文字号"
                      value={document.style.baseFontSize}
                      min={9}
                      max={18}
                      suffix="px"
                      onChange={(baseFontSize) =>
                        updateDocumentStyle({
                          baseFontSize: baseFontSize ?? document.style.baseFontSize,
                        })
                      }
                    />
                    <ValidatedNumberField
                      id="document-line-height"
                      label="行高"
                      value={document.style.lineHeight}
                      min={1.2}
                      max={2.2}
                      step={0.05}
                      suffix="×"
                      onChange={(lineHeight) =>
                        updateDocumentStyle({
                          lineHeight: lineHeight ?? document.style.lineHeight,
                        })
                      }
                    />
                    <ValidatedNumberField
                      id="document-page-margin"
                      label="页边距"
                      value={document.style.pageMargin}
                      min={32}
                      max={96}
                      suffix="px"
                      integer
                      onChange={(pageMargin) =>
                        updateDocumentStyle({
                          pageMargin: pageMargin ?? document.style.pageMargin,
                        })
                      }
                    />
                    <ValidatedNumberField
                      id="document-section-gap"
                      label="区块间距"
                      value={document.style.sectionGap}
                      min={12}
                      max={48}
                      suffix="px"
                      integer
                      onChange={(sectionGap) =>
                        updateDocumentStyle({
                          sectionGap: sectionGap ?? document.style.sectionGap,
                        })
                      }
                    />
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>文档色彩</CardTitle>
                <CardDescription>配置纸张、正文和强调色。</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <ColorField
                    id="document-accent-color"
                    label="强调色"
                    value={document.style.accentColor}
                    onChange={(accentColor) => updateDocumentStyle({ accentColor })}
                  />
                  <ColorField
                    id="document-text-color"
                    label="正文色"
                    value={document.style.textColor}
                    onChange={(textColor) => updateDocumentStyle({ textColor })}
                  />
                  <ColorField
                    id="document-page-background"
                    label="纸张色"
                    value={document.style.pageBackground}
                    onChange={(pageBackground) =>
                      updateDocumentStyle({ pageBackground })
                    }
                  />
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="section" className="style-inspector-content">
            {!selectedSection ? (
              <Card>
                <CardHeader>
                  <CardTitle>个人信息区</CardTitle>
                  <CardDescription>
                    页首继承文档样式，请切换到“文档”调整其排版。
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>区块预设</CardTitle>
                    <CardDescription>
                      为“{selectedSection.title}”快速应用局部布局。
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ToggleGroup
                      type="single"
                      value={selectedSection.style.preset}
                      onValueChange={(value) => {
                        if (value) {
                          updateSectionStyle({
                            preset: value as ResumeSectionStyle["preset"],
                          })
                        }
                      }}
                      className="style-preset-group"
                      spacing={2}
                      aria-label="区块样式预设"
                    >
                      {sectionStylePresets.map((preset) => (
                        <ToggleGroupItem key={preset} value={preset} variant="outline">
                          {presetLabels[preset]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>字体与颜色</CardTitle>
                    <CardDescription>仅覆盖当前选中的区块。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <Field>
                        <FieldLabel>区块字体</FieldLabel>
                        <Select
                          value={selectedSection.style.fontFamily}
                          onValueChange={(value) =>
                            updateSectionStyle({
                              fontFamily: value as ResumeSectionStyle["fontFamily"],
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {sectionFontFamilies.map((font) => (
                                <SelectItem key={font} value={font}>
                                  {fontLabels[font]}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <ValidatedNumberField
                        id="section-font-size"
                        label="区块字号"
                        value={selectedSection.style.fontSize}
                        min={8}
                        max={24}
                        suffix="px"
                        allowEmpty
                        description={`留空则继承文档字号（${document.style.baseFontSize}px）。`}
                        onChange={(fontSize) => updateSectionStyle({ fontSize })}
                      />
                      <Field>
                        <FieldLabel htmlFor="section-color">区块颜色</FieldLabel>
                        <div className="style-color-control">
                          <Input
                            id="section-color"
                            type="color"
                            value={
                              selectedSection.style.color ?? document.style.textColor
                            }
                            onChange={(event) =>
                              updateSectionStyle({ color: event.target.value })
                            }
                          />
                          <Input
                            value={selectedSection.style.color ?? ""}
                            placeholder="继承正文色"
                            onChange={(event) =>
                              updateSectionStyle({
                                color: /^#[0-9a-fA-F]{6}$/.test(event.target.value)
                                  ? event.target.value
                                  : null,
                              })
                            }
                            aria-label="区块颜色十六进制值"
                          />
                        </div>
                      </Field>
                    </FieldGroup>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>区块间距</CardTitle>
                    <CardDescription>调整当前区块前后的留白。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="style-control-grid">
                      <ValidatedNumberField
                        id="section-spacing-before"
                        label="上方间距"
                        value={selectedSection.style.spacingBefore}
                        min={0}
                        max={64}
                        suffix="px"
                        integer
                        onChange={(spacingBefore) =>
                          updateSectionStyle({
                            spacingBefore:
                              spacingBefore ?? selectedSection.style.spacingBefore,
                          })
                        }
                      />
                      <ValidatedNumberField
                        id="section-spacing-after"
                        label="下方间距"
                        value={selectedSection.style.spacingAfter}
                        min={0}
                        max={64}
                        suffix="px"
                        integer
                        onChange={(spacingAfter) =>
                          updateSectionStyle({
                            spacingAfter:
                              spacingAfter ?? selectedSection.style.spacingAfter,
                          })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="resources" className="style-inspector-content">
            <ResourceInspector
              resumeId={resumeId}
              document={document}
              assetUrls={assetUrls}
              selectedPageIndex={selectedPageIndex}
              pageCount={pageCount}
              selectedPlacementId={selectedPlacementId}
              onChange={onChange}
              onSelectPlacement={onSelectPlacement}
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </aside>
  )
}
