import { describe, expect, it } from "vitest"
import { validateNumberDraft } from "./validated-number-field"

const options = {
  label: "宽度",
  min: 0,
  max: 794,
}

describe("validateNumberDraft", () => {
  it("returns the exact valid number without clamping or rounding", () => {
    expect(validateNumberDraft("12.75", options)).toEqual({
      value: 12.75,
      error: null,
    })
    expect(validateNumberDraft("0", options)).toEqual({
      value: 0,
      error: null,
    })
  })

  it("keeps empty and out-of-range drafts invalid", () => {
    expect(validateNumberDraft("", options)).toEqual({
      value: null,
      error: "请输入宽度",
    })
    expect(validateNumberDraft("795", options)).toEqual({
      value: null,
      error: "宽度不能大于 794",
    })
  })

  it("supports optional empty values and explicit integer validation", () => {
    expect(validateNumberDraft("", { ...options, allowEmpty: true })).toEqual({
      value: null,
      error: null,
    })
    expect(validateNumberDraft("1.5", { ...options, integer: true })).toEqual({
      value: null,
      error: "宽度必须为整数",
    })
  })

  it("validates decimal steps from the configured minimum", () => {
    const lineHeightOptions = {
      label: "行高",
      min: 1.2,
      max: 2.2,
      step: 0.05,
    }

    expect(validateNumberDraft("1.35", lineHeightOptions)).toEqual({
      value: 1.35,
      error: null,
    })
    expect(validateNumberDraft("1.33", lineHeightOptions)).toEqual({
      value: null,
      error: "行高必须以 0.05 为步长",
    })
  })
})
