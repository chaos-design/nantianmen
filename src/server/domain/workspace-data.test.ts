import { describe, expect, it } from "vitest"
import type { Announcement } from "../../shared/announcement/announcement-schema"
import type { AnnouncementOverview } from "./announcement-service"
import type { Actor, ResumeListItem } from "./resume-service"
import { loadWorkspaceData, type WorkspaceDataSources } from "./workspace-data"

const member: Actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  isAdmin: false,
  mode: "user",
}

const admin: Actor = { ...member, isAdmin: true }

const emptyOverview: AnnouncementOverview = { announcements: [], totalCount: 0 }
const noAnnouncements: Announcement[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/**
 * 记录「谁被调用了」和调用顺序，并让每个调用都挂起，直到测试手动放行。
 * 这样就能区分「并发发出」和「串行 await」：串行实现下，第一个 await 没回来之前
 * 后面几个根本不会被调用。
 */
function gatedSources(options: { isAdmin: boolean }) {
  const started: string[] = []
  const gates = {
    resumes: deferred<void>(),
    visible: deferred<void>(),
    all: deferred<void>(),
  }
  const sources: WorkspaceDataSources = {
    async listResumes() {
      started.push("resumes")
      await gates.resumes.promise
      return [{ id: "resume-1" } as ResumeListItem]
    },
    async listVisibleAnnouncements() {
      started.push("visible")
      await gates.visible.promise
      return noAnnouncements
    },
    async listAllAnnouncements() {
      started.push("all")
      await gates.all.promise
      return { announcements: [], totalCount: 7 }
    },
  }
  void options
  return { sources, started, gates }
}

describe("loadWorkspaceData", () => {
  it("管理员的公告全量读取与另外两条同时发出，不是串行第四步", async () => {
    const { sources, started, gates } = gatedSources({ isAdmin: true })

    const pending = loadWorkspaceData(admin, sources)
    // 还没放行任何一条，三条就应该都已经开始。
    expect(started.sort()).toEqual(["all", "resumes", "visible"])

    gates.resumes.resolve()
    gates.visible.resolve()
    gates.all.resolve()
    const data = await pending

    expect(data.resumes).toHaveLength(1)
    expect(data.managedAnnouncements?.totalCount).toBe(7)
  })

  it("普通用户不请求全量公告，管理面板数据为 null", async () => {
    const { sources, started, gates } = gatedSources({ isAdmin: false })

    const pending = loadWorkspaceData(member, sources)
    expect(started.sort()).toEqual(["resumes", "visible"])

    gates.resumes.resolve()
    gates.visible.resolve()
    const data = await pending

    expect(data.managedAnnouncements).toBeNull()
    expect(data.announcements).toEqual(noAnnouncements)
  })

  it("任一条读取失败时整体失败，不吞掉错误", async () => {
    const sources: WorkspaceDataSources = {
      listResumes: async () => {
        throw new Error("resume store down")
      },
      listVisibleAnnouncements: async () => noAnnouncements,
      listAllAnnouncements: async () => emptyOverview,
    }

    await expect(loadWorkspaceData(admin, sources)).rejects.toThrow("resume store down")
  })
})
