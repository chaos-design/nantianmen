import type { CSSProperties } from "react"
import type { WebTemplateScheme } from "../../shared/resume-template/web-template-schemes"

export function WebTemplateThumbnail({ scheme }: { scheme: WebTemplateScheme }) {
  return (
    <span
      className="web-template-thumbnail"
      data-composition={scheme.composition}
      aria-hidden="true"
      style={
        {
          "--thumbnail-background": scheme.thumbnail.background,
          "--thumbnail-surface": scheme.thumbnail.surface,
          "--thumbnail-text": scheme.thumbnail.text,
          "--thumbnail-muted": scheme.thumbnail.muted,
          "--thumbnail-accent": scheme.thumbnail.accent,
        } as CSSProperties
      }
    >
      <i className="web-template-thumbnail-nav" />
      <i className="web-template-thumbnail-title" />
      <i className="web-template-thumbnail-copy" />
      <i className="web-template-thumbnail-media" />
      <i className="web-template-thumbnail-rule" />
    </span>
  )
}
