"use client"

import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  ImageIcon,
  ImagePlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  createStableId,
  MAX_IMAGE_Z_INDEX,
  MAX_RESUME_PAGES,
  type ResumeDocument,
  type ResumeImageAsset,
  type ResumeImagePlacement,
} from "../../shared/resume-schema/resume-schema"
import { deleteResumeAsset, uploadResumeAsset } from "./editor-api"
import { ValidatedNumberField } from "./validated-number-field"

interface ResourceInspectorProps {
  resumeId: string
  document: ResumeDocument
  assetUrls: Record<string, string>
  selectedPageIndex: number
  pageCount: number
  selectedPlacementId: string | null
  onChange: (document: ResumeDocument) => void
  onSelectPlacement: (placementId: string | null) => void
}

export function ResourceInspector({
  resumeId,
  document,
  assetUrls,
  selectedPageIndex,
  pageCount,
  selectedPlacementId,
  onChange,
  onSelectPlacement,
}: ResourceInspectorProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const documentRef = useRef(document)
  documentRef.current = document
  const selectedPlacement = document.resources.placements.find(
    (placement) => placement.id === selectedPlacementId,
  )
  const selectedAsset = selectedPlacement
    ? document.resources.assets.find((asset) => asset.id === selectedPlacement.assetId)
    : undefined

  function updateResources(resources: ResumeDocument["resources"]) {
    const nextDocument = { ...documentRef.current, resources }
    documentRef.current = nextDocument
    onChange(nextDocument)
  }

  function updateAsset(assetId: string, patch: Partial<ResumeImageAsset>) {
    const currentResources = documentRef.current.resources
    updateResources({
      ...currentResources,
      assets: currentResources.assets.map((asset) =>
        asset.id === assetId ? { ...asset, ...patch } : asset,
      ),
    })
  }

  function updatePlacement(patch: Partial<ResumeImagePlacement>) {
    const currentResources = documentRef.current.resources
    const currentPlacement = currentResources.placements.find(
      (placement) => placement.id === selectedPlacementId,
    )
    if (!currentPlacement) {
      return
    }
    const draft = { ...currentPlacement, ...patch }
    let width: number
    let height: number
    if (draft.shape === "circle") {
      const requestedSize =
        patch.width ??
        patch.height ??
        (patch.shape === "circle"
          ? Math.min(currentPlacement.width, currentPlacement.height)
          : currentPlacement.width)
      width = requestedSize
      height = requestedSize
    } else {
      width = draft.width
      height = draft.height
    }
    const nextPlacement: ResumeImagePlacement = {
      ...draft,
      width,
      height,
    }
    updateResources({
      ...currentResources,
      placements: currentResources.placements.map((placement) =>
        placement.id === currentPlacement.id ? nextPlacement : placement,
      ),
    })
  }

  function addPlacement(asset: ResumeImageAsset) {
    const currentResources = documentRef.current.resources
    if (currentResources.placements.length >= 50) {
      toast.error("每份简历最多放置 50 张图片")
      return
    }
    const portrait = asset.height >= asset.width * 1.05
    const width = portrait ? 144 : 240
    const height = portrait ? 144 : 160
    const highestLayer = currentResources.placements.reduce(
      (highest, placement) => Math.max(highest, placement.zIndex),
      0,
    )
    const placement: ResumeImagePlacement = {
      id: createStableId("placement"),
      assetId: asset.id,
      pageIndex: selectedPageIndex,
      x: (A4_PAGE_WIDTH - width) / 2,
      y: (A4_PAGE_HEIGHT - height) / 2,
      width,
      height,
      zIndex: Math.min(MAX_IMAGE_Z_INDEX, highestLayer + 1),
      objectFit: "cover",
      shape: portrait ? "circle" : "rectangle",
    }
    updateResources({
      ...currentResources,
      placements: [...currentResources.placements, placement],
    })
    onSelectPlacement(placement.id)
    toast.success(`图片已添加到第 ${selectedPageIndex + 1} 页`)
  }

  async function handleUpload(file: File) {
    setIsUploading(true)
    try {
      const asset = await uploadResumeAsset({
        resumeId,
        file,
      })
      const currentResources = documentRef.current.resources
      updateResources({
        ...currentResources,
        assets: [...currentResources.assets, asset],
      })
      toast.success("图片已上传到资源库")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片上传失败")
    } finally {
      setIsUploading(false)
      if (uploadInputRef.current) {
        uploadInputRef.current.value = ""
      }
    }
  }

  async function handleDeleteAsset(asset: ResumeImageAsset) {
    setDeletingAssetId(asset.id)
    try {
      await deleteResumeAsset(resumeId, asset.id)
      const current = documentRef.current
      const removedPlacementIds = new Set(
        current.resources.placements
          .filter((placement) => placement.assetId === asset.id)
          .map((placement) => placement.id),
      )
      onChange({
        ...current,
        resources: {
          assets: current.resources.assets.filter(
            (candidate) => candidate.id !== asset.id,
          ),
          placements: current.resources.placements.filter(
            (placement) => placement.assetId !== asset.id,
          ),
        },
      })
      if (selectedPlacementId && removedPlacementIds.has(selectedPlacementId)) {
        onSelectPlacement(null)
      }
      toast.success("图片已从资源库删除")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片删除失败")
    } finally {
      setDeletingAssetId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="resource-library-title">
            资源库
            <Badge variant="secondary">{document.resources.assets.length} / 20</Badge>
          </CardTitle>
          <CardDescription>
            PNG、JPEG 或 WebP，单个不超过 5 MB。添加到第 {selectedPageIndex + 1} 页。
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={isUploading || document.resources.assets.length >= 20}
              onClick={() => uploadInputRef.current?.click()}
            >
              <UploadIcon data-icon="inline-start" />
              {isUploading ? "上传中" : "上传"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <input
            ref={uploadInputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="选择图片资源"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleUpload(file)
              }
            }}
          />
          {document.resources.assets.length === 0 ? (
            <Empty className="resource-empty">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ImageIcon />
                </EmptyMedia>
                <EmptyTitle>尚未上传图片</EmptyTitle>
                <EmptyDescription>
                  上传头像、作品图或证书图片后即可放入页面。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="resource-library">
              {document.resources.assets.map((asset) => (
                <article
                  className="resource-card"
                  data-asset-id={asset.id}
                  key={asset.id}
                >
                  <div className="resource-thumbnail">
                    {assetUrls[asset.id] ? (
                      // biome-ignore lint/performance/noImgElement: authenticated Blob URLs cannot use the Next image optimizer
                      <img src={assetUrls[asset.id]} alt={asset.alt || asset.name} />
                    ) : (
                      <ImageIcon aria-label="图片加载中" />
                    )}
                  </div>
                  <div className="resource-card-copy">
                    <strong title={asset.name}>{asset.name}</strong>
                    <small>
                      {asset.width} × {asset.height}
                    </small>
                  </div>
                  <div className="resource-card-actions">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          disabled={deletingAssetId === asset.id}
                          aria-label={`添加资源 ${asset.name}`}
                          onClick={() => addPlacement(asset)}
                        >
                          <ImagePlusIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        添加到第 {selectedPageIndex + 1} 页
                      </TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              disabled={deletingAssetId === asset.id}
                              aria-label={`删除资源 ${asset.name}`}
                            >
                              <Trash2Icon />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>删除资源</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除“{asset.name}”？</AlertDialogTitle>
                          <AlertDialogDescription>
                            资源库文件及其所有页面放置都会被删除。已被发布快照引用的图片受保护，不能删除。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                              void handleDeleteAsset(asset)
                            }}
                          >
                            删除图片
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPlacement && selectedAsset && (
        <Card data-testid="placement-inspector">
          <CardHeader>
            <CardTitle>已选图片</CardTitle>
            <CardDescription>精确控制页面位置、裁剪方式和图层顺序。</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="resource-alt-text">替代文本</FieldLabel>
                <Input
                  id="resource-alt-text"
                  maxLength={500}
                  value={selectedAsset.alt}
                  placeholder="描述图片内容"
                  onChange={(event) =>
                    updateAsset(selectedAsset.id, { alt: event.target.value })
                  }
                />
                <FieldDescription>
                  用于无障碍阅读，不会直接显示在简历中。
                </FieldDescription>
              </Field>

              {selectedPlacement.pageIndex >= pageCount && (
                <FieldDescription className="resource-page-warning">
                  原页码已超出当前内容页数，预览会暂时显示在最后一页。
                </FieldDescription>
              )}

              <div className="style-control-grid">
                <ValidatedNumberField
                  id="placement-page"
                  label="页码"
                  value={selectedPlacement.pageIndex + 1}
                  min={1}
                  max={MAX_RESUME_PAGES}
                  integer
                  onChange={(pageNumber) =>
                    updatePlacement({ pageIndex: (pageNumber ?? 1) - 1 })
                  }
                />
                <ValidatedNumberField
                  id="placement-layer"
                  label="图层"
                  value={selectedPlacement.zIndex}
                  min={0}
                  max={MAX_IMAGE_Z_INDEX}
                  integer
                  onChange={(zIndex) => updatePlacement({ zIndex: zIndex ?? 0 })}
                />
                <ValidatedNumberField
                  id="placement-x"
                  label="X"
                  value={selectedPlacement.x}
                  min={0}
                  max={A4_PAGE_WIDTH - selectedPlacement.width}
                  onChange={(x) => updatePlacement({ x: x ?? 0 })}
                />
                <ValidatedNumberField
                  id="placement-y"
                  label="Y"
                  value={selectedPlacement.y}
                  min={0}
                  max={A4_PAGE_HEIGHT - selectedPlacement.height}
                  onChange={(y) => updatePlacement({ y: y ?? 0 })}
                />
                <ValidatedNumberField
                  id="placement-width"
                  label="宽度"
                  value={selectedPlacement.width}
                  min={0}
                  max={A4_PAGE_WIDTH - selectedPlacement.x}
                  onChange={(width) => updatePlacement({ width: width ?? 0 })}
                />
                <ValidatedNumberField
                  id="placement-height"
                  label="高度"
                  value={selectedPlacement.height}
                  min={0}
                  max={A4_PAGE_HEIGHT - selectedPlacement.y}
                  onChange={(height) => updatePlacement({ height: height ?? 0 })}
                />
              </div>

              <Field>
                <FieldLabel>裁剪方式</FieldLabel>
                <Select
                  value={selectedPlacement.objectFit}
                  onValueChange={(objectFit) =>
                    updatePlacement({
                      objectFit: objectFit as ResumeImagePlacement["objectFit"],
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="cover">裁剪填满</SelectItem>
                      <SelectItem value="contain">完整显示</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>图片形状</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={selectedPlacement.shape}
                  onValueChange={(shape) => {
                    if (shape) {
                      updatePlacement({
                        shape: shape as ResumeImagePlacement["shape"],
                      })
                    }
                  }}
                  className="resource-shape-group"
                >
                  <ToggleGroupItem value="rectangle">矩形</ToggleGroupItem>
                  <ToggleGroupItem value="rounded">圆角</ToggleGroupItem>
                  <ToggleGroupItem value="circle">圆形</ToggleGroupItem>
                </ToggleGroup>
              </Field>

              <div className="resource-layer-actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedPlacement.zIndex === 0}
                  onClick={() =>
                    updatePlacement({
                      zIndex: selectedPlacement.zIndex - 1,
                    })
                  }
                >
                  <ArrowDownToLineIcon data-icon="inline-start" />
                  下移一层
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedPlacement.zIndex === MAX_IMAGE_Z_INDEX}
                  onClick={() =>
                    updatePlacement({
                      zIndex: selectedPlacement.zIndex + 1,
                    })
                  }
                >
                  <ArrowUpToLineIcon data-icon="inline-start" />
                  上移一层
                </Button>
              </div>

              <Button
                variant="destructive"
                onClick={() => {
                  const currentResources = documentRef.current.resources
                  updateResources({
                    ...currentResources,
                    placements: currentResources.placements.filter(
                      (placement) => placement.id !== selectedPlacement.id,
                    ),
                  })
                  onSelectPlacement(null)
                }}
              >
                <Trash2Icon data-icon="inline-start" />
                移除当前图片
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      )}
    </>
  )
}
