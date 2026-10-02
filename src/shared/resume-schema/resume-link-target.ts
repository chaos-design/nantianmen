export type ResumeLinkTarget =
  | {
      kind: "profile"
    }
  | {
      kind: "section"
      sectionId: string
    }
  | {
      kind: "item"
      sectionId: string
      itemId: string
    }
