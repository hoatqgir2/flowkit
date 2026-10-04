import { useState } from 'react'
import { fetchAPI } from '../../api/client'
import type { Project, Video } from '../../types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Sparkles, Loader2 } from 'lucide-react'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (project: Project) => void
}

const MATERIALS = [
  { id: 'realistic', label: 'Realistic (Điện ảnh chân thực)' },
  { id: '3d_pixar', label: '3D Pixar (Hoạt hình 3D Pixar/Disney)' },
  { id: 'anime', label: 'Anime (Hoạt hình Nhật Bản)' },
  { id: 'oil_painting', label: 'Oil Painting (Tranh sơn dầu)' },
  { id: 'stop_motion', label: 'Stop Motion (Đất sét/Thủ công)' },
  { id: 'minecraft', label: 'Minecraft (Khối hộp Voxel)' },
]

export default function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [story, setStory] = useState('')
  const [material, setMaterial] = useState('realistic')
  const [orientation, setOrientation] = useState<'VERTICAL' | 'HORIZONTAL'>('VERTICAL')
  const [sceneCount, setSceneCount] = useState(4)
  const [charName, setCharName] = useState('')
  const [charDesc, setCharDesc] = useState('')
  const [flowProjectId, setFlowProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState<string | null>(null)

  const controlClass = 'text-xs px-2.5 py-1.5 rounded-md outline-none w-full transition-colors'
  const controlStyle = {
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)
    setStatusMsg('Đang tạo dự án...')

    try {
      const chars = charName.trim()
        ? [
            {
              name: charName.trim(),
              description: charDesc.trim() || charName.trim(),
              entity_type: 'character',
            },
          ]
        : undefined

      const uuidMatch = flowProjectId.trim().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      const resolvedFlowProjectId = uuidMatch ? uuidMatch[0].toLowerCase() : (flowProjectId.trim() || undefined)

      // 1. Tạo project
      const proj = await fetchAPI<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          story: story.trim() || description.trim() || undefined,
          material,
          flow_project_id: resolvedFlowProjectId,
          characters: chars,
        }),
      })

      // 2. Tạo video container
      setStatusMsg('Đang thiết lập chuỗi video...')
      const vid = await fetchAPI<Video>('/api/videos', {
        method: 'POST',
        body: JSON.stringify({
          project_id: proj.id,
          title: `${name.trim()} - Main Video`,
          orientation,
        }),
      })

      // 3. Khởi tạo các phân cảnh
      setStatusMsg('Đang tạo các phân cảnh ban đầu...')
      const count = Math.max(1, Math.min(10, sceneCount))
      for (let i = 0; i < count; i++) {
        const scenePrompt = story.trim()
          ? `Scene ${i + 1}: ${story.trim().slice(0, 120)}`
          : `Scene ${i + 1} of ${name.trim()}`

        await fetchAPI('/api/scenes', {
          method: 'POST',
          body: JSON.stringify({
            video_id: vid.id,
            display_order: i,
            prompt: scenePrompt,
            character_names: charName.trim() ? [charName.trim()] : [],
          }),
        })
      }

      onCreated(proj)
      onOpenChange(false)
      // Reset form
      setName('')
      setDescription('')
      setStory('')
      setCharName('')
      setCharDesc('')
      setFlowProjectId('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tạo dự án thất bại'
      setError(msg)
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <DialogTitle>Tạo dự án mới (New Project)</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Khởi tạo dự án video mới với kịch bản, phong cách hình ảnh và các phân cảnh sẵn sàng chạy pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 my-2">
          {error && (
            <div
              className="p-2 rounded text-xs"
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', border: '1px solid var(--red)' }}
            >
              {error}
            </div>
          )}

          {/* Project Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] tracking-wider uppercase font-semibold" style={{ color: 'var(--text)' }}>
              Tên dự án *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Nhiệm vụ giải cứu F-15E, Chuyến bay sao Hỏa..."
              value={name}
              onChange={e => setName(e.target.value)}
              className={controlClass}
              style={controlStyle}
              disabled={loading}
            />
          </div>

          {/* Google Flow Project Link / ID */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] tracking-wider uppercase font-semibold" style={{ color: 'var(--text)' }}>
                Flow Project ID / Link (Khuyên dùng)
              </label>
              <a
                href="https://flow.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] underline hover:opacity-80"
                style={{ color: 'var(--accent)' }}
              >
                Mở flow.google.com ↗
              </a>
            </div>
            <input
              type="text"
              placeholder="VD: https://flow.google.com/project/xxxx hoặc xxxxxxxx-xxxx-..."
              value={flowProjectId}
              onChange={e => setFlowProjectId(e.target.value)}
              className={controlClass}
              style={controlStyle}
              disabled={loading}
            />
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Vào Google Flow trên Chrome, tạo hoặc mở 1 project, rồi copy URL hoặc UUID dán vào đây (tránh lỗi Google Flow chặn tạo project tự động qua API).
            </p>
          </div>

          {/* Story / Script */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] tracking-wider uppercase font-semibold" style={{ color: 'var(--text)' }}>
              Kịch bản / Tóm tắt câu chuyện
            </label>
            <textarea
              rows={3}
              placeholder="Tóm tắt cốt truyện hoặc các diễn biến chính trong video..."
              value={story}
              onChange={e => {
                setStory(e.target.value)
                if (!description) setDescription(e.target.value)
              }}
              className={controlClass}
              style={controlStyle}
              disabled={loading}
            />
          </div>

          {/* Material & Orientation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-wider uppercase font-semibold" style={{ color: 'var(--text)' }}>
                Phong cách (Material)
              </label>
              <select
                value={material}
                onChange={e => setMaterial(e.target.value)}
                className={controlClass}
                style={controlStyle}
                disabled={loading}
              >
                {MATERIALS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-wider uppercase font-semibold" style={{ color: 'var(--text)' }}>
                Khung hình (Aspect Ratio)
              </label>
              <select
                value={orientation}
                onChange={e => setOrientation(e.target.value as 'VERTICAL' | 'HORIZONTAL')}
                className={controlClass}
                style={controlStyle}
                disabled={loading}
              >
                <option value="VERTICAL">Dọc 9:16 (TikTok, Shorts)</option>
                <option value="HORIZONTAL">Ngang 16:9 (YouTube chuẩn)</option>
              </select>
            </div>
          </div>

          {/* Scene Count & Main Character */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-wider uppercase font-semibold" style={{ color: 'var(--text)' }}>
                Số phân cảnh khởi tạo
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={sceneCount}
                onChange={e => setSceneCount(parseInt(e.target.value) || 1)}
                className={controlClass}
                style={controlStyle}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-wider uppercase font-semibold" style={{ color: 'var(--text)' }}>
                Nhân vật chính (Tùy chọn)
              </label>
              <input
                type="text"
                placeholder="Tên nhân vật (VD: Alex)"
                value={charName}
                onChange={e => setCharName(e.target.value)}
                className={controlClass}
                style={controlStyle}
                disabled={loading}
              />
            </div>
          </div>

          {charName.trim() && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-wider uppercase font-semibold" style={{ color: 'var(--text)' }}>
                Mô tả ngoại hình nhân vật
              </label>
              <input
                type="text"
                placeholder="VD: Nam thám hiểm trẻ tuổi, áo khoác da nâu, mắt xanh..."
                value={charDesc}
                onChange={e => setCharDesc(e.target.value)}
                className={controlClass}
                style={controlStyle}
                disabled={loading}
              />
            </div>
          )}

          {statusMsg && (
            <div className="flex items-center gap-2 text-xs py-1" style={{ color: 'var(--accent)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{statusMsg}</span>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={loading || !name.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Đang khởi tạo...
                </>
              ) : (
                'Tạo dự án'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
