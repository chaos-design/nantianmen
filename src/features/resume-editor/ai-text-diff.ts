export interface AiTextDiffSegment {
  text: string
  changed: boolean
}

/**
 * 差异对比的规模上限。简历字段上限 4000 字符，但真实描述通常在 300 字以内；
 * 超过该规模直接退化为无差异展示，避免在浏览器里做不可控的 LCS 计算。
 */
const maximumDiffTokenCount = 400

/** 英文与数字按整词切分，CHan 逐字切分，其余字符单列，保证中文按字对比。 */
function tokenize(value: string): string[] {
  return (
    value.match(/[\p{Script=Han}]|[A-Za-z0-9]+(?:[.'’-][A-Za-z0-9]+)*|\s+|[^\s]/gu) ??
    []
  )
}

function mergeSegments(segments: AiTextDiffSegment[]): AiTextDiffSegment[] {
  const merged: AiTextDiffSegment[] = []
  for (const segment of segments) {
    const last = merged[merged.length - 1]
    if (last && last.changed === segment.changed) {
      last.text += segment.text
    } else {
      merged.push({ ...segment })
    }
  }
  return merged
}

function createUnchangedSegment(value: string): AiTextDiffSegment[] {
  return value ? [{ text: value, changed: false }] : []
}

/**
 * 逐 token 的最长公共子序列差异。返回两段文本，changed 标记该 token 是否为改写部分。
 * 完全相同的文本返回单段未变更结果。
 */
function diffTokens(
  left: string[],
  right: string[],
): { left: AiTextDiffSegment[]; right: AiTextDiffSegment[] } {
  // table[i][j] = left[i..] 与 right[j..] 的 LCS 长度
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0),
  )
  for (let i = left.length - 1; i >= 0; i -= 1) {
    const currentRow = table[i]
    const nextRow = table[i + 1]
    for (let j = right.length - 1; j >= 0; j -= 1) {
      currentRow[j] =
        left[i] === right[j]
          ? nextRow[j + 1] + 1
          : Math.max(nextRow[j], currentRow[j + 1])
    }
  }

  const leftSegments: AiTextDiffSegment[] = []
  const rightSegments: AiTextDiffSegment[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      leftSegments.push({ text: left[i], changed: false })
      rightSegments.push({ text: right[j], changed: false })
      i += 1
      j += 1
      continue
    }
    // 优先消费较短一侧的公共后缀更长的分支，得到更接近直觉的编辑脚本
    if (table[i + 1][j] >= table[i][j + 1]) {
      leftSegments.push({ text: left[i], changed: true })
      i += 1
    } else {
      rightSegments.push({ text: right[j], changed: true })
      j += 1
    }
  }
  while (i < left.length) {
    leftSegments.push({ text: left[i], changed: true })
    i += 1
  }
  while (j < right.length) {
    rightSegments.push({ text: right[j], changed: true })
    j += 1
  }

  return { left: mergeSegments(leftSegments), right: mergeSegments(rightSegments) }
}

export function diffAiText(
  original: string,
  revised: string,
): { original: AiTextDiffSegment[]; revised: AiTextDiffSegment[] } {
  if (original === revised) {
    const unchanged = createUnchangedSegment(revised)
    return { original: unchanged, revised: unchanged }
  }
  if (!original.trim() || !revised.trim()) {
    return {
      original: createUnchangedSegment(original),
      revised: createUnchangedSegment(revised),
    }
  }

  const left = tokenize(original)
  const right = tokenize(revised)
  if (left.length > maximumDiffTokenCount || right.length > maximumDiffTokenCount) {
    return {
      original: createUnchangedSegment(original),
      revised: createUnchangedSegment(revised),
    }
  }

  const diff = diffTokens(left, right)
  return { original: diff.left, revised: diff.right }
}
