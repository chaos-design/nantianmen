import { EyeIcon, FileTextIcon, ShieldCheckIcon } from "lucide-react"
import Link from "next/link"
import { Badge } from "../../components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import type { AuthContext } from "../../server/auth/auth-context"
import type { AnnouncementOverview } from "../../server/domain/announcement-service"
import type { ResumeListItem as ResumeListItemData } from "../../server/domain/resume-service"
import { maximumMemberResumeCount } from "../../shared/resume-schema/resume-policy"
import { AnnouncementAdminEntry } from "../announcement/announcement-admin-entry"
import { SignOutButton } from "../auth/sign-out-button"
import { resolveWorkspaceCreationMode } from "./workspace-creation-mode"
import { WorkspaceHeader } from "./workspace-header"
import { WorkspaceResumeLibrary } from "./workspace-resume-library"
import {
  WorkspaceCreateResumeDialog,
  WorkspaceTemplateLibrary,
} from "./workspace-template-library"

interface ResumeWorkspaceProps {
  actor: AuthContext
  resumes: ResumeListItemData[]
  /** 仅管理员可见的全量公告，由服务端下发；普通成员和 Preview 为 null。 */
  managedAnnouncements?: AnnouncementOverview | null
}

export function ResumeWorkspace({
  actor,
  resumes,
  managedAnnouncements = null,
}: ResumeWorkspaceProps) {
  const previewMode = actor.mode === "preview"
  const creationMode = resolveWorkspaceCreationMode(previewMode, resumes.length)
  const resumeLimitReached =
    !actor.isAdmin && !previewMode && resumes.length >= maximumMemberResumeCount
  return (
    <main className="workspace-shell">
      <WorkspaceHeader>
        <Link className="brand-mark brand-mark-compact" href="/">
          <span>R</span>
          <span>Résumé Lab</span>
        </Link>
        <div className="workspace-account">
          <div>
            <strong>{actor.email}</strong>
            {previewMode ? (
              <Badge variant="outline">
                <EyeIcon data-icon="inline-start" />
                Preview
              </Badge>
            ) : null}
            {actor.isAdmin ? (
              <Badge variant="secondary">
                <ShieldCheckIcon data-icon="inline-start" />
                管理员
              </Badge>
            ) : null}
          </div>
          <div className="workspace-account">
            {/* Preview 会话永远不是管理员，服务端也拒绝其写入，这里直接不渲染入口。 */}
            {actor.isAdmin && !previewMode && managedAnnouncements ? (
              <AnnouncementAdminEntry initialAnnouncements={managedAnnouncements} />
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </WorkspaceHeader>

      <section className="workspace-heading">
        <div>
          <span>WORKSPACE</span>
          <h1>
            {previewMode ? "Preview 简历" : actor.isAdmin ? "全部简历" : "我的简历"}
          </h1>
          <p>
            {previewMode
              ? "当前为只读测试模式，可查看 A4、Web 和分享预览，不能编辑或删除。"
              : actor.isAdmin
                ? "管理员可查看和维护全部账号及历史无归属简历。"
                : resumeLimitReached
                  ? `已达到 ${maximumMemberResumeCount} 份简历上限，删除旧简历后可继续创建。`
                  : "所有草稿均绑定已验证邮箱，可跨设备继续编辑。"}
          </p>
          {!actor.isAdmin && !previewMode ? (
            <Badge variant={resumeLimitReached ? "destructive" : "outline"}>
              简历 {resumes.length} / {maximumMemberResumeCount}
            </Badge>
          ) : null}
        </div>
        {creationMode === "dialog" ? (
          <WorkspaceCreateResumeDialog disabled={resumeLimitReached} />
        ) : null}
      </section>

      {creationMode === "inline" ? <WorkspaceTemplateLibrary /> : null}

      {resumes.length > 0 ? (
        <WorkspaceResumeLibrary
          resumes={resumes}
          currentUserId={actor.userId}
          showOwner={actor.isAdmin}
          readOnly={previewMode}
        />
      ) : previewMode ? (
        <Empty className="workspace-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>Preview 数据未初始化</EmptyTitle>
            <EmptyDescription>
              请先执行测试数据重建脚本，生成固定测试简历。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
    </main>
  )
}
