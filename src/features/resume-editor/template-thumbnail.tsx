import type { TemplateScheme } from "../../shared/resume-template/template-schemes"

interface TemplateThumbnailProps {
  scheme: TemplateScheme
}

export function TemplateThumbnail({ scheme }: TemplateThumbnailProps) {
  const sidebar = scheme.layout === "sidebar"
  const compact = scheme.thumbnail.density === "compact"
  const editorial = scheme.thumbnail.composition === "editorial"

  return (
    <svg
      className="template-thumbnail"
      data-template={scheme.id}
      viewBox="0 0 144 96"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        className="template-thumbnail-page"
        width="144"
        height="96"
        rx="3"
        style={{ fill: scheme.thumbnail.page }}
      />
      {sidebar && (
        <rect
          className="template-thumbnail-sidebar"
          width="42"
          height="96"
          rx="3"
          style={{ fill: scheme.thumbnail.sidebar }}
        />
      )}
      <rect
        className="template-thumbnail-accent"
        x={sidebar ? 9 : 14}
        y="12"
        width={editorial ? 22 : sidebar ? 24 : 38}
        height="4"
        rx="2"
        style={{ fill: scheme.thumbnail.accent }}
      />
      <rect
        className="template-thumbnail-title"
        x={sidebar ? 52 : 14}
        y="13"
        width={sidebar ? 72 : 82}
        height={editorial ? 9 : 6}
        rx="2"
        style={{ fill: scheme.thumbnail.title }}
      />
      <rect
        className="template-thumbnail-copy"
        x={sidebar ? 52 : 14}
        y={editorial ? 29 : 25}
        width={sidebar ? 72 : 116}
        height="3"
        rx="1.5"
        style={{ fill: scheme.thumbnail.copy }}
      />
      <rect
        className="template-thumbnail-copy"
        x={sidebar ? 52 : 14}
        y={editorial ? 36 : 32}
        width={sidebar ? 58 : compact ? 116 : 94}
        height="3"
        rx="1.5"
        style={{ fill: scheme.thumbnail.copy }}
      />
      <rect
        className="template-thumbnail-rule"
        x={sidebar ? 52 : 14}
        y="45"
        width={sidebar ? 72 : 116}
        height="1"
        style={{ fill: scheme.thumbnail.rule }}
      />
      <rect
        className="template-thumbnail-copy"
        x={sidebar ? 52 : 14}
        y="54"
        width={sidebar ? 64 : 105}
        height="4"
        rx="2"
        style={{ fill: scheme.thumbnail.copy }}
      />
      <rect
        className="template-thumbnail-copy"
        x={sidebar ? 52 : 14}
        y="63"
        width={sidebar ? 72 : 116}
        height="3"
        rx="1.5"
        style={{ fill: scheme.thumbnail.copy }}
      />
      <rect
        className="template-thumbnail-copy"
        x={sidebar ? 52 : 14}
        y="70"
        width={sidebar ? 52 : compact ? 116 : 86}
        height="3"
        rx="1.5"
        style={{ fill: scheme.thumbnail.copy }}
      />
      {sidebar && (
        <>
          <circle
            className="template-thumbnail-avatar"
            cx="21"
            cy="31"
            r="8"
            style={{ fill: scheme.thumbnail.accent }}
          />
          <rect
            className="template-thumbnail-sidebar-copy"
            x="9"
            y="48"
            width="24"
            height="3"
            rx="1.5"
            style={{ fill: scheme.thumbnail.copy }}
          />
          <rect
            className="template-thumbnail-sidebar-copy"
            x="9"
            y="56"
            width="19"
            height="3"
            rx="1.5"
            style={{ fill: scheme.thumbnail.copy }}
          />
        </>
      )}
    </svg>
  )
}
