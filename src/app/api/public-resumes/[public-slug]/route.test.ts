import { afterEach, describe, expect, it, vi } from "vitest"
import { ResumeService } from "../../../../server/domain/resume-service"
import { setResumeRepositoryForTests } from "../../../../server/repositories/repository-factory"
import { InMemoryResumeRepository } from "../../../../server/repositories/resume-repository"
import { GET } from "./route"

const viewerState = vi.hoisted(() => ({
  viewer: null as null | {
    userId: string
    email: string
    isAdmin: boolean
    mode: "user"
  },
  testUserId: null as string | null,
}))

vi.mock("../../../../server/auth/auth-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../server/auth/auth-context")>()
  return {
    ...actual,
    getOptionalPublicViewer: async () => viewerState.viewer,
    getTestResumePolicy: () => ({ testUserId: viewerState.testUserId }),
  }
})

const memberUserId = "00000000-0000-4000-8000-000000000001"
const adminUserId = "00000000-0000-4000-8000-000000000003"
const testUserId = "00000000-0000-4000-8000-000000000009"

afterEach(() => {
  viewerState.viewer = null
  viewerState.testUserId = null
  setResumeRepositoryForTests(undefined)
})

function requestPublicResume(publicSlug: string) {
  return GET(new Request(`http://localhost/api/public-resumes/${publicSlug}`), {
    params: Promise.resolve({ "public-slug": publicSlug }),
  })
}

async function seedPublishedResumes() {
  const repository = new InMemoryResumeRepository()
  const service = new ResumeService(repository)
  const testResume = await service.createResume({
    userId: testUserId,
    isAdmin: false,
  })
  const memberResume = await service.createResume({
    userId: memberUserId,
    isAdmin: false,
  })
  await service.publishResume(testResume.resume.id, {
    userId: testUserId,
    isAdmin: false,
  })
  await service.publishResume(memberResume.resume.id, {
    userId: memberUserId,
    isAdmin: false,
  })
  setResumeRepositoryForTests(repository)
  return {
    testSlug: testResume.resume.publicSlug,
    memberSlug: memberResume.resume.publicSlug,
  }
}

describe("public resume route", () => {
  it("keeps published resumes readable for anonymous visitors without a test account", async () => {
    const { testSlug, memberSlug } = await seedPublishedResumes()

    await expect(requestPublicResume(memberSlug)).resolves.toMatchObject({
      status: 200,
    })
    await expect(requestPublicResume(testSlug)).resolves.toMatchObject({
      status: 200,
    })
  })

  it("hides test resumes from anonymous visitors and other members", async () => {
    const { testSlug, memberSlug } = await seedPublishedResumes()
    viewerState.testUserId = testUserId

    const anonymous = await requestPublicResume(testSlug)
    expect(anonymous.status).toBe(404)
    await expect(anonymous.json()).resolves.toMatchObject({
      error: { code: "PUBLIC_RESUME_NOT_FOUND" },
    })

    viewerState.viewer = {
      userId: memberUserId,
      email: "member@example.com",
      isAdmin: false,
      mode: "user",
    }
    await expect(requestPublicResume(testSlug)).resolves.toMatchObject({
      status: 404,
    })
    await expect(requestPublicResume(memberSlug)).resolves.toMatchObject({
      status: 200,
    })
  })

  it("serves test resumes to the test account itself and administrators", async () => {
    const { testSlug } = await seedPublishedResumes()
    viewerState.testUserId = testUserId

    viewerState.viewer = {
      userId: testUserId,
      email: "tester@example.com",
      isAdmin: false,
      mode: "user",
    }
    await expect(requestPublicResume(testSlug)).resolves.toMatchObject({
      status: 200,
    })

    viewerState.viewer = {
      userId: adminUserId,
      email: "admin@example.com",
      isAdmin: true,
      mode: "user",
    }
    await expect(requestPublicResume(testSlug)).resolves.toMatchObject({
      status: 200,
    })
  })
})
