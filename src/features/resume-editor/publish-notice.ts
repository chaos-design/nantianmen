export const PUBLISH_NOTICE_DURATION_MS = 3000

export interface PublishNotice {
  message: string
  options: {
    description: string
    duration: number
  }
}

function formatPublishedAt(publishedAt: string): string {
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) {
    return publishedAt
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function buildPublishNotice(input: {
  publicationVersion: number
  publishedAt: string
}): PublishNotice {
  return {
    message: `已发布版本 V${input.publicationVersion}`,
    options: {
      description: `发布时间：${formatPublishedAt(input.publishedAt)}`,
      duration: PUBLISH_NOTICE_DURATION_MS,
    },
  }
}
