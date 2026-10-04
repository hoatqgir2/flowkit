import { useState, useEffect, useCallback } from 'react'
import { fetchAPI } from '../../api/client'
import { useWebSocketContext } from '../../api/useWebSocketContext'
import { useTranslation } from '../../i18n/useTranslation'
import type { TranslationKey } from '../../i18n/translations'
import { statusLabel, stateLabel } from '../../i18n/labels'
import type { Project, Video, Character, Scene, Request, SceneReview, StatusType } from '../../types'
import { count, sceneStageStatus, charStatus, latestRequest, type SceneStage } from '../../lib/stageStats'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarGroup } from '../ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Sparkles, Film, RefreshCw, Eye, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import StageNode from './StageNode'
import SceneCard from './SceneCard'
import SceneDetailSheet from './SceneDetailSheet'

type StageKey = 'refs' | 'image' | 'video' | 'upscale'

interface PipelineViewProps {
  projectId: string
  videoId: string
}

const STAGE_META: { key: StageKey; idx: string; nameKey: TranslationKey; subtitleKey: TranslationKey }[] = [
  { key: 'refs', idx: '01', nameKey: 'pipeline.railName.refs', subtitleKey: 'pipeline.railSubtitle.refs' },
  { key: 'image', idx: '02', nameKey: 'pipeline.railName.image', subtitleKey: 'pipeline.railSubtitle.image' },
  { key: 'video', idx: '03', nameKey: 'pipeline.railName.video', subtitleKey: 'pipeline.railSubtitle.video' },
  { key: 'upscale', idx: '04', nameKey: 'pipeline.railName.upscale', subtitleKey: 'pipeline.railSubtitle.upscale' },
]

const RETRY_TYPE: Record<SceneStage, string> = {
  image: 'REGENERATE_IMAGE',
  video: 'REGENERATE_VIDEO',
  upscale: 'UPSCALE_VIDEO',
}

export default function PipelineView({ projectId, videoId }: PipelineViewProps) {
  const { t } = useTranslation()
  const [project, setProject] = useState<Project | null>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [requests, setRequests] = useState<Request[]>([])

  const [activeStage, setActiveStage] = useState<StageKey>('image')
  const [sortFailedFirst, setSortFailedFirst] = useState(false)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reviews, setReviews] = useState<Record<string, SceneReview>>({})
  const [reviewRunning, setReviewRunning] = useState<{ sceneId: string; mode: 'light' | 'deep' } | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [retryingSceneId, setRetryingSceneId] = useState<string | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [concatLoading, setConcatLoading] = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)

  const { lastEvent } = useWebSocketContext()

  const load = useCallback(async () => {
    const [p, v, c, s, r] = await Promise.all([
      fetchAPI<Project>(`/api/projects/${projectId}`),
      fetchAPI<Video>(`/api/videos/${videoId}`),
      fetchAPI<Character[]>(`/api/projects/${projectId}/characters`),
      fetchAPI<Scene[]>(`/api/scenes?video_id=${videoId}`),
      fetchAPI<Request[]>(`/api/requests?project_id=${projectId}`),
    ])
    setProject(p)
    setVideo(v)
    setCharacters(c)
    setScenes(s)
    setRequests(r)
  }, [projectId, videoId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!lastEvent) return
    // The backend only ever emits 'request_update' (on PROCESSING/COMPLETED/FAILED transitions),
    // 'worker_tick', and 'urls_refreshed' — any of them means something in this pipeline may have changed.
    if (lastEvent.type === 'request_update' || lastEvent.type === 'urls_refreshed') {
      load()
    }
  }, [lastEvent, load])

  const videoRequests = requests.filter(r => r.video_id === videoId)
  const anyProcessing = videoRequests.some(r => r.status === 'PROCESSING')
  const pendingCount = videoRequests.filter(r => r.status === 'PENDING').length

  const stageBreakdown: Record<StageKey, ReturnType<typeof count>> = {
    refs: count(characters.map(c => charStatus(c, requests))),
    image: count(scenes.map(s => sceneStageStatus(s, 'image'))),
    video: count(scenes.map(s => sceneStageStatus(s, 'video'))),
    upscale: count(scenes.map(s => sceneStageStatus(s, 'upscale'))),
  }

  let gridScenes = scenes.slice()
  if (activeStage !== 'refs' && sortFailedFirst) {
    const rank: Record<StatusType, number> = { FAILED: 0, PROCESSING: 1, PENDING: 2, COMPLETED: 3 }
    gridScenes = gridScenes.sort((a, b) => rank[sceneStageStatus(a, activeStage as SceneStage)] - rank[sceneStageStatus(b, activeStage as SceneStage)])
  }

  const selectedScene = scenes.find(s => s.id === selectedSceneId) ?? null
  const sheetStage = activeStage === 'refs' ? 'image' : (activeStage as SceneStage)
  const sheetStageMeta = STAGE_META.find(m => m.key === activeStage)!

  function openScene(sceneId: string) {
    setSelectedSceneId(sceneId)
    setSheetOpen(true)
    setReviewError(null)
  }

  async function runReview(mode: 'light' | 'deep') {
    if (!selectedScene) return
    setReviewRunning({ sceneId: selectedScene.id, mode })
    setReviewError(null)
    try {
      const result = await fetchAPI<SceneReview>(
        `/api/videos/${videoId}/scenes/${selectedScene.id}/review?project_id=${projectId}&mode=${mode}`,
        { method: 'POST' }
      )
      setReviews(prev => ({ ...prev, [selectedScene.id]: result }))
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Review failed')
    } finally {
      setReviewRunning(null)
    }
  }

  async function retryStage() {
    if (!selectedScene) return
    setRetryingSceneId(selectedScene.id)
    try {
      await fetchAPI('/api/requests', {
        method: 'POST',
        body: JSON.stringify({ type: RETRY_TYPE[sheetStage], scene_id: selectedScene.id, project_id: projectId, video_id: videoId }),
      })
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setRetryingSceneId(null)
    }
  }

  async function generateAllRefs() {
    const unready = characters.filter(c => charStatus(c, requests) !== 'COMPLETED')
    const targets = unready.length > 0 ? unready : characters
    if (targets.length === 0) return

    setBatchLoading(true)
    setBatchMessage(`Đang gửi ${targets.length} yêu cầu tạo ảnh nhân vật...`)
    try {
      await fetchAPI('/api/requests/batch', {
        method: 'POST',
        body: JSON.stringify({
          requests: targets.map(c => ({
            type: 'GENERATE_CHARACTER_IMAGE',
            character_id: c.id,
            project_id: projectId,
          })),
        }),
      })
      await load()
      setBatchMessage(`Đã gửi thành công ${targets.length} yêu cầu tạo ảnh nhân vật!`)
      setTimeout(() => setBatchMessage(null), 4000)
    } catch (e: any) {
      setBatchMessage(`Lỗi: ${e.message}`)
    } finally {
      setBatchLoading(false)
    }
  }

  async function generateAllImages() {
    const unready = scenes.filter(s => sceneStageStatus(s, 'image') !== 'COMPLETED')
    const targets = unready.length > 0 ? unready : scenes
    if (targets.length === 0) return

    setBatchLoading(true)
    setBatchMessage(`Đang gửi ${targets.length} yêu cầu tạo ảnh phân cảnh...`)
    try {
      await fetchAPI('/api/requests/batch', {
        method: 'POST',
        body: JSON.stringify({
          requests: targets.map(s => ({
            type: 'GENERATE_IMAGE',
            scene_id: s.id,
            project_id: projectId,
            video_id: videoId,
            orientation: video?.orientation || 'VERTICAL',
          })),
        }),
      })
      await load()
      setBatchMessage(`Đã gửi thành công ${targets.length} yêu cầu tạo ảnh cảnh!`)
      setTimeout(() => setBatchMessage(null), 4000)
    } catch (e: any) {
      setBatchMessage(`Lỗi: ${e.message}`)
    } finally {
      setBatchLoading(false)
    }
  }

  async function generateAllVideos() {
    const unready = scenes.filter(s => sceneStageStatus(s, 'video') !== 'COMPLETED')
    const targets = unready.length > 0 ? unready : scenes
    if (targets.length === 0) return

    setBatchLoading(true)
    setBatchMessage(`Đang gửi ${targets.length} yêu cầu tạo video phân cảnh...`)
    try {
      await fetchAPI('/api/requests/batch', {
        method: 'POST',
        body: JSON.stringify({
          requests: targets.map(s => ({
            type: 'GENERATE_VIDEO',
            scene_id: s.id,
            project_id: projectId,
            video_id: videoId,
            orientation: video?.orientation || 'VERTICAL',
          })),
        }),
      })
      await load()
      setBatchMessage(`Đã gửi thành công ${targets.length} yêu cầu tạo video cảnh!`)
      setTimeout(() => setBatchMessage(null), 4000)
    } catch (e: any) {
      setBatchMessage(`Lỗi: ${e.message}`)
    } finally {
      setBatchLoading(false)
    }
  }

  async function reviewAllVideos() {
    setBatchLoading(true)
    setBatchMessage('AI đang chấm điểm video các phân cảnh...')
    try {
      await fetchAPI(`/api/videos/${videoId}/review?project_id=${projectId}&mode=light`, {
        method: 'POST',
      })
      await load()
      setBatchMessage('Hoàn tất chấm điểm AI cho video!')
      setTimeout(() => setBatchMessage(null), 4000)
    } catch (e: any) {
      setBatchMessage(`Lỗi review: ${e.message}`)
    } finally {
      setBatchLoading(false)
    }
  }

  async function upscaleAllVideos() {
    const targets = scenes
    if (targets.length === 0) return

    setBatchLoading(true)
    setBatchMessage(`Đang gửi ${targets.length} yêu cầu upscale 4K...`)
    try {
      await fetchAPI('/api/requests/batch', {
        method: 'POST',
        body: JSON.stringify({
          requests: targets.map(s => ({
            type: 'UPSCALE_VIDEO',
            scene_id: s.id,
            project_id: projectId,
            video_id: videoId,
          })),
        }),
      })
      await load()
      setBatchMessage(`Đã gửi ${targets.length} yêu cầu upscale 4K!`)
      setTimeout(() => setBatchMessage(null), 4000)
    } catch (e: any) {
      setBatchMessage(`Lỗi upscale: ${e.message}`)
    } finally {
      setBatchLoading(false)
    }
  }

  async function handleConcatVideo() {
    setConcatLoading(true)
    setBatchMessage('Đang ghép các clip phân cảnh thành video hoàn chỉnh (ffmpeg)...')
    try {
      const res = await fetchAPI<any>(`/api/videos/${videoId}/concat`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      await load()
      setBatchMessage(`Ghép video thành công! (${res.scenes_used} cảnh, thời lượng: ${res.duration ? res.duration.toFixed(1) + 's' : 'xong'})`)
      setTimeout(() => setBatchMessage(null), 6000)
    } catch (e: any) {
      setBatchMessage(`Lỗi ghép video: ${e.message}`)
    } finally {
      setConcatLoading(false)
    }
  }

  async function handleRefreshUrls() {
    setRefreshLoading(true)
    setBatchMessage('Đang làm mới media URLs qua Google Flow...')
    try {
      const res = await fetchAPI<any>(`/api/flow/refresh-urls/${projectId}`, {
        method: 'POST',
      })
      await load()
      setBatchMessage(`Làm mới URL thành công (${res.refreshed ?? 0} URL đã cập nhật)`)
      setTimeout(() => setBatchMessage(null), 4000)
    } catch (e: any) {
      setBatchMessage(`Lỗi làm mới URL: ${e.message}`)
    } finally {
      setRefreshLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5 text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
            <span style={{ color: 'var(--accent)' }}>{t('app.breadcrumbRoot')}</span>
            <span>/</span>
            <span>{project?.name ?? '…'}</span>
            <span>/</span>
            <span style={{ color: 'var(--text)' }}>{video?.title ?? '…'}</span>
          </div>
          <div className="flex items-baseline gap-3.5">
            <h1 className="m-0 text-xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>{t('pipeline.heading')}</h1>
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('pipeline.sceneCount', { n: scenes.length })}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {characters.length > 0 && (
            <div className="flex flex-col gap-1.5 items-end">
              <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{t('pipeline.castEntities')}</span>
              <AvatarGroup>
                {characters.map(c => (
                  <Tooltip key={c.id}>
                    <TooltipTrigger asChild>
                      <Avatar>
                        <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="flex flex-col gap-1 max-w-[240px]">
                        <span className="text-[11px] tracking-wide">{c.name} · {c.entity_type}</span>
                        {c.description && <span className="text-[11px] opacity-75 leading-snug">{c.description}</span>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </AvatarGroup>
            </div>
          )}
          <div className="w-px h-8" style={{ background: 'var(--border)' }} />
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: anyProcessing ? 'var(--yellow)' : 'var(--muted)', animation: anyProcessing ? 'pulse 1.6s ease-in-out infinite' : 'none' }}
            />
            <span className="text-[11px]" style={{ color: anyProcessing ? 'var(--yellow)' : 'var(--muted)' }}>
              {stateLabel(t, anyProcessing ? 'RUNNING' : 'IDLE')}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>· {t('pipeline.queue', { n: pendingCount })}</span>
          </div>

          <div className="w-px h-8" style={{ background: 'var(--border)' }} />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefreshUrls}
              disabled={refreshLoading}
              className="gap-1.5 cursor-pointer text-xs"
              title="Làm mới URLs hết hạn qua Google Flow"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshLoading && "animate-spin")} />
              <span>{refreshLoading ? "Đang làm mới..." : "Làm mới URL"}</span>
            </Button>

            <Button
              size="sm"
              variant="default"
              onClick={handleConcatVideo}
              disabled={concatLoading}
              className="gap-1.5 cursor-pointer text-xs font-medium"
              title="Ghép các phân cảnh thành video hoàn chỉnh"
            >
              <Film className="w-3.5 h-3.5" />
              <span>{concatLoading ? "Đang ghép..." : "Ghép video"}</span>
            </Button>
          </div>
        </div>
      </div>

      {batchMessage && (
        <div
          className="flex items-center justify-between p-3 rounded-md text-xs transition-all"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--accent)',
            color: 'var(--text)',
          }}
        >
          <div className="flex items-center gap-2.5">
            {batchLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
            <span className="font-medium">{batchMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={() => setBatchMessage(null)}
          >
            Đóng
          </Button>
        </div>
      )}

      {/* Stage rail */}
      <div className="flex items-stretch gap-2.5">
        {STAGE_META.map(m => (
          <StageNode
            key={m.key}
            idx={m.idx}
            name={t(m.nameKey)}
            subtitle={t(m.subtitleKey)}
            {...stageBreakdown[m.key]}
            isActive={activeStage === m.key}
            onClick={() => setActiveStage(m.key)}
          />
        ))}
      </div>

      {/* Sort toggle + scene/refs grid */}
      {activeStage === 'refs' ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              {t('pipeline.refsHeading', { n: characters.length })}
            </div>
            <Button
              size="sm"
              onClick={generateAllRefs}
              disabled={batchLoading || characters.length === 0}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Tạo tất cả ảnh nhân vật (Generate All Refs)</span>
            </Button>
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {characters.map(c => {
              const st = charStatus(c, requests)
              return (
                <div key={c.id} className="flex flex-col gap-1.5 p-2.5 rounded-md text-xs" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="w-full rounded overflow-hidden flex items-center justify-center" style={{ aspectRatio: '3/4', background: 'var(--surface)', maxHeight: '100px' }}>
                    {c.reference_image_url ? (
                      <img src={c.reference_image_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: '10px' }}>{t('pipeline.noImage')}</span>
                    )}
                  </div>
                  <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>{c.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '10px' }}>{c.entity_type}</div>
                  <div className="flex items-center gap-1.5" style={{ fontSize: '10px' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--${st === 'COMPLETED' ? 'green' : st === 'PROCESSING' ? 'yellow' : st === 'FAILED' ? 'red' : 'border'})` }} />
                    <span style={{ color: 'var(--muted)' }}>{statusLabel(t, st)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 text-xs tracking-widest uppercase" style={{ color: 'var(--text)' }}>
              {t('pipeline.stageHeading', { idx: STAGE_META.find(m => m.key === activeStage)!.idx, name: t(STAGE_META.find(m => m.key === activeStage)!.nameKey) })}
            </h2>
            <div className="flex items-center gap-2">
              {activeStage === 'image' && (
                <Button
                  size="sm"
                  onClick={generateAllImages}
                  disabled={batchLoading || scenes.length === 0}
                  className="gap-1.5 cursor-pointer text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tạo tất cả ảnh cảnh (Generate All Images)</span>
                </Button>
              )}

              {activeStage === 'video' && (
                <>
                  <Button
                    size="sm"
                    onClick={generateAllVideos}
                    disabled={batchLoading || scenes.length === 0}
                    className="gap-1.5 cursor-pointer text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tạo tất cả Video</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={reviewAllVideos}
                    disabled={batchLoading || scenes.length === 0}
                    className="gap-1.5 cursor-pointer text-xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span>AI Review Video</span>
                  </Button>
                </>
              )}

              {activeStage === 'upscale' && (
                <Button
                  size="sm"
                  onClick={upscaleAllVideos}
                  disabled={batchLoading || scenes.length === 0}
                  className="gap-1.5 cursor-pointer text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Upscale tất cả (4K)</span>
                </Button>
              )}

              <span className="text-[10px] tracking-wide uppercase ml-2" style={{ color: 'var(--muted)' }}>{t('pipeline.sort')}</span>
              <Button variant="outline" size="sm" onClick={() => setSortFailedFirst(v => !v)}>
                {sortFailedFirst ? t('pipeline.sortFailuresFirst') : t('pipeline.sortSceneOrder')}
              </Button>
            </div>
          </div>

          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))' }}>
            {gridScenes.map(scene => {
              const stage = activeStage as SceneStage
              const req = latestRequest(requests, scene.id, stage)
              return (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  stage={stage}
                  retries={req?.retry_count ?? 0}
                  verdict={stage === 'video' ? reviews[scene.id]?.verdict : undefined}
                  onClick={() => openScene(scene.id)}
                />
              )
            })}
          </div>
        </>
      )}

      <SceneDetailSheet
        key={selectedSceneId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        scene={selectedScene}
        stage={sheetStage}
        stageName={t(sheetStageMeta.nameKey)}
        characters={characters}
        requests={selectedScene ? requests.filter(r => r.scene_id === selectedScene.id) : []}
        review={selectedScene ? reviews[selectedScene.id] : undefined}
        reviewRunning={!!selectedScene && reviewRunning?.sceneId === selectedScene.id}
        runningMode={reviewRunning?.mode ?? null}
        reviewError={reviewError}
        onRunReview={runReview}
        onRetry={retryStage}
        retrying={!!selectedScene && retryingSceneId === selectedScene.id}
      />
    </div>
  )
}
