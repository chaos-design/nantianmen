import type { WebTemplateId } from "../../shared/resume-template/web-template-schemes"

export type WebTemplateMotionScene =
  | "orbit"
  | "editorial"
  | "geometry"
  | "signal"
  | "organic"

export interface WebTemplateMotionVector {
  x: number
  y: number
  rotation: number
  scale: number
  duration: number
}

export interface WebTemplateMotionProfile {
  family: string
  scene: WebTemplateMotionScene
  ease: string
  intro: WebTemplateMotionVector & {
    stagger: number
  }
  frame: WebTemplateMotionVector
  flow: WebTemplateMotionVector
  points: WebTemplateMotionVector
}

export interface WebTemplateScrollMotion {
  x: number
  y: number
  rotation: number
}

export const webTemplateMotionProfiles: Readonly<
  Record<WebTemplateId, WebTemplateMotionProfile>
> = {
  "digital-archive": {
    family: "archive-orbit",
    scene: "orbit",
    ease: "power3.out",
    intro: {
      x: -24,
      y: 12,
      rotation: -2,
      scale: 0.97,
      duration: 1.08,
      stagger: 0.11,
    },
    frame: { x: 4, y: -8, rotation: 2, scale: 1.01, duration: 12 },
    flow: { x: 12, y: -6, rotation: -1, scale: 1, duration: 9 },
    points: { x: -6, y: 8, rotation: 7, scale: 1.02, duration: 15 },
  },
  "editorial-canvas": {
    family: "editorial-drift",
    scene: "editorial",
    ease: "power2.out",
    intro: {
      x: 0,
      y: 28,
      rotation: -1.5,
      scale: 0.98,
      duration: 1.2,
      stagger: 0.14,
    },
    frame: { x: 8, y: -6, rotation: -1.4, scale: 1, duration: 14 },
    flow: { x: -10, y: 10, rotation: 1.2, scale: 1.01, duration: 12 },
    points: { x: 6, y: -8, rotation: 3, scale: 0.99, duration: 16 },
  },
  "kinetic-grid": {
    family: "kinetic-grid",
    scene: "geometry",
    ease: "power4.out",
    intro: {
      x: 30,
      y: 0,
      rotation: 0,
      scale: 0.96,
      duration: 0.88,
      stagger: 0.07,
    },
    frame: { x: 8, y: 0, rotation: 0.8, scale: 1, duration: 5.2 },
    flow: { x: -12, y: 6, rotation: -0.8, scale: 1, duration: 4.6 },
    points: { x: 10, y: -8, rotation: 4, scale: 1.02, duration: 6.4 },
  },
  "executive-noir": {
    family: "noir-orbit",
    scene: "orbit",
    ease: "expo.out",
    intro: {
      x: 18,
      y: 16,
      rotation: 2,
      scale: 0.98,
      duration: 1.25,
      stagger: 0.15,
    },
    frame: { x: 2, y: -6, rotation: 3.5, scale: 1.01, duration: 18 },
    flow: { x: -7, y: 5, rotation: -1, scale: 1, duration: 14 },
    points: { x: 5, y: -5, rotation: -4, scale: 0.99, duration: 16 },
  },
  "portfolio-studio": {
    family: "studio-float",
    scene: "organic",
    ease: "power3.out",
    intro: {
      x: 22,
      y: 22,
      rotation: 2.5,
      scale: 0.95,
      duration: 1.18,
      stagger: 0.13,
    },
    frame: { x: -8, y: -10, rotation: -2, scale: 1.01, duration: 13 },
    flow: { x: 12, y: 8, rotation: 2, scale: 1.02, duration: 11 },
    points: { x: -10, y: 10, rotation: 5, scale: 0.98, duration: 14 },
  },
  "terminal-signal": {
    family: "terminal-scan",
    scene: "signal",
    ease: "power2.out",
    intro: {
      x: -30,
      y: 0,
      rotation: 0,
      scale: 0.98,
      duration: 0.9,
      stagger: 0.08,
    },
    frame: { x: 4, y: 10, rotation: 0, scale: 1, duration: 6.8 },
    flow: { x: 0, y: 18, rotation: 0, scale: 1, duration: 4.4 },
    points: { x: 12, y: -6, rotation: 2, scale: 1.01, duration: 7.2 },
  },
  "paper-journal": {
    family: "paper-breathe",
    scene: "editorial",
    ease: "power2.out",
    intro: {
      x: 0,
      y: 24,
      rotation: 1,
      scale: 0.98,
      duration: 1.3,
      stagger: 0.16,
    },
    frame: { x: 4, y: -5, rotation: 1, scale: 1.005, duration: 17 },
    flow: { x: -6, y: 7, rotation: -1, scale: 1, duration: 15 },
    points: { x: 5, y: -4, rotation: 2, scale: 0.995, duration: 18 },
  },
  "swiss-ledger": {
    family: "ledger-precision",
    scene: "editorial",
    ease: "power4.out",
    intro: {
      x: 26,
      y: 0,
      rotation: 0,
      scale: 0.97,
      duration: 0.92,
      stagger: 0.08,
    },
    frame: { x: 6, y: 0, rotation: 0.5, scale: 1, duration: 8 },
    flow: { x: -8, y: 4, rotation: -0.5, scale: 1, duration: 7 },
    points: { x: 8, y: -5, rotation: 3, scale: 1.01, duration: 9 },
  },
  "bauhaus-poster": {
    family: "bauhaus-geometry",
    scene: "geometry",
    ease: "back.out(1.2)",
    intro: {
      x: -32,
      y: 18,
      rotation: -4,
      scale: 0.95,
      duration: 1,
      stagger: 0.09,
    },
    frame: { x: 8, y: -8, rotation: 2.5, scale: 1, duration: 7 },
    flow: { x: -12, y: 7, rotation: -2, scale: 1, duration: 6 },
    points: { x: 14, y: -10, rotation: 7, scale: 1.025, duration: 7.6 },
  },
  "aurora-glass": {
    family: "aurora-orbit",
    scene: "orbit",
    ease: "expo.out",
    intro: {
      x: 0,
      y: 24,
      rotation: 0,
      scale: 0.94,
      duration: 1.3,
      stagger: 0.14,
    },
    frame: { x: 6, y: -10, rotation: 6, scale: 1.03, duration: 13 },
    flow: { x: -14, y: 9, rotation: -3, scale: 1.02, duration: 10 },
    points: { x: 12, y: -8, rotation: -7, scale: 1.035, duration: 12 },
  },
  "botanical-editorial": {
    family: "botanical-breathe",
    scene: "organic",
    ease: "power2.out",
    intro: {
      x: -12,
      y: 26,
      rotation: -2,
      scale: 0.97,
      duration: 1.35,
      stagger: 0.16,
    },
    frame: { x: 5, y: -7, rotation: -1.5, scale: 1, duration: 16 },
    flow: { x: 10, y: -9, rotation: 2, scale: 1.015, duration: 14 },
    points: { x: -8, y: 10, rotation: -4, scale: 0.99, duration: 15 },
  },
  "mono-brutalist": {
    family: "mono-shift",
    scene: "geometry",
    ease: "power4.out",
    intro: {
      x: 34,
      y: -12,
      rotation: 4,
      scale: 0.96,
      duration: 0.86,
      stagger: 0.07,
    },
    frame: { x: -8, y: 6, rotation: -1.5, scale: 1, duration: 5.5 },
    flow: { x: 12, y: -6, rotation: 1.5, scale: 1, duration: 5 },
    points: { x: -14, y: 10, rotation: -7, scale: 1.02, duration: 6 },
  },
  "clay-studio": {
    family: "clay-float",
    scene: "organic",
    ease: "power2.out",
    intro: {
      x: 16,
      y: 28,
      rotation: 2,
      scale: 0.96,
      duration: 1.3,
      stagger: 0.15,
    },
    frame: { x: -6, y: -9, rotation: -2, scale: 1.015, duration: 15 },
    flow: { x: 10, y: 8, rotation: 2, scale: 1.01, duration: 13 },
    points: { x: -9, y: 11, rotation: 4, scale: 0.985, duration: 16 },
  },
  "midnight-product": {
    family: "midnight-signal",
    scene: "signal",
    ease: "power3.out",
    intro: {
      x: 24,
      y: 14,
      rotation: 0,
      scale: 0.96,
      duration: 1.02,
      stagger: 0.09,
    },
    frame: { x: 6, y: -8, rotation: 2, scale: 1.015, duration: 9 },
    flow: { x: -12, y: 10, rotation: -1, scale: 1.01, duration: 7 },
    points: { x: 10, y: -8, rotation: -4, scale: 1.03, duration: 8 },
  },
  "solar-future": {
    family: "solar-canopy",
    scene: "organic",
    ease: "expo.out",
    intro: {
      x: 14,
      y: 30,
      rotation: 2,
      scale: 0.95,
      duration: 1.2,
      stagger: 0.13,
    },
    frame: { x: -7, y: -9, rotation: -2, scale: 1.015, duration: 14 },
    flow: { x: 11, y: 8, rotation: 2.5, scale: 1.02, duration: 11 },
    points: { x: -9, y: 10, rotation: 5, scale: 0.985, duration: 15 },
  },
  "analog-radio": {
    family: "analog-tuning",
    scene: "orbit",
    ease: "back.out(1.1)",
    intro: {
      x: 32,
      y: -10,
      rotation: 4,
      scale: 0.95,
      duration: 0.98,
      stagger: 0.09,
    },
    frame: { x: 7, y: -7, rotation: 4, scale: 1.015, duration: 10 },
    flow: { x: -11, y: 7, rotation: -2, scale: 1.01, duration: 7.5 },
    points: { x: 12, y: -9, rotation: -7, scale: 1.025, duration: 9 },
  },
  "capital-deck": {
    family: "capital-metrics",
    scene: "editorial",
    ease: "power4.out",
    intro: {
      x: 26,
      y: 12,
      rotation: 0,
      scale: 0.97,
      duration: 0.96,
      stagger: 0.08,
    },
    frame: { x: 6, y: -5, rotation: 0.5, scale: 1.005, duration: 11 },
    flow: { x: -9, y: 6, rotation: -0.5, scale: 1, duration: 8 },
    points: { x: 10, y: -7, rotation: 3, scale: 1.015, duration: 10 },
  },
  "luxury-retail": {
    family: "luxury-showcase",
    scene: "orbit",
    ease: "expo.out",
    intro: {
      x: 18,
      y: 26,
      rotation: 2,
      scale: 0.95,
      duration: 1.3,
      stagger: 0.15,
    },
    frame: { x: -5, y: -8, rotation: -3, scale: 1.015, duration: 18 },
    flow: { x: 9, y: 7, rotation: 2, scale: 1.01, duration: 14 },
    points: { x: -8, y: 10, rotation: 5, scale: 0.99, duration: 16 },
  },
  "cloud-architecture": {
    family: "cloud-topology",
    scene: "geometry",
    ease: "power3.out",
    intro: {
      x: -24,
      y: 18,
      rotation: -1,
      scale: 0.96,
      duration: 1.04,
      stagger: 0.09,
    },
    frame: { x: 8, y: -7, rotation: 1, scale: 1.01, duration: 9 },
    flow: { x: -12, y: 9, rotation: -1.5, scale: 1.015, duration: 7 },
    points: { x: 13, y: -10, rotation: 6, scale: 1.02, duration: 8 },
  },
  "security-command": {
    family: "security-alert",
    scene: "signal",
    ease: "power4.out",
    intro: {
      x: 34,
      y: 0,
      rotation: 0,
      scale: 0.96,
      duration: 0.84,
      stagger: 0.06,
    },
    frame: { x: -8, y: 8, rotation: -1, scale: 1, duration: 6.4 },
    flow: { x: 14, y: -10, rotation: 1, scale: 1.01, duration: 4.8 },
    points: { x: -14, y: 9, rotation: -6, scale: 1.025, duration: 6 },
  },
}

export function getWebTemplateMotionProfile(
  templateId: WebTemplateId,
): WebTemplateMotionProfile {
  return webTemplateMotionProfiles[templateId]
}

export function getWebTemplateScrollMotion(
  templateId: WebTemplateId,
  scrollProgress: number,
  amplitude = 1,
): WebTemplateScrollMotion {
  const normalizedProgress = Number.isFinite(scrollProgress)
    ? Math.min(1, Math.max(0, scrollProgress))
    : 0
  const normalizedAmplitude = Number.isFinite(amplitude) ? Math.max(0, amplitude) : 1
  if (normalizedProgress === 0 || normalizedAmplitude === 0) {
    return { x: 0, y: 0, rotation: 0 }
  }
  const easedProgress = normalizedProgress * (2 - normalizedProgress)
  const profile = getWebTemplateMotionProfile(templateId)

  return {
    x: profile.flow.x * 0.8 * easedProgress * normalizedAmplitude,
    y: -(28 + Math.abs(profile.frame.y) * 1.5) * easedProgress * normalizedAmplitude,
    rotation: profile.frame.rotation * 0.35 * easedProgress * normalizedAmplitude,
  }
}
