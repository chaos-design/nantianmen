export type ResumePersistenceConfig =
  | {
      backend: "file"
      databasePath: string
      assetRootDirectory: string
    }
  | {
      backend: "supabase"
      supabaseUrl: string
      serviceRoleKey: string
      storageBucket: string
    }

type Environment = Readonly<Record<string, string | undefined>>

export class ServerConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ServerConfigurationError"
  }
}

function readRequiredValue(environment: Environment, name: string): string {
  const value = environment[name]?.trim()
  if (!value) {
    throw new ServerConfigurationError(`缺少服务端配置：${name}`)
  }
  return value
}

function normalizeSupabaseUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ServerConfigurationError("服务端配置 SUPABASE_URL 不是有效 URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ServerConfigurationError("服务端配置 SUPABASE_URL 必须使用 http 或 https")
  }
  return value.replace(/\/+$/, "")
}

function readFileBackendConfig(environment: Environment): ResumePersistenceConfig {
  return {
    backend: "file",
    databasePath: environment.RESUME_FILE_DATABASE_PATH?.trim() || ".data/resumes.json",
    assetRootDirectory: environment.RESUME_FILE_ASSET_DIR?.trim() || ".data/assets",
  }
}

export function readResumePersistenceConfig(
  environment: Environment = process.env,
): ResumePersistenceConfig {
  const backend = environment.RESUME_DATA_BACKEND?.trim()
  if (!backend) {
    if (environment.NODE_ENV === "production") {
      throw new ServerConfigurationError("生产环境必须配置 RESUME_DATA_BACKEND")
    }
    return readFileBackendConfig(environment)
  }

  if (backend === "file") {
    if (environment.NODE_ENV === "production") {
      throw new ServerConfigurationError(
        "生产环境 RESUME_DATA_BACKEND 必须配置为 supabase",
      )
    }
    return readFileBackendConfig(environment)
  }
  if (backend !== "supabase") {
    throw new ServerConfigurationError(
      "服务端配置 RESUME_DATA_BACKEND 只能是 file 或 supabase",
    )
  }

  const supabaseUrl = normalizeSupabaseUrl(
    readRequiredValue(environment, "SUPABASE_URL"),
  )
  const serviceRoleKey = readRequiredValue(environment, "SUPABASE_SERVICE_ROLE_KEY")
  const bucketValue = environment.SUPABASE_STORAGE_BUCKET
  const storageBucket = bucketValue === undefined ? "resume-assets" : bucketValue.trim()
  if (!storageBucket) {
    throw new ServerConfigurationError("服务端配置 SUPABASE_STORAGE_BUCKET 不能为空")
  }

  return {
    backend,
    supabaseUrl,
    serviceRoleKey,
    storageBucket,
  }
}
