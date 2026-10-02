"use client"

import { ArrowDownIcon } from "lucide-react"
import { type CSSProperties, useMemo, useRef } from "react"
import { resumeFontStacks } from "../../shared/design-tokens/resume-template-tokens"
import type { ResumeDocument } from "../../shared/resume-schema/resume-schema"
import {
  defaultWebTemplateId,
  getWebTemplateScheme,
  type WebTemplateId,
} from "../../shared/resume-template/web-template-schemes"
import { useWebResumeLayout } from "./use-web-resume-layout"
import { useWebResumeNavigation } from "./use-web-resume-navigation"
import { useWebTemplateGsapMotion } from "./use-web-template-gsap-motion"
import { getWebResumeSections } from "./web-resume-content"
import { WebResumeMotionScene } from "./web-resume-motion-scene"
import { WebContactList, WebResumeModule } from "./web-resume-sections"

interface ResumeWebPageProps {
  document: ResumeDocument
  contained?: boolean
  templateId?: WebTemplateId
}

export function ResumeWebPage({
  document,
  contained = false,
  templateId = defaultWebTemplateId,
}: ResumeWebPageProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const nameHeadingRef = useRef<HTMLHeadingElement>(null)
  const visibleSections = useMemo(() => getWebResumeSections(document), [document])
  const navigation = useMemo(
    () => [
      { id: "web-resume-profile", label: "个人信息" },
      ...visibleSections.map((section, index) => ({
        id: `web-resume-section-${index + 1}`,
        label: section.title,
      })),
    ],
    [visibleSections],
  )
  const displayName = document.profile.name || "未命名候选人"
  const webTemplate = getWebTemplateScheme(templateId)
  useWebTemplateGsapMotion(rootRef, contentRef, templateId)
  const nameCharacters = useMemo(() => {
    let prefix = ""
    return Array.from(displayName).map((character, index) => {
      prefix += character
      return { character, index, key: `${prefix}-${prefix.length}` }
    })
  }, [displayName])
  const { navigationRef, activeSectionId, handleNavigationClick } =
    useWebResumeNavigation({
      rootRef,
      contentRef,
      contained,
      navigation,
      templateId,
    })
  useWebResumeLayout({
    rootRef,
    navigationRef,
    nameHeadingRef,
    displayName,
    templateId,
    composition: webTemplate.composition,
    activeSectionId,
  })

  return (
    <div
      ref={rootRef}
      className="resume-web-page"
      data-contained={contained}
      data-web-template={webTemplate.id}
      data-composition={webTemplate.composition}
      data-has-hero-asset="false"
      data-tone={webTemplate.tone}
      style={
        {
          "--web-resume-accent": webTemplate.colors.accent,
          "--web-resume-background": webTemplate.colors.background,
          "--web-resume-surface": webTemplate.colors.surface,
          "--web-resume-text": webTemplate.colors.text,
          "--web-resume-muted": webTemplate.colors.muted,
          "--web-resume-grid": webTemplate.colors.grid,
          "--web-accent": "var(--web-resume-accent)",
          "--web-background": "var(--web-resume-background)",
          "--web-surface": "var(--web-resume-surface)",
          "--web-copy": "var(--web-resume-text)",
          "--web-muted": "var(--web-resume-muted)",
          "--web-grid-color": "var(--web-resume-grid)",
          "--web-font-family": webTemplate.fontFamily,
          "--web-document-font-family": resumeFontStacks[document.style.fontFamily],
        } as CSSProperties
      }
    >
      <div className="web-resume-progress" aria-hidden="true" />
      <div className="web-resume-background" aria-hidden="true">
        <div className="web-resume-grid" data-gsap-background="" />
      </div>
      <WebResumeMotionScene templateId={templateId} />

      <aside className="web-resume-navigation">
        <button
          className="web-resume-monogram"
          type="button"
          aria-label="返回 Web 简历首页"
          onClick={(event) => handleNavigationClick(event, "web-resume-profile")}
        >
          {Array.from(displayName)[0]?.toUpperCase()}
        </button>
        <nav ref={navigationRef} aria-label="简历区块导航">
          {navigation.map((item, index) => (
            <a
              href={`#${item.id}`}
              aria-label={item.label}
              aria-current={activeSectionId === item.id ? "location" : undefined}
              key={item.id}
              onClick={(event) => handleNavigationClick(event, item.id)}
            >
              <span className="web-resume-navigation-index" aria-hidden="true">
                {String(index).padStart(2, "0")}
              </span>
              <span className="web-resume-navigation-label">{item.label}</span>
            </a>
          ))}
        </nav>
        <p>SCROLL TO EXPLORE</p>
      </aside>

      <div className="web-resume-content" ref={contentRef}>
        <section
          id="web-resume-profile"
          className="web-resume-hero"
          data-reveal=""
          tabIndex={-1}
        >
          <div className="web-resume-hero-copy">
            <p className="web-resume-eyebrow">DIGITAL PROFILE</p>
            <h1 ref={nameHeadingRef} aria-label={displayName}>
              {nameCharacters.map(({ character, index, key }) => (
                <span
                  aria-hidden="true"
                  key={key}
                  style={{ "--character-index": index } as CSSProperties}
                >
                  {character}
                </span>
              ))}
            </h1>
            <p className="web-resume-role">
              {document.metadata.targetRole || document.profile.headline || "专业履历"}
            </p>
            {document.profile.headline &&
            document.profile.headline !== document.metadata.targetRole ? (
              <p className="web-resume-headline">{document.profile.headline}</p>
            ) : null}
            {document.profile.summary ? (
              <p className="web-resume-summary">{document.profile.summary}</p>
            ) : null}
            <WebContactList document={document} />
          </div>

          {visibleSections.length ? (
            <button
              className="web-resume-scroll-cue"
              type="button"
              onClick={(event) => handleNavigationClick(event, "web-resume-section-1")}
            >
              探索履历
              <ArrowDownIcon aria-hidden="true" />
            </button>
          ) : null}
        </section>

        <main className="web-resume-modules">
          {visibleSections.map((section, index) => (
            <WebResumeModule
              section={section}
              index={index}
              targetId={`web-resume-section-${index + 1}`}
              key={section.id}
            />
          ))}
        </main>
      </div>
    </div>
  )
}
