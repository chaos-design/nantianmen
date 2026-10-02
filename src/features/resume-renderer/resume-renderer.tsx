import { Globe2Icon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react"
import type { CSSProperties } from "react"
import { resumeFontStacks } from "../../shared/design-tokens/resume-template-tokens"
import type { ResumeLinkTarget } from "../../shared/resume-schema/resume-link-target"
import { formatResumePeriod } from "../../shared/resume-schema/resume-period"
import type {
  ResumeDocument,
  ResumeItem,
  ResumeSection,
} from "../../shared/resume-schema/resume-schema"
import {
  getTemplateAppearanceClass,
  getTemplateScheme,
} from "../../shared/resume-template/template-schemes"

interface ResumeRendererProps {
  document: ResumeDocument
  mode?: "preview" | "public"
  showProfile?: boolean
  selectedSectionId?: string
  linkedTarget?: ResumeLinkTarget | null
}

function isHttpUrl(href: string | undefined): boolean {
  return Boolean(href && /^https?:\/\//i.test(href))
}

function ContactItem({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof MailIcon
  label: string
  href?: string
}) {
  if (!label) {
    return null
  }

  const content = (
    <>
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </>
  )

  return href ? (
    <a
      className="resume-contact-item"
      href={href}
      target={isHttpUrl(href) ? "_blank" : undefined}
      rel={isHttpUrl(href) ? "noreferrer" : undefined}
    >
      {content}
    </a>
  ) : (
    <span className="resume-contact-item">{content}</span>
  )
}

function ResumeContactList({ document }: { document: ResumeDocument }) {
  return (
    <div className="resume-contact-list">
      <ContactItem
        icon={MailIcon}
        label={document.profile.email}
        href={document.profile.email ? `mailto:${document.profile.email}` : undefined}
      />
      <ContactItem
        icon={PhoneIcon}
        label={document.profile.phone}
        href={document.profile.phone ? `tel:${document.profile.phone}` : undefined}
      />
      <ContactItem icon={MapPinIcon} label={document.profile.location} />
      <ContactItem
        icon={Globe2Icon}
        label={document.profile.website}
        href={
          document.profile.website
            ? document.profile.website.startsWith("http")
              ? document.profile.website
              : `https://${document.profile.website}`
            : undefined
        }
      />
    </div>
  )
}

function ResumeProfileView({
  document,
  selected,
  showContacts,
  linked,
}: {
  document: ResumeDocument
  selected: boolean
  showContacts: boolean
  linked: boolean
}) {
  return (
    <header
      className="resume-profile"
      data-section-id="profile"
      data-selected={selected}
      data-json-linked={linked || undefined}
    >
      <div className="resume-profile-heading">
        <p className="resume-kicker">{document.metadata.targetRole}</p>
        <h1>{document.profile.name || "未命名候选人"}</h1>
        <p className="resume-headline">{document.profile.headline}</p>
      </div>
      {showContacts && <ResumeContactList document={document} />}
      {document.profile.summary && (
        <p className="resume-summary">{document.profile.summary}</p>
      )}
    </header>
  )
}

function ResumeItemView({
  item,
  sectionType,
  linked,
}: {
  item: ResumeItem
  sectionType: ResumeSection["type"]
  linked: boolean
}) {
  if (sectionType === "skills") {
    return (
      <article
        className="resume-skill-group"
        data-item-id={item.id}
        data-json-linked={linked || undefined}
      >
        {item.title && <h3>{item.title}</h3>}
        <div className="resume-skill-list">
          {item.skills.map((skill) => (
            <span key={`${item.id}-${skill}`}>{skill}</span>
          ))}
        </div>
      </article>
    )
  }

  const period = formatResumePeriod(item)
  const showHeader = Boolean(item.title || item.subtitle || period || item.location)

  return (
    <article
      className="resume-item"
      data-item-id={item.id}
      data-json-linked={linked || undefined}
    >
      {showHeader ? (
        <header className="resume-item-header">
          <div>
            {item.title ? <h3>{item.title}</h3> : null}
            {item.subtitle ? (
              <p className="resume-item-subtitle">{item.subtitle}</p>
            ) : null}
          </div>
          <div className="resume-item-meta">
            {period ? <span>{period}</span> : null}
            {item.location ? <span>{item.location}</span> : null}
          </div>
        </header>
      ) : null}
      {item.description && (
        <p className="resume-item-description">{item.description}</p>
      )}
      {item.highlights.length > 0 && (
        <ul className="resume-highlight-list">
          {item.highlights.map((highlight, index) => (
            <li key={`${item.id}-highlight-${index}`}>{highlight}</li>
          ))}
        </ul>
      )}
      {item.skills.length > 0 && (
        <div className="resume-inline-skills">
          {item.skills.map((skill) => (
            <span key={`${item.id}-${skill}`}>{skill}</span>
          ))}
        </div>
      )}
      {item.url && (
        <a
          className="resume-item-link"
          href={item.url}
          target={isHttpUrl(item.url) ? "_blank" : undefined}
          rel={isHttpUrl(item.url) ? "noreferrer" : undefined}
        >
          {item.url}
        </a>
      )}
    </article>
  )
}

function ResumeSectionView({
  section,
  selected,
  linkedTarget,
}: {
  section: ResumeSection
  selected: boolean
  linkedTarget?: ResumeLinkTarget | null
}) {
  if (!section.visible || section.items.length === 0) {
    return null
  }

  return (
    <section
      className="resume-section"
      data-section-id={section.id}
      data-section-type={section.type}
      data-style-preset={section.style.preset}
      data-selected={selected}
      data-json-linked={
        linkedTarget?.kind === "section" && linkedTarget.sectionId === section.id
          ? true
          : undefined
      }
      style={
        {
          "--section-color": section.style.color ?? "inherit",
          "--section-font-family":
            section.style.fontFamily === "inherit"
              ? "inherit"
              : resumeFontStacks[section.style.fontFamily],
          "--section-font-size": section.style.fontSize
            ? `${section.style.fontSize}px`
            : "inherit",
          "--section-spacing-before": `${section.style.spacingBefore}px`,
          "--section-spacing-after": `${section.style.spacingAfter}px`,
        } as CSSProperties
      }
    >
      <h2>{section.title}</h2>
      <div className="resume-section-content">
        {section.items.map((item) => (
          <ResumeItemView
            key={item.id}
            item={item}
            sectionType={section.type}
            linked={
              linkedTarget?.kind === "item" &&
              linkedTarget.sectionId === section.id &&
              (item.id === linkedTarget.itemId ||
                item.id.startsWith(`${linkedTarget.itemId}::continuation-`))
            }
          />
        ))}
      </div>
    </section>
  )
}

export function ResumeRenderer({
  document,
  mode = "preview",
  showProfile = true,
  selectedSectionId,
  linkedTarget,
}: ResumeRendererProps) {
  const scheme = getTemplateScheme(document.template.id)
  const visibleSections = document.sections.filter((section) => section.visible)
  const sidebarSections =
    scheme.layout === "sidebar"
      ? visibleSections.filter((section) =>
          ["skills", "certification"].includes(section.type),
        )
      : []
  const mainSections =
    scheme.layout === "sidebar"
      ? visibleSections.filter(
          (section) => !["skills", "certification"].includes(section.type),
        )
      : visibleSections
  const useSidebarLayout = scheme.layout === "sidebar"
  const profile = showProfile ? (
    <ResumeProfileView
      document={document}
      selected={selectedSectionId === "profile"}
      showContacts={!useSidebarLayout}
      linked={linkedTarget?.kind === "profile"}
    />
  ) : null

  return (
    <article
      className={`resume-document ${getTemplateAppearanceClass(scheme)}`}
      data-accent={document.template.theme.accent}
      data-density={document.template.theme.density}
      data-layout={useSidebarLayout ? "sidebar" : "single"}
      data-mode={mode}
      data-profile-visible={showProfile}
      style={
        {
          "--resume-accent": document.style.accentColor,
          "--resume-background": document.style.pageBackground,
          "--resume-paper": document.style.pageBackground,
          "--resume-text-color": document.style.textColor,
          "--resume-text": document.style.textColor,
          "--resume-font-family": resumeFontStacks[document.style.fontFamily],
          "--resume-font-size": `${document.style.baseFontSize}px`,
          "--resume-line-height": document.style.lineHeight,
          "--resume-page-margin": `${document.style.pageMargin}px`,
          "--resume-section-gap": `${document.style.sectionGap}px`,
          "--resume-sidebar-width": `${scheme.sidebar?.width ?? 0}px`,
          "--resume-sidebar-fill":
            scheme.sidebar?.background ?? "var(--resume-background)",
          "--resume-sidebar-foreground":
            scheme.sidebar?.foreground ?? "var(--resume-text-color)",
          "--resume-sidebar-muted": scheme.sidebar?.muted ?? "var(--resume-text-color)",
          "--resume-sidebar-highlight":
            scheme.sidebar?.highlight ?? "var(--resume-accent)",
        } as CSSProperties
      }
    >
      {useSidebarLayout ? (
        <div className="resume-split-layout">
          <aside className="resume-sidebar" data-continuation={!showProfile}>
            {showProfile ? (
              <div className="resume-sidebar-contact">
                <p>CONTACT</p>
                <ResumeContactList document={document} />
              </div>
            ) : null}
            {sidebarSections.map((section) => (
              <ResumeSectionView
                key={section.id}
                section={section}
                selected={selectedSectionId === section.id}
                linkedTarget={linkedTarget}
              />
            ))}
          </aside>
          <div className="resume-primary">
            {profile}
            <main className="resume-main">
              {mainSections.map((section) => (
                <ResumeSectionView
                  key={section.id}
                  section={section}
                  selected={selectedSectionId === section.id}
                  linkedTarget={linkedTarget}
                />
              ))}
            </main>
          </div>
        </div>
      ) : (
        <>
          {profile}
          <main className="resume-main">
            {mainSections.map((section) => (
              <ResumeSectionView
                key={section.id}
                section={section}
                selected={selectedSectionId === section.id}
                linkedTarget={linkedTarget}
              />
            ))}
          </main>
        </>
      )}
    </article>
  )
}
