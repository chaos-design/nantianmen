export const landingRepository = {
  href: "https://github.com/chaos-design/nantianmen",
  label: "GitHub",
  path: "chaos-design/nantianmen",
} as const

export const landingLegalLinks = [
  { href: "/terms", label: "服务条款" },
  { href: "/privacy", label: "隐私政策" },
] as const

export function formatLandingFooterCopyright(year: number) {
  return `© ${year} Résumé Lab · Apache-2.0`
}
