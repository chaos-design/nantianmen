import {
  ArrowUpRightIcon,
  Globe2Icon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react"
import type {
  ResumeDocument,
  ResumeItem,
  ResumeSection,
} from "../../shared/resume-schema/resume-schema"
import {
  formatWebResumePeriod,
  hasWebResumeItemContent,
  normalizeExternalUrl,
} from "./web-resume-content"

export function WebContactList({ document }: { document: ResumeDocument }) {
  const website = normalizeExternalUrl(document.profile.website)
  const contacts = [
    document.profile.email
      ? {
          label: document.profile.email,
          href: `mailto:${document.profile.email}`,
          icon: MailIcon,
        }
      : null,
    document.profile.phone
      ? {
          label: document.profile.phone,
          href: `tel:${document.profile.phone}`,
          icon: PhoneIcon,
        }
      : null,
    document.profile.location
      ? {
          label: document.profile.location,
          href: null,
          icon: MapPinIcon,
        }
      : null,
    website
      ? {
          label: document.profile.website,
          href: website,
          icon: Globe2Icon,
        }
      : null,
  ].filter((contact) => contact !== null)

  return (
    <address className="web-resume-contacts">
      {contacts.map(({ label, href, icon: Icon }) => {
        const content = (
          <>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </>
        )
        return href ? (
          <a
            href={href}
            key={`${label}-${href}`}
            rel={href.startsWith("http") ? "noreferrer" : undefined}
            target={href.startsWith("http") ? "_blank" : undefined}
          >
            {content}
          </a>
        ) : (
          <span key={label}>{content}</span>
        )
      })}
    </address>
  )
}

function WebItemContent({ item }: { item: ResumeItem }) {
  const period = formatWebResumePeriod(item)
  const externalUrl = normalizeExternalUrl(item.url)

  return (
    <>
      <header className="web-resume-item-header">
        <div>
          <h3>{item.title || "未命名条目"}</h3>
          {item.subtitle ? <p>{item.subtitle}</p> : null}
        </div>
        {period || item.location ? (
          <div className="web-resume-item-meta">
            {period ? <time>{period}</time> : null}
            {item.location ? <span>{item.location}</span> : null}
          </div>
        ) : null}
      </header>
      {item.description ? (
        <p className="web-resume-item-description">{item.description}</p>
      ) : null}
      {item.highlights.length ? (
        <ul className="web-resume-highlights">
          {item.highlights.map((highlight, index) => (
            <li key={`${item.id}-web-highlight-${index}`}>{highlight}</li>
          ))}
        </ul>
      ) : null}
      {item.skills.length ? (
        <ul className="web-resume-tags" aria-label="相关技能">
          {item.skills.map((skill) => (
            <li key={`${item.id}-web-skill-${skill}`}>{skill}</li>
          ))}
        </ul>
      ) : null}
      {externalUrl ? (
        <a
          className="web-resume-item-link"
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
        >
          访问项目
          <ArrowUpRightIcon aria-hidden="true" />
        </a>
      ) : null}
    </>
  )
}

export function WebResumeModule({
  section,
  index,
  targetId,
}: {
  section: ResumeSection
  index: number
  targetId: string
}) {
  const visibleItems = section.items.filter((item) =>
    hasWebResumeItemContent(item, section.type),
  )

  return (
    <section
      id={targetId}
      className="web-resume-module"
      data-module-type={section.type}
      data-reveal=""
      tabIndex={-1}
    >
      <header className="web-resume-module-heading">
        <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <h2>{section.title}</h2>
      </header>

      {section.type === "skills" ? (
        <div className="web-resume-skill-matrix">
          {visibleItems.map((item) => (
            <article key={item.id}>
              <h3>{item.title || "专业能力"}</h3>
              {item.description ? <p>{item.description}</p> : null}
              <ul className="web-resume-tags" aria-label={`${item.title}技能`}>
                {item.skills.map((skill) => (
                  <li key={`${item.id}-matrix-${skill}`}>{skill}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <div className="web-resume-module-items">
          {visibleItems.map((item, itemIndex) => (
            <article
              className="web-resume-item"
              data-item-index={String(itemIndex + 1).padStart(2, "0")}
              key={item.id}
            >
              <WebItemContent item={item} />
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
