import { type APIRequestContext, test as base, expect } from "@playwright/test"

interface ResumeListItem {
  id: string
}

async function readResumeIds(request: APIRequestContext): Promise<string[]> {
  const response = await request.get("/api/resumes")
  if (!response.ok()) {
    return []
  }
  const payload = (await response.json()) as { data?: ResumeListItem[] }
  return payload.data?.map((resume) => resume.id) ?? []
}

/**
 * E2E 的文件数据库按进程划分，整套用例共用一个库。
 * 简历创建到 maximumMemberResumeCount 后「新建简历」被禁用，
 * 后续所有需要新建简历的用例会连锁失败，整套跑完永远是红灯。
 * 每个用例前清空可以恢复真正的隔离，同时不改动任何生产策略。
 */
export const test = base.extend<{ cleanSlate: undefined }>({
  cleanSlate: [
    async ({ request, baseURL }, use) => {
      const origin = new URL(baseURL ?? "http://127.0.0.1:3000").origin
      const clear = async () => {
        const ids = await readResumeIds(request)
        await Promise.all(
          ids.map((id) =>
            // DELETE 走同源校验，必须带上 Origin。
            request
              .delete(`/api/resumes/${id}`, { headers: { origin } })
              .catch(() => null),
          ),
        )
      }
      await clear()
      // fixture 自身不产出返回值，用 undefined 占位以满足无值 fixture 的签名。
      await use(undefined)
      // 清掉本用例产生的资源，避免下一个用例继承残留。
      await clear()
    },
    { auto: true },
  ],
})

export { expect }
