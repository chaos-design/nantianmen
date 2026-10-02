import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/shared/resume-schema/**/*.ts",
        "src/server/auth/**/*.ts",
        "src/server/domain/**/*.ts",
      ],
      // resume-link-target.ts 只导出类型，没有可执行语句；
      // 统计它会让报告出现一个没有意义的 0%。
      exclude: ["src/shared/resume-schema/resume-link-target.ts"],
      thresholds: {
        statements: 90,
        branches: 75,
        functions: 90,
        lines: 90,
      },
    },
  },
})
