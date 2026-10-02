import type { ReactNode } from "react"
import type { WebTemplateId } from "../../shared/resume-template/web-template-schemes"
import {
  getWebTemplateMotionProfile,
  type WebTemplateMotionScene,
} from "./web-template-gsap-motion"

interface MotionLayerProps {
  children: ReactNode
  layer: "frame" | "flow" | "points"
}

function MotionLayer({ children, layer }: MotionLayerProps) {
  return (
    <span
      className={`web-resume-motion-layer web-resume-motion-layer-${layer}`}
      data-gsap-layer={layer}
      data-motion-layer={layer}
    >
      <svg viewBox="0 0 640 640" fill="none" focusable="false" aria-hidden="true">
        {children}
      </svg>
    </span>
  )
}

function OrbitScene() {
  return (
    <>
      <MotionLayer layer="frame">
        <rect
          className="web-motion-frame"
          x="92"
          y="92"
          width="456"
          height="456"
          rx="28"
        />
        <circle
          className="web-motion-ring web-motion-ring-outer"
          cx="320"
          cy="320"
          r="218"
        />
        <circle
          className="web-motion-ring web-motion-ring-inner"
          cx="320"
          cy="320"
          r="132"
        />
      </MotionLayer>
      <MotionLayer layer="flow">
        <path
          className="web-motion-flow"
          d="M102 348c54-152 194-236 346-176 48 18 88 54 112 100"
        />
        <path
          className="web-motion-flow web-motion-flow-secondary"
          d="M82 426c92 92 230 126 354 76 66-26 112-72 140-134"
        />
        <path
          className="web-motion-axis web-motion-axis-diagonal"
          d="m126 514 388-388"
        />
      </MotionLayer>
      <MotionLayer layer="points">
        <circle
          className="web-motion-node web-motion-node-a"
          cx="458"
          cy="172"
          r="12"
        />
        <circle className="web-motion-node web-motion-node-b" cx="164" cy="420" r="8" />
        <circle
          className="web-motion-node web-motion-node-c"
          cx="354"
          cy="514"
          r="16"
        />
      </MotionLayer>
    </>
  )
}

function EditorialScene() {
  return (
    <>
      <MotionLayer layer="frame">
        <rect
          className="web-motion-frame"
          x="108"
          y="72"
          width="424"
          height="496"
          rx="8"
        />
        <path className="web-motion-axis" d="M148 142h344M148 184h238" />
        <path className="web-motion-axis web-motion-axis-diagonal" d="M462 96v448" />
      </MotionLayer>
      <MotionLayer layer="flow">
        <path
          className="web-motion-flow"
          d="M150 276c70-52 130-58 194-18 56 36 104 36 148 0"
        />
        <path
          className="web-motion-flow web-motion-flow-secondary"
          d="M150 352c82-34 150-22 204 34 46 48 92 56 138 24"
        />
        <path
          className="web-motion-organic"
          d="M150 468c86-20 162-10 228 30 42 26 80 34 114 22"
        />
      </MotionLayer>
      <MotionLayer layer="points">
        <rect
          className="web-motion-block web-motion-block-a"
          x="148"
          y="214"
          width="58"
          height="18"
        />
        <rect
          className="web-motion-block web-motion-block-b"
          x="406"
          y="452"
          width="86"
          height="42"
        />
        <circle className="web-motion-node web-motion-node-a" cx="462" cy="142" r="9" />
        <circle className="web-motion-node web-motion-node-b" cx="172" cy="522" r="6" />
      </MotionLayer>
    </>
  )
}

function GeometryScene() {
  return (
    <>
      <MotionLayer layer="frame">
        <rect className="web-motion-frame" x="84" y="84" width="472" height="472" />
        <path className="web-motion-axis" d="M64 320h512M320 64v512" />
        <path
          className="web-motion-axis web-motion-axis-diagonal"
          d="m104 536 432-432"
        />
      </MotionLayer>
      <MotionLayer layer="flow">
        <circle
          className="web-motion-ring web-motion-ring-outer"
          cx="320"
          cy="320"
          r="192"
        />
        <circle
          className="web-motion-ring web-motion-ring-inner"
          cx="320"
          cy="320"
          r="76"
        />
        <path className="web-motion-scan" d="M128 228h384M128 412h384" />
      </MotionLayer>
      <MotionLayer layer="points">
        <rect
          className="web-motion-block web-motion-block-a"
          x="112"
          y="120"
          width="96"
          height="96"
        />
        <rect
          className="web-motion-block web-motion-block-b"
          x="420"
          y="396"
          width="116"
          height="116"
        />
        <circle
          className="web-motion-node web-motion-node-a"
          cx="448"
          cy="170"
          r="14"
        />
        <circle
          className="web-motion-node web-motion-node-b"
          cx="172"
          cy="436"
          r="10"
        />
      </MotionLayer>
    </>
  )
}

function SignalScene() {
  return (
    <>
      <MotionLayer layer="frame">
        <rect
          className="web-motion-frame"
          x="80"
          y="96"
          width="480"
          height="448"
          rx="16"
        />
        <path className="web-motion-axis" d="M104 192h432M104 448h432" />
        <path
          className="web-motion-ring web-motion-ring-inner"
          d="M452 154a62 62 0 1 1-1 0"
        />
      </MotionLayer>
      <MotionLayer layer="flow">
        <path
          className="web-motion-flow"
          d="M104 332h76l34-92 62 190 54-150 44 78 34-112 44 86h84"
        />
        <path
          className="web-motion-flow web-motion-flow-secondary"
          d="M104 390c88-38 154-42 216-8 68 38 132 34 216-18"
        />
        <path className="web-motion-scan" d="M120 232h400M120 416h400" />
      </MotionLayer>
      <MotionLayer layer="points">
        <circle
          className="web-motion-node web-motion-node-a"
          cx="214"
          cy="240"
          r="10"
        />
        <circle className="web-motion-node web-motion-node-b" cx="374" cy="358" r="8" />
        <circle
          className="web-motion-node web-motion-node-c"
          cx="452"
          cy="332"
          r="13"
        />
        <rect
          className="web-motion-block web-motion-block-a"
          x="120"
          y="132"
          width="68"
          height="18"
        />
      </MotionLayer>
    </>
  )
}

function OrganicScene() {
  return (
    <>
      <MotionLayer layer="frame">
        <circle
          className="web-motion-ring web-motion-ring-outer"
          cx="320"
          cy="320"
          r="224"
        />
        <path
          className="web-motion-frame"
          d="M144 488c-34-116-8-224 78-324 62-72 146-96 250-72"
        />
      </MotionLayer>
      <MotionLayer layer="flow">
        <path
          className="web-motion-organic"
          d="M290 530c-10-158 30-290 120-396M306 392c-88-16-142-70-164-162M328 320c80-28 132-82 156-164"
        />
        <path
          className="web-motion-flow web-motion-flow-secondary"
          d="M110 468c102 54 196 54 282 0 58-36 108-46 150-28"
        />
      </MotionLayer>
      <MotionLayer layer="points">
        <path
          className="web-motion-leaf"
          d="M304 390c-94 4-144-48-148-146 94-4 144 44 148 146Z"
        />
        <path
          className="web-motion-leaf"
          d="M330 318c18-98 82-144 180-130-18 98-78 146-180 130Z"
        />
        <circle className="web-motion-node web-motion-node-a" cx="410" cy="134" r="9" />
        <circle className="web-motion-node web-motion-node-b" cx="290" cy="530" r="7" />
      </MotionLayer>
    </>
  )
}

const sceneComponents: Record<WebTemplateMotionScene, () => ReactNode> = {
  orbit: OrbitScene,
  editorial: EditorialScene,
  geometry: GeometryScene,
  signal: SignalScene,
  organic: OrganicScene,
}

export function WebResumeMotionScene({ templateId }: { templateId: WebTemplateId }) {
  const scene = getWebTemplateMotionProfile(templateId).scene
  const Scene = sceneComponents[scene]

  return (
    <div
      className="web-resume-motion-scene"
      data-motion-scene={scene}
      data-web-motion-scene=""
      aria-hidden="true"
    >
      <div className="web-resume-motion-stage" data-web-motion-stage="">
        <Scene />
      </div>
    </div>
  )
}
