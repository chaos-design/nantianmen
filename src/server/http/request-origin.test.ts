import { describe, expect, it } from "vitest"
import { assertSameOrigin, RequestOriginError } from "./request-origin"

describe("request origin", () => {
  it("accepts a matching origin", () => {
    const request = new Request("https://resume.example/api/resumes", {
      method: "POST",
      headers: { origin: "https://resume.example" },
    })

    expect(() => assertSameOrigin(request)).not.toThrow()
  })

  it("uses the external host when the internal request url was normalized", () => {
    const request = new Request("http://localhost:3000/api/resumes", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3100",
      },
    })

    expect(() => assertSameOrigin(request)).not.toThrow()
  })

  it.each([null, "https://attacker.example", "not-a-url"])(
    "rejects invalid origin %s",
    (origin) => {
      const headers = new Headers()
      if (origin) {
        headers.set("origin", origin)
      }
      const request = new Request("https://resume.example/api/resumes", {
        method: "POST",
        headers,
      })

      expect(() => assertSameOrigin(request)).toThrow(RequestOriginError)
    },
  )
})
