const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const commonRegistrationEmailDomains = new Set([
  "126.com",
  "139.com",
  "163.com",
  "189.cn",
  "aliyun.com",
  "foxmail.com",
  "gmail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "me.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "qq.com",
  "sina.cn",
  "sina.com",
  "sohu.com",
  "wo.cn",
  "yahoo.com",
  "yeah.net",
])

export function isValidEmail(value: string): boolean {
  return emailPattern.test(value)
}

export function isAllowedRegistrationEmail(value: string): boolean {
  if (!isValidEmail(value)) {
    return false
  }

  const domain = value.slice(value.lastIndexOf("@") + 1).toLowerCase()
  return commonRegistrationEmailDomains.has(domain)
}
