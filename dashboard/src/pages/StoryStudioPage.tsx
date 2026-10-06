import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  User,
  FileText,
  Mic,
  Clock,
  Image as ImageIcon,
  Video,
  Play,
  Pause,
  RotateCw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Plus,
  Volume2,
  Eye,
  Maximize2,
  Zap,
  X,
  StopCircle,
  Eraser,
  Check,
  Pencil,
  Trash2,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fetchAPI } from '@/api/client'

interface SceneItem {
  id: number
  timestamp_str: string
  start_s: number
  end_s: number
  duration?: number
  text: string
  prompt?: string
  image_url?: string
  cdn_url?: string
  status?: 'pending' | 'generating' | 'completed' | 'failed'
  error?: string
  watermark_removed?: boolean
}

interface StoryProject {
  id: string
  title: string
  keyword: string
  current_stage: number
  character_image_url?: string
  character_media_id?: string
  flow_project_id?: string
  hero_lock?: string
  script_text?: string
  word_count?: number
  est_duration_seconds?: number
  audio_url?: string
  audio_duration?: number
  tts_provider?: string
  tts_config?: {
    voice_id?: string
    speed?: number
    model?: string
  }
  scenes?: SceneItem[]
  video_url?: string
  video_size?: number
  has_subtitles?: boolean
  prompt_style?: string
}

export interface PromptStyleInfo {
  id: string
  name: string
  short_desc: string
  description_vi: string
  badge_color: string
  default_hero_lock: string
  key_elements: string[]
}

export const PROMPT_STYLES: PromptStyleInfo[] = [
  {
    id: 'forgotten_civilizations',
    name: 'Nền Văn Minh Bị Bỏ Quên (Mặc định)',
    short_desc: 'Đời thường cổ đại, sông nước, chợ làng, đền đài gạch chéo đỏ',
    description_vi: 'Phong cách hoạt hình doodle 2D tái hiện đời thường của các nền văn minh ít người biết (Srivijaya, Angkor, Mali, Aksum...). Nhân vật người que mộc mạc khóa theo ảnh tham chiếu, trang phục & công việc gắn liền với sông nước, chợ phiên trao đổi cá/muối, nhà sàn gỗ và phế tích đền đài bị gạch chéo đỏ X để xóa bỏ ảo tưởng cung điện/vàng bạc.',
    badge_color: 'bg-amber-950/70 text-amber-300 border-amber-800/60',
    default_hero_lock: 'The main stick figure character from the reference image',
    key_elements: ['Thuyền độc mộc & sông nước', 'Chợ phiên đồ gốm, cá & muối', 'Đền đài gạch chéo đỏ X', 'Khóa theo ảnh nhân vật tham chiếu'],
  },
  {
    id: 'ancient_humans',
    name: 'Con Người Cổ Đại & Tiến Hóa (Ancient Humans)',
    short_desc: 'Doodle tiền sử, thảo nguyên savanna, tảng đá dán nhãn, lửa trại bộ lạc',
    description_vi: 'Phong cách doodle 2D chuẩn Ancient Humans về nhân chủng học, tiến hóa và sinh tồn tiền sử. Nhân vật que đầu tròn tóc cam nhọn đặc trưng (#F58220) hoặc người tiền sử tóc nâu xù. Đặc trưng: tảng đá dán nhãn chữ trắng ALL-CAPS (SURVIVAL), thảo nguyên savanna cây keo lẻ loi, mây mưa khó khăn, lửa trại bộ lạc, nhà khảo cổ nón cối, dấu X đỏ phủ định.',
    badge_color: 'bg-orange-950/70 text-orange-300 border-orange-800/60',
    default_hero_lock: 'The main stick figure character from the reference image with spiky bright orange hair',
    key_elements: ['Thảo nguyên savanna cây keo (acacia)', 'Tảng đá lớn dán nhãn chữ trắng (SURVIVAL)', 'Lửa trại bộ lạc & nhà khảo cổ nón cối', 'Mây mưa gian khổ & Dấu X đỏ phủ định'],
  },
  {
    id: 'brain_psychology',
    name: 'Tâm Lý Học Não Bộ (Why Brain Ignores Advice)',
    short_desc: 'Doodle tâm lý học, não bộ hồng 2D ngộ nghĩnh, lời khuyên bị phớt lờ, thiên kiến nhận thức',
    description_vi: 'Phong cách hoạt hình doodle 2D chuyên đề Tâm lý học & Khoa học Hành vi (Psychology & Behavioral Neuroscience). Nhân vật que tối giản tương tác cùng bộ não hoạt hình 2D màu hồng pastel/san hô với biểu cảm ngộ nghĩnh (bối rối, lười biếng, hoảng sợ), người que bịt tai phớt lờ loa phóng thanh lời khuyên, đám mây suy nghĩ rối như tơ vò, bẫy dopamine lướt điện thoại, ngã rẽ thói quen và các thí nghiệm tâm lý với dấu X đỏ phủ định.',
    badge_color: 'bg-rose-950/70 text-rose-300 border-rose-800/60',
    default_hero_lock: 'The main minimalist stick figure character from the reference image with a round white head',
    key_elements: ['Bộ não hoạt hình 2D màu hồng biểu cảm', 'Người que bịt tai phớt lờ loa phóng thanh', 'Bẫy dopamine (lướt điện thoại, giường ngủ)', 'Đám mây suy nghĩ rối rắm & Thiên kiến nhận thức'],
  },
]

const PRESET_TOPICS = [
  { label: 'Tại sao não bộ phớt lờ lời khuyên hay', topic: 'Why your brain ignores good advice: psychological reactance, cognitive dissonance, and the ego trap' },
  { label: 'Srivijaya & Người biển Musi', topic: 'Srivijaya and the Orang Laut river people in the year 700' },
  { label: 'Làng gốm ngoại thành Angkor', topic: 'Khmer village life and pottery making around Angkor in 1150' },
  { label: 'Con đường muối Mali - Timbuktu', topic: 'Mali salt trader and camel caravan routes in 1324' },
  { label: 'Vương quốc Aksum trên biển Đỏ', topic: 'Kingdom of Aksum port sailor trading in the Red Sea' },
  { label: 'Đời thường thời Heian Nhật Bản', topic: 'Heian Japan commoner and market merchant daily life' },
  { label: 'Một ngày của dân văn phòng hiện đại', topic: 'Why people stay in jobs they hate: status quo bias and loss aversion' },
]

export default function StoryStudioPage() {
  const [projects, setProjects] = useState<{ id: string; title: string; keyword: string; stage: number }[]>([])
  const [currentProject, setCurrentProject] = useState<StoryProject | null>(null)
  const [activeStage, setActiveStage] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Stage 1 State
  const [heroLock, setHeroLock] = useState<string>('')
  const [flowProjectId, setFlowProjectId] = useState<string>(() => localStorage.getItem('fk_last_flow_project_id') || '')

  // Stage 2 State (Script)
  const [topic, setTopic] = useState<string>('')
  const [llmProvider, setLlmProvider] = useState<string>('demo')
  const [llmApiKey, setLlmApiKey] = useState<string>(() => localStorage.getItem('fk_llm_key') || '')
  const [scriptText, setScriptText] = useState<string>('')

  // Stage 3 State (Audio - Minimax)
  const [minimaxKey, setMinimaxKey] = useState<string>(() => localStorage.getItem('fk_minimax_key') || '')
  const [minimaxGroupId, setMinimaxGroupId] = useState<string>(() => localStorage.getItem('fk_minimax_group') || '')
  const [minimaxVoice, setMinimaxVoice] = useState<string>('male-qn-qingse')
  const [minimaxModel, setMinimaxModel] = useState<string>('speech-02-turbo')
  const [minimaxSpeed, setMinimaxSpeed] = useState<number>(1.0)

  // Stage 4 State (Transcript)
  const [groqKey, setGroqKey] = useState<string>(() => localStorage.getItem('fk_groq_key') || '')
  const [showGroqConfig, setShowGroqConfig] = useState<boolean>(false)
  const [rawTranscript, setRawTranscript] = useState<string>('')
  const [showRawTranscriptInput, setShowRawTranscriptInput] = useState<boolean>(false)

  // Stage 5 State (Images)
  const [imageModel, setImageModel] = useState<string>('BELUGA')
  const [promptStyle, setPromptStyle] = useState<string>('forgotten_civilizations')
  const [delayMin, setDelayMin] = useState<number>(() => {
    const saved = localStorage.getItem('fk_batch_delay_min')
    return saved !== null ? Number(saved) : 5
  })
  const [delayMax, setDelayMax] = useState<number>(() => {
    const saved = localStorage.getItem('fk_batch_delay_max')
    return saved !== null ? Number(saved) : 10
  })
  const [batchTimeout, setBatchTimeout] = useState<number>(() => Number(localStorage.getItem('fk_batch_timeout')) || 60)
  const [batchGenProgress, setBatchGenProgress] = useState<{ current: number; total: number; message?: string } | null>(null)
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false)
  const batchCancelRef = useRef<boolean>(false)
  const activeAbortControllersRef = useRef<Map<number, AbortController>>(new Map())
  const [previewLightboxImg, setPreviewLightboxImg] = useState<string | null>(null)

  // Stage 6 State (Video)
  const [burnSubtitles, setBurnSubtitles] = useState<boolean>(true)
  const [renderingVideo, setRenderingVideo] = useState<boolean>(false)

  // Project Rename & Delete State
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false)
  const [editTitleInput, setEditTitleInput] = useState<string>('')
  const [isSavingTitle, setIsSavingTitle] = useState<boolean>(false)
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
  const [isDeletingProject, setIsDeletingProject] = useState<boolean>(false)

  // AI Prompt Generation State (OpenAI-compatible / Gemini 3.8 Flash)
  const [isAiBuildingPrompts, setIsAiBuildingPrompts] = useState<boolean>(false)
  const [aiBuildingSceneId, setAiBuildingSceneId] = useState<number | null>(null)
  const [aiBaseUrl, setAiBaseUrl] = useState<string>(() => localStorage.getItem('fk_story_ai_base_url') || 'https://ai.tuvimoi.com/v1')
  const [aiApiKey, setAiApiKey] = useState<string>(() => localStorage.getItem('fk_story_ai_api_key') || 'sk-dfc0e3c70d85fe58-t4zf4c-444c53ec')
  const [aiModel, setAiModel] = useState<string>(() => localStorage.getItem('fk_story_ai_model') || 'ag/gemini-3.8-flash-high')
  const [showAiPromptConfig, setShowAiPromptConfig] = useState<boolean>(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Save keys & batch settings to localStorage
  useEffect(() => {
    if (minimaxKey) localStorage.setItem('fk_minimax_key', minimaxKey)
  }, [minimaxKey])
  useEffect(() => {
    if (minimaxGroupId) localStorage.setItem('fk_minimax_group', minimaxGroupId)
  }, [minimaxGroupId])
  useEffect(() => {
    if (llmApiKey) localStorage.setItem('fk_llm_key', llmApiKey)
  }, [llmApiKey])
  useEffect(() => {
    if (groqKey) localStorage.setItem('fk_groq_key', groqKey)
  }, [groqKey])
  useEffect(() => {
    if (aiBaseUrl) localStorage.setItem('fk_story_ai_base_url', aiBaseUrl)
  }, [aiBaseUrl])
  useEffect(() => {
    if (aiApiKey) localStorage.setItem('fk_story_ai_api_key', aiApiKey)
  }, [aiApiKey])
  useEffect(() => {
    if (aiModel) localStorage.setItem('fk_story_ai_model', aiModel)
  }, [aiModel])
  useEffect(() => {
    localStorage.setItem('fk_batch_delay_min', String(delayMin))
  }, [delayMin])
  useEffect(() => {
    localStorage.setItem('fk_batch_delay_max', String(delayMax))
  }, [delayMax])
  useEffect(() => {
    localStorage.setItem('fk_batch_timeout', String(batchTimeout))
  }, [batchTimeout])

  // Load projects list
  const loadProjects = async () => {
    try {
      const data = await fetchAPI<{ projects: any[] }>('/api/story-studio/projects')
      setProjects(data.projects || [])
      if (!currentProject && data.projects?.length > 0) {
        loadProjectDetail(data.projects[0].id)
      } else if (!currentProject && data.projects?.length === 0) {
        createNewProject('Câu Chuyện Mới')
      }
    } catch (e: any) {
      console.error('Failed to load projects', e)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjectDetail = async (id: string) => {
    try {
      setLoading(true)
      const proj = await fetchAPI<StoryProject>(`/api/story-studio/projects/${id}`)
      setCurrentProject(proj)
      setHeroLock(proj.hero_lock || '')
      setPromptStyle(proj.prompt_style || 'forgotten_civilizations')
      if (proj.flow_project_id) {
        setFlowProjectId(proj.flow_project_id)
        localStorage.setItem('fk_last_flow_project_id', proj.flow_project_id)
      }
      setTopic(proj.keyword || '')
      setScriptText(proj.script_text || '')
      setActiveStage(proj.current_stage || 1)
      setStatusMsg(null)
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Không thể tải dự án' })
    } finally {
      setLoading(false)
    }
  }

  const createNewProject = async (customTitle?: string) => {
    try {
      setLoading(true)
      const newProj = await fetchAPI<StoryProject>('/api/story-studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: customTitle || `Dự án Story ${new Date().toLocaleDateString('vi-VN')}`,
          keyword: topic || '',
          hero_lock: heroLock || undefined,
          prompt_style: promptStyle || 'forgotten_civilizations',
        }),
      })
      await loadProjects()
      setCurrentProject(newProj)
      setActiveStage(1)
      setStatusMsg({ type: 'ok', text: 'Đã tạo dự án mới thành công!' })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi khi tạo dự án' })
    } finally {
      setLoading(false)
    }
  }

  // ── Project Rename & Delete Handlers ──────────────────────────────
  const handleStartEditTitle = () => {
    if (!currentProject) return
    setEditTitleInput(currentProject.title || '')
    setIsEditingTitle(true)
  }

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false)
    setEditTitleInput('')
  }

  const handleSaveTitle = async () => {
    if (!currentProject) return
    const trimmed = editTitleInput.trim()
    if (!trimmed) {
      setStatusMsg({ type: 'err', text: 'Tên dự án không được để trống' })
      return
    }
    if (trimmed === currentProject.title) {
      setIsEditingTitle(false)
      return
    }
    try {
      setIsSavingTitle(true)
      const updated = await fetchAPI<StoryProject>(`/api/story-studio/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      setCurrentProject(prev => prev ? { ...prev, title: updated.title } : null)
      setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, title: updated.title } : p))
      setIsEditingTitle(false)
      setStatusMsg({ type: 'ok', text: `Đã đổi tên dự án thành "${updated.title}"!` })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi khi đổi tên dự án' })
    } finally {
      setIsSavingTitle(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!currentProject) return
    try {
      setIsDeletingProject(true)
      const deletedTitle = currentProject.title
      await fetchAPI(`/api/story-studio/projects/${currentProject.id}`, {
        method: 'DELETE',
      })
      setShowDeleteModal(false)
      const remaining = projects.filter(p => p.id !== currentProject.id)
      setProjects(remaining)
      setStatusMsg({ type: 'ok', text: `Đã xóa dự án "${deletedTitle}" thành công!` })
      if (remaining.length > 0) {
        await loadProjectDetail(remaining[0].id)
      } else {
        setCurrentProject(null)
        await createNewProject('Câu Chuyện Mới')
      }
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi khi xóa dự án' })
    } finally {
      setIsDeletingProject(false)
    }
  }

  // ── Stage 1: Upload Character Reference ───────────────────────────
  const handleUploadCharacter = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !currentProject) return
    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('file', file)
    if (heroLock) formData.append('hero_lock', heroLock)
    if (flowProjectId) formData.append('flow_project_id', flowProjectId)

    try {
      setLoading(true)
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/character`, {
        method: 'POST',
        body: formData,
      })
      setCurrentProject(prev => prev ? {
        ...prev,
        character_image_url: res.character_image_url,
        character_media_id: res.character_media_id,
        hero_lock: res.hero_lock,
      } : null)
      setStatusMsg({ type: 'ok', text: 'Tải ảnh nhân vật tham chiếu thành công!' })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi tải ảnh nhân vật' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveHeroLock = async () => {
    if (!currentProject) return
    try {
      setLoading(true)
      await fetchAPI(`/api/story-studio/projects/${currentProject.id}/hero-lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hero_lock: heroLock }),
      })
      setCurrentProject(prev => prev ? { ...prev, hero_lock: heroLock } : null)
      setStatusMsg({ type: 'ok', text: 'Đã lưu mô tả nhân vật (Hero Lock)!' })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi lưu Hero Lock' })
    } finally {
      setLoading(false)
    }
  }

  // ── Stage 2: Generate Script ───────────────────────────────────────
  const handleGenerateScript = async () => {
    if (!currentProject) return
    if (!topic.trim()) {
      setStatusMsg({ type: 'err', text: 'Vui lòng nhập chủ đề / từ khóa' })
      return
    }
    try {
      setLoading(true)
      setStatusMsg(null)
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          provider: llmProvider,
          api_key: llmApiKey,
        }),
      })
      setScriptText(res.script)
      setCurrentProject(prev => prev ? {
        ...prev,
        script_text: res.script,
        word_count: res.word_count,
        est_duration_seconds: res.est_duration_seconds,
        keyword: topic,
      } : null)
      setStatusMsg({ type: 'ok', text: `Tạo kịch bản thành công (${res.word_count} từ, ~${res.est_duration_seconds}s)!` })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi tạo kịch bản' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveScript = async () => {
    if (!currentProject) return
    try {
      setLoading(true)
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/script`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_text: scriptText }),
      })
      setCurrentProject(res)
      setStatusMsg({ type: 'ok', text: 'Đã lưu kịch bản!' })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi lưu kịch bản' })
    } finally {
      setLoading(false)
    }
  }

  // ── Stage 3: Generate Audio (Minimax) ───────────────────────────────
  const handleGenerateAudio = async () => {
    if (!currentProject) return
    if (!minimaxKey.trim()) {
      setStatusMsg({ type: 'err', text: 'Vui lòng nhập API Key Minimax' })
      return
    }
    try {
      setLoading(true)
      setStatusMsg(null)
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'minimax',
          api_key: minimaxKey,
          group_id: minimaxGroupId || undefined,
          voice_id: minimaxVoice,
          model: minimaxModel,
          speed: minimaxSpeed,
        }),
      })
      setCurrentProject(prev => prev ? {
        ...prev,
        audio_url: res.audio_url,
        audio_duration: res.duration,
        tts_provider: 'minimax',
      } : null)
      setStatusMsg({ type: 'ok', text: `Tạo giọng đọc Minimax thành công! Thời lượng: ${res.duration.toFixed(1)}s` })
      if (audioRef.current) {
        audioRef.current.load()
      }
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi tạo giọng đọc Minimax' })
    } finally {
      setLoading(false)
    }
  }

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !currentProject) return
    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('file', file)

    try {
      setLoading(true)
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/upload-audio`, {
        method: 'POST',
        body: formData,
      })
      setCurrentProject(prev => prev ? {
        ...prev,
        audio_url: res.audio_url,
        audio_duration: res.duration,
        tts_provider: 'custom_upload',
      } : null)
      setStatusMsg({ type: 'ok', text: `Đã nạp file audio (${res.duration.toFixed(1)}s)!` })
      if (audioRef.current) audioRef.current.load()
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi nạp audio' })
    } finally {
      setLoading(false)
    }
  }

  // ── Scene Audio Playback (Stage 4 & Stage 5) ────────────────────────
  const sceneAudioRef = useRef<HTMLAudioElement | null>(null)
  const [playingSceneId, setPlayingSceneId] = useState<number | null>(null)
  const playTimerRef = useRef<any>(null)

  const stopSceneAudio = () => {
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current)
      playTimerRef.current = null
    }
    if (sceneAudioRef.current) {
      sceneAudioRef.current.pause()
    }
    setPlayingSceneId(null)
  }

  const handlePlaySceneAudio = (sc: SceneItem) => {
    if (!currentProject?.audio_url) {
      setStatusMsg({
        type: 'err',
        text: 'Chưa có file âm thanh để phát. Vui lòng tạo giọng đọc hoặc nạp file audio ở Bước 3 trước.',
      })
      return
    }

    const audio = sceneAudioRef.current
    if (!audio) return

    // If already playing this scene, toggle pause
    if (playingSceneId === sc.id) {
      stopSceneAudio()
      return
    }

    if (playTimerRef.current) {
      clearInterval(playTimerRef.current)
      playTimerRef.current = null
    }

    const parseTime = (ts?: string): number => {
      if (!ts) return 0
      const clean = ts.replace(/[\[\]\(\)]/g, '').trim()
      const parts = clean.split(':').map(Number)
      if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0)
      if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
      return 0
    }

    const startTime = sc.start_s !== undefined && sc.start_s !== null ? Math.max(0, sc.start_s) : parseTime(sc.timestamp_str)
    let endTime = sc.end_s && sc.end_s > startTime ? sc.end_s : (startTime + (sc.duration || 4.0))
    if (currentProject.audio_duration && endTime > currentProject.audio_duration) {
      endTime = currentProject.audio_duration
    }

    if (!audio.src || !audio.src.includes(currentProject.audio_url)) {
      audio.src = currentProject.audio_url
    }

    const startPlayback = () => {
      try {
        audio.currentTime = startTime
      } catch (e) {
        console.warn('Seek error:', e)
      }

      const p = audio.play()
      if (p !== undefined) {
        p.then(() => {
          setPlayingSceneId(sc.id)
          playTimerRef.current = setInterval(() => {
            if (audio.currentTime >= endTime || audio.paused || audio.ended) {
              stopSceneAudio()
            }
          }, 40)
        }).catch(err => {
          console.warn('Play audio error:', err)
          stopSceneAudio()
        })
      }
    }

    if (audio.readyState >= 1) {
      startPlayback()
    } else {
      audio.load()
      const onCanPlay = () => {
        audio.removeEventListener('canplay', onCanPlay)
        startPlayback()
      }
      audio.addEventListener('canplay', onCanPlay)
    }
  }

  // Cleanup scene audio playback when unmounting, changing stage, or switching project
  useEffect(() => {
    stopSceneAudio()
  }, [currentProject?.id, activeStage])

  // ── Stage 4: Transcribe & Timestamps ────────────────────────────────
  const handleTranscribe = async (method: 'groq' | 'heuristic' = 'groq') => {
    if (!currentProject) return
    try {
      setLoading(true)
      setStatusMsg(null)
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_transcript: rawTranscript || undefined,
          method: rawTranscript ? undefined : method,
          groq_api_key: groqKey || undefined,
          whisper_model: 'whisper-large-v3',
        }),
      })
      setCurrentProject(prev => prev ? { ...prev, scenes: res.scenes } : null)
      const successDetail = rawTranscript
        ? `Đã khớp ${res.count} phân cảnh từ nội dung transcript dán vào!`
        : method === 'groq'
          ? `Đã bóc tách thành công ${res.count} phân cảnh chuẩn xác 100% bằng Groq Whisper AI (whisper-large-v3)!`
          : `Đã ước tính phân đoạn ${res.count} phân cảnh theo số từ!`
      setStatusMsg({ type: 'ok', text: successDetail })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi bóc tách transcript' })
    } finally {
      setLoading(false)
    }
  }

  // ── Stage 5: Scene Prompts & Images ─────────────────────────────────
  const handleBuildPrompts = async (targetStyle?: string) => {
    if (!currentProject) return
    const activeStyle = targetStyle || promptStyle || 'forgotten_civilizations'
    try {
      setLoading(true)
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/build-prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hero_lock: heroLock, style: activeStyle }),
      })
      setCurrentProject(prev => prev ? { ...prev, scenes: res.scenes, prompt_style: activeStyle } : null)
      setPromptStyle(activeStyle)
      const matched = PROMPT_STYLES.find(s => s.id === activeStyle)
      setStatusMsg({
        type: 'ok',
        text: `Đã tái tạo prompt Doodle chuẩn phong cách "${matched?.name || activeStyle}" cho tất cả ${res.scenes?.length || 0} cảnh!`
      })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi build prompt' })
    } finally {
      setLoading(false)
    }
  }

  const handleBuildPromptsAI = async (sceneId?: number) => {
    if (!currentProject || !currentProject.scenes?.length) return
    setIsAiBuildingPrompts(true)
    if (sceneId !== undefined) {
      setAiBuildingSceneId(sceneId)
    }
    const totalScenes = currentProject.scenes.length
    setStatusMsg({
      type: 'ok',
      text: sceneId !== undefined
        ? `Đang dùng AI (${aiModel}) sinh prompt bám sát kịch bản cho cảnh #${sceneId}...`
        : `Đang gửi toàn bộ transcript (${totalScenes} câu) vào AI (${aiModel}) trong 1 lượt duy nhất để sinh prompt đồng bộ cho tất cả timeline (vui lòng chờ)...`,
    })

    try {
      const activeStyle = promptStyle || currentProject.prompt_style || 'brain_psychology'
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/generate-prompts-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: activeStyle,
          hero_lock: heroLock,
          base_url: aiBaseUrl.trim(),
          api_key: aiApiKey.trim(),
          model: aiModel.trim(),
          scene_id: sceneId,
        }),
      })

      setCurrentProject(prev => prev ? { ...prev, scenes: res.scenes, prompt_style: activeStyle } : null)
      setPromptStyle(activeStyle)
      setStatusMsg({
        type: 'ok',
        text: sceneId !== undefined
          ? `✨ Đã sinh xong prompt AI cho cảnh #${sceneId}!`
          : `✨ Đã nhận đầy đủ prompt từ AI trong 1 lượt gửi và cập nhật đồng bộ cho tất cả ${res.scenes?.length || 0} timeline!`,
      })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi sinh prompt bằng AI' })
    } finally {
      setIsAiBuildingPrompts(false)
      setAiBuildingSceneId(null)
    }
  }

  const handleGenerateSingleScene = async (sceneId: number, customPrompt?: string, timeoutSec: number = 60) => {
    if (!currentProject) return
    const controller = new AbortController()
    activeAbortControllersRef.current.set(sceneId, controller)
    const timer = setTimeout(() => controller.abort(), timeoutSec * 1000)

    try {
      // Update scene status to generating
      setCurrentProject(prev => {
        if (!prev || !prev.scenes) return prev
        return {
          ...prev,
          scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, status: 'generating', error: undefined } : s)
        }
      })

      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/generate-scene-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          scene_id: sceneId,
          prompt: customPrompt,
          image_model: imageModel,
          flow_project_id: flowProjectId.trim() || currentProject.flow_project_id,
          timeout_seconds: timeoutSec,
        }),
      })

      setCurrentProject(prev => {
        if (!prev || !prev.scenes) return prev
        return {
          ...prev,
          scenes: prev.scenes.map(s => s.id === sceneId ? {
            ...s,
            image_url: res.image_url,
            cdn_url: res.cdn_url,
            status: 'completed',
            error: undefined,
          } : s)
        }
      })
      setStatusMsg({ type: 'ok', text: `Cảnh ${sceneId} đã tạo ảnh xong!` })
      return res
    } catch (e: any) {
      const isAbort = e.name === 'AbortError' || e.message?.toLowerCase().includes('abort')
      const isUserStopped = batchCancelRef.current && isAbort
      const isTimeout = isAbort && !batchCancelRef.current
      const errorText = isUserStopped
        ? 'Đã dừng bởi người dùng'
        : isTimeout
          ? `Timeout quá ${timeoutSec}s (coi như fail)`
          : (e.message || 'Lỗi tạo ảnh')

      setCurrentProject(prev => {
        if (!prev || !prev.scenes) return prev
        return {
          ...prev,
          scenes: prev.scenes.map(s => s.id === sceneId ? {
            ...s,
            status: isUserStopped ? 'pending' : 'failed',
            error: errorText,
          } : s)
        }
      })
      if (!isUserStopped) {
        setStatusMsg({ type: 'err', text: `Cảnh ${sceneId} lỗi: ${errorText}` })
      }
      throw new Error(errorText)
    } finally {
      clearTimeout(timer)
      activeAbortControllersRef.current.delete(sceneId)
    }
  }

  const handleResyncCharacter = async () => {
    if (!currentProject) return
    if (!flowProjectId.trim()) {
      setStatusMsg({ type: 'err', text: 'Vui lòng nhập Google Flow Project ID của tài khoản mới (lấy từ URL trên trình duyệt)' })
      return
    }
    try {
      setLoading(true)
      setStatusMsg(null)
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/resync-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_project_id: flowProjectId.trim() }),
      })
      if (res.flow_project_id) {
        localStorage.setItem('fk_last_flow_project_id', res.flow_project_id)
      }
      setCurrentProject(prev => prev ? {
        ...prev,
        character_media_id: res.character_media_id,
        flow_project_id: res.flow_project_id,
      } : null)
      setStatusMsg({ type: 'ok', text: res.message || 'Đồng bộ ảnh tham chiếu sang tài khoản mới thành công!' })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi đồng bộ tham chiếu sang tài khoản mới' })
    } finally {
      setLoading(false)
    }
  }

  const runBatchImageGeneration = async (scenesToProcess: SceneItem[]) => {
    if (!currentProject || !scenesToProcess.length) return
    batchCancelRef.current = false
    setIsBatchGenerating(true)
    setStatusMsg(null)

    const total = scenesToProcess.length

    for (let i = 0; i < scenesToProcess.length; i++) {
      if (batchCancelRef.current) {
        setStatusMsg({ type: 'ok', text: `Đã dừng tiến trình tạo ảnh (đã xử lý ${i}/${total} cảnh).` })
        break
      }

      const sc = scenesToProcess[i]
      setBatchGenProgress({
        current: i,
        total,
        message: `Đang tạo ảnh cảnh #${sc.id} (${i + 1}/${total})...`
      })

      try {
        await handleGenerateSingleScene(sc.id, sc.prompt, batchTimeout)
      } catch (err: any) {
        const errMsg = String(err?.message || '')
        const lowerErr = errMsg.toLowerCase()
        const isQuota = (
          lowerErr.includes('quota') ||
          lowerErr.includes('limit') ||
          lowerErr.includes('hết lượt') ||
          lowerErr.includes('429') ||
          lowerErr.includes('unusual') ||
          lowerErr.includes('exhausted') ||
          lowerErr.includes('paygate') ||
          lowerErr.includes('cooldown') ||
          lowerErr.includes('too many') ||
          lowerErr.includes('credit')
        )
        const isConnDead = (
          lowerErr.includes('disconnect') ||
          lowerErr.includes('no_flow_tab') ||
          lowerErr.includes('not_connected')
        )

        if (isQuota || isConnDead) {
          batchCancelRef.current = true
          activeAbortControllersRef.current.forEach(controller => {
            try { controller.abort() } catch {}
          })
          activeAbortControllersRef.current.clear()

          setBatchGenProgress({ current: i + 1, total })
          const alertText = isQuota
            ? `⚠️ ĐÃ DỪNG TOÀN BỘ TIẾN TRÌNH: Tài khoản Google Flow đã chạm giới hạn Quota / Rate Limit ở cảnh #${sc.id}. Hãy chuyển sang tài khoản Google khác trên Chrome và bấm 'Đồng bộ Tham Chiếu sang Acc mới' để tiếp tục.`
            : `⚠️ ĐÃ DỪNG TOÀN BỘ TIẾN TRÌNH: Mất kết nối tới tab Google Flow ở cảnh #${sc.id}. Vui lòng mở lại tab Flow trên Chrome.`
          setStatusMsg({
            type: 'err',
            text: alertText,
          })
          break
        }
      }

      if (batchCancelRef.current) {
        break
      }

      setBatchGenProgress({ current: i + 1, total })

      // Random delay between min and max seconds before next scene
      const minD = Math.max(0, Math.min(delayMin, delayMax))
      const maxD = Math.max(minD, Math.max(delayMin, delayMax))
      const actualDelay = maxD > 0 ? Math.floor(Math.random() * (maxD - minD + 1)) + minD : 0

      if (i < scenesToProcess.length - 1 && !batchCancelRef.current && actualDelay > 0) {
        for (let s = actualDelay; s > 0; s--) {
          if (batchCancelRef.current) break
          setBatchGenProgress({
            current: i + 1,
            total,
            message: `Cảnh #${sc.id} xong! Chờ ${s}s (ngẫu nhiên ${minD}s ➔ ${maxD}s) trước khi tạo cảnh tiếp theo...`
          })
          await new Promise(r => setTimeout(r, 1000))
        }
      }
    }

    setIsBatchGenerating(false)
    setBatchGenProgress(null)
  }

  const handleGenerateMissingScenes = async () => {
    if (!currentProject || !currentProject.scenes?.length) return
    const missingScenes = currentProject.scenes.filter(s => s.status !== 'completed' || !s.image_url)
    if (missingScenes.length === 0) {
      setStatusMsg({ type: 'ok', text: 'Tất cả các cảnh đều đã hoàn tất ảnh!' })
      return
    }
    await runBatchImageGeneration(missingScenes)
  }

  const handleBatchGenerateImages = async () => {
    if (!currentProject || !currentProject.scenes?.length) return
    await runBatchImageGeneration(currentProject.scenes)
  }

  const handleStopAll = () => {
    batchCancelRef.current = true

    // Abort all active generating requests immediately
    const abortCount = activeAbortControllersRef.current.size
    activeAbortControllersRef.current.forEach((controller) => {
      try {
        controller.abort()
      } catch (err) {
        // ignore
      }
    })
    activeAbortControllersRef.current.clear()

    // Revert any scenes currently generating back to pending
    setCurrentProject(prev => {
      if (!prev || !prev.scenes) return prev
      return {
        ...prev,
        scenes: prev.scenes.map(s => s.status === 'generating' ? {
          ...s,
          status: 'pending',
          error: 'Đã dừng bởi người dùng',
        } : s)
      }
    })

    setIsBatchGenerating(false)
    setBatchGenProgress(null)
    setStatusMsg({
      type: 'ok',
      text: abortCount > 0
        ? `Đã dừng khẩn cấp tất cả (${abortCount} ảnh) đang tạo ngay lập tức!`
        : 'Đã dừng tất cả các tiến trình tạo ảnh!'
    })
  }

  // ── Watermark Removal Handlers ─────────────────────────────────────
  const [isBatchWatermarking, setIsBatchWatermarking] = useState<boolean>(false)
  const [watermarkingSceneId, setWatermarkingSceneId] = useState<number | null>(null)

  const handleRemoveWatermarkSingle = async (sceneId: number) => {
    if (!currentProject) return
    setWatermarkingSceneId(sceneId)
    try {
      const res = await fetchAPI<{ scene_id: number; watermark_removed: boolean; image_url: string }>(
        `/api/story-studio/projects/${currentProject.id}/scenes/${sceneId}/remove-watermark`,
        { method: 'POST' }
      )
      setCurrentProject(prev => {
        if (!prev) return prev
        return {
          ...prev,
          scenes: (prev.scenes || []).map(s =>
            s.id === sceneId
              ? { ...s, watermark_removed: true, image_url: res.image_url }
              : s
          ),
        }
      })
      setStatusMsg({ type: 'ok', text: `Đã xóa watermark cảnh #${sceneId} thành công!` })
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi xóa watermark cảnh #${sceneId}: ${err.message}` })
    } finally {
      setWatermarkingSceneId(null)
    }
  }

  const handleRemoveWatermarkAll = async () => {
    if (!currentProject) return
    const completedScenes = (currentProject.scenes || []).filter(s => s.status === 'completed' && s.image_url)
    if (completedScenes.length === 0) {
      setStatusMsg({ type: 'err', text: 'Chưa có ảnh nào hoàn tất để xóa watermark.' })
      return
    }

    if (!confirm(`Xóa watermark cho toàn bộ ${completedScenes.length} ảnh đã tạo?`)) {
      return
    }

    setIsBatchWatermarking(true)
    try {
      const res = await fetchAPI<{ project_id: string; total_cleaned: number; scenes: SceneItem[] }>(
        `/api/story-studio/projects/${currentProject.id}/remove-watermark-all`,
        { method: 'POST' }
      )
      setCurrentProject(prev => {
        if (!prev) return prev
        return {
          ...prev,
          scenes: res.scenes,
        }
      })
      setStatusMsg({ type: 'ok', text: `Đã xóa sạch watermark cho toàn bộ ${res.total_cleaned} ảnh!` })
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi xóa watermark hàng loạt: ${err.message}` })
    } finally {
      setIsBatchWatermarking(false)
    }
  }

  // ── Stage 6: Render Final Video ─────────────────────────────────────
  const handleRenderVideo = async () => {
    if (!currentProject) return
    try {
      setRenderingVideo(true)
      setStatusMsg(null)
      const res = await fetchAPI<any>(`/api/story-studio/projects/${currentProject.id}/render-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ burn_subtitles: burnSubtitles }),
      })
      setCurrentProject(prev => prev ? {
        ...prev,
        video_url: res.video_url,
        video_size: res.file_size,
      } : null)
      setStatusMsg({ type: 'ok', text: 'Ghép video hoàn tất! Bạn có thể xem và tải video ngay.' })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi ghép video' })
    } finally {
      setRenderingVideo(false)
    }
  }

  // Steps Definition
  const STAGES = [
    { num: 1, title: 'Nhân Vật Tham Chiếu', icon: User, desc: 'Hero Lock cố định' },
    { num: 2, title: 'Kịch Bản ', icon: FileText, desc: 'DNA 2nd-person' },
    { num: 3, title: 'Thu Âm Minimax', icon: Mic, desc: 'T2A v2 Audio' },
    { num: 4, title: 'Bóc Tách Transcript', icon: Clock, desc: 'Khớp mốc thời gian' },
    { num: 5, title: 'Tạo Ảnh Doodle', icon: ImageIcon, desc: 'Khớp nhân vật gốc' },
    { num: 6, title: 'Ghép & Xem Video', icon: Video, desc: 'Render MP4 thành phẩm' },
  ]

  return (
    <div className="flex flex-col min-h-screen p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* ── Top Bar & Project Selector ────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-600/30 rounded-xl border border-amber-500/30 shadow-lg shadow-amber-500/10">
            <Sparkles className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              Doodle Story Studio
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Quy trình khép kín: Nhân vật tham chiếu ➔ Kịch bản LLM ➔ Giọng đọc Minimax ➔ Transcript ➔ Ảnh Doodle ➔ Ghép Video
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-500/60 rounded-lg px-2.5 py-1 shadow-md shadow-amber-500/10">
              <input
                type="text"
                value={editTitleInput}
                onChange={e => setEditTitleInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveTitle()
                  if (e.key === 'Escape') handleCancelEditTitle()
                }}
                autoFocus
                placeholder="Nhập tên dự án..."
                className="bg-transparent text-xs text-slate-100 focus:outline-none w-48 sm:w-64 font-medium"
              />
              <Button
                size="sm"
                onClick={handleSaveTitle}
                disabled={isSavingTitle}
                className="h-6 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] gap-1"
              >
                <Check className="w-3 h-3" /> Lưu
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEditTitle}
                className="h-6 px-1.5 text-slate-400 hover:text-white text-[11px]"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            projects.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1">
                <select
                  value={currentProject?.id || ''}
                  onChange={e => loadProjectDetail(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-500 max-w-[200px] sm:max-w-[260px] truncate font-medium text-slate-200"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>

                {currentProject && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleStartEditTitle}
                      title="Sửa tên dự án này"
                      className="h-7 px-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 text-xs gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Sửa tên</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowDeleteModal(true)}
                      title="Xóa dự án này"
                      className="h-7 px-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 text-xs gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Xóa</span>
                    </Button>
                  </>
                )}
              </div>
            )
          )}

          <Button
            size="sm"
            onClick={() => createNewProject()}
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Tạo Dự Án Mới
          </Button>
        </div>
      </div>

      {/* ── Status Message Banner ─────────────────────────────────── */}
      {statusMsg && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-xs ${
            statusMsg.type === 'ok'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ── 6-Stage Stepper Bar ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
        {STAGES.map(st => {
          const Icon = st.icon
          const isActive = activeStage === st.num
          const isDone = (currentProject?.current_stage || 1) >= st.num
          return (
            <button
              key={st.num}
              onClick={() => setActiveStage(st.num)}
              className={`flex items-center gap-2.5 p-2 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : isDone
                  ? 'hover:bg-slate-800/60 text-slate-300'
                  : 'opacity-60 hover:opacity-90 text-slate-500'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : isDone
                    ? 'bg-slate-800 text-amber-400'
                    : 'bg-slate-800/60 text-slate-500'
                }`}
              >
                {isDone && !isActive ? <Icon className="w-3.5 h-3.5" /> : st.num}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate leading-tight">{st.title}</div>
                <div className="text-[10px] text-slate-400 truncate">{st.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── STAGE CONTENT ─────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* ═════════════════════════════════════════════════════════════ */}
        {/* STAGE 1: NHÂN VẬT THAM CHIẾU                                  */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {activeStage === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <Card className="md:col-span-5 p-5 bg-slate-900/80 border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" /> 1. Ảnh Nhân Vật Tham Chiếu (Reference Image)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Chọn 1 hình nhân vật mẫu 2D doodle chuẩn. Tất cả các phân cảnh sinh sau này sẽ dùng ảnh này làm tham chiếu hình ảnh để nhân vật không bị biến đổi!
                </p>

                {/* Upload or Dropzone */}
                <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl p-4 text-center transition-all bg-slate-950/40 relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCharacter}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    disabled={loading}
                  />
                  <Upload className="w-8 h-8 text-amber-400/80 mx-auto mb-2" />
                  <div className="text-xs font-medium text-slate-200">Kéo thả hoặc Nhấp để tải ảnh nhân vật</div>
                  <div className="text-[10px] text-slate-500 mt-1">PNG, JPG, WEBP (Khuyên dùng hình nhân vật nét doodle nền đơn sắc)</div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="text-[11px] text-slate-400 font-medium">Flow Project ID (Đồng bộ Google Flow):</label>
                  <input
                    type="text"
                    value={flowProjectId}
                    onChange={e => setFlowProjectId(e.target.value)}
                    placeholder="ac385651-cad3-4fae-a2ba-8e37574d5e1b"
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* Next Button */}
              <div className="pt-4 border-t border-slate-800/80 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setActiveStage(2)}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5"
                >
                  Tiếp Tục Sang Kịch Bản <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>

            {/* PREVIEW: Character Reference Card */}
            <Card className="md:col-span-7 p-5 bg-slate-900/80 border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-2"><Eye className="w-4 h-4 text-amber-400" /> Preview Nhân Vật Chính</span>
                {currentProject?.character_image_url && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                    ✓ Đã Khóa Tham Chiếu
                  </Badge>
                )}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="aspect-square bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center relative group">
                  {currentProject?.character_image_url ? (
                    <>
                      <img
                        src={currentProject.character_image_url}
                        alt="Character Reference"
                        className="w-full h-full object-contain p-2"
                      />
                      <button
                        onClick={() => setPreviewLightboxImg(currentProject.character_image_url || null)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white gap-1 text-xs"
                      >
                        <Maximize2 className="w-4 h-4" /> Xem Lớn
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-4 text-slate-600">
                      <User className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <div className="text-xs">Chưa có ảnh nhân vật</div>
                      <div className="text-[10px]">Tải ảnh ở khung bên trái</div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-amber-300 block mb-1">
                      Mô tả Hero Lock (Khóa Nhân Vật):
                    </label>
                    <textarea
                      rows={3}
                      value={heroLock}
                      onChange={e => setHeroLock(e.target.value)}
                      placeholder="Ví dụ: Người que đầu tròn, tóc cam chĩa nhọn (hoặc để trống để bám sát 100% ảnh tham chiếu)"
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        const val = 'The main stick figure character with orange hair from the reference image'
                        setHeroLock(val)
                      }}
                      className="text-[10px] border-slate-700 hover:bg-slate-800 text-amber-300 whitespace-nowrap"
                    >
                      Tóc Cam Theo Ảnh Gốc
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        const val = 'The main minimalist stick figure character from the reference image with a round white head'
                        setHeroLock(val)
                      }}
                      className="text-[10px] border-slate-700 hover:bg-slate-800 text-rose-300 whitespace-nowrap"
                    >
                      Đầu Tròn Tối Giản (Tâm Lý Học)
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveHeroLock}
                      disabled={loading}
                      className="flex-1 text-xs bg-amber-600 hover:bg-amber-500 text-white min-w-[120px]"
                    >
                      Lưu Khóa Nhân Vật
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    💡 <strong>Lưu ý:</strong> Hãy mô tả đúng với ảnh tham chiếu (ví dụ ảnh tóc cam thì mô tả tóc cam). Nếu mô tả bị lệch màu tóc hay trang phục so với ảnh gốc, AI sẽ bị xung đột.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* STAGE 2: KỊCH BẢN (LLM GENERATOR)                    */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {activeStage === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <Card className="md:col-span-5 p-5 bg-slate-900/80 border-slate-800 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4" /> 2. Tạo Kịch Bản
                </h3>
                <p className="text-xs text-slate-400">
                  Kịch bản ngôi thứ hai ("You wake to..."), nhịp câu ngắn-ngắn-dài, đưa vào 3 bằng chứng lịch sử và soi chiếu cuộc sống hiện đại.
                </p>
              </div>

              {/* Topic Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Chủ đề / Từ khóa (Topic):</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="Ví dụ: Srivijaya - Orang Laut trên sông Musi"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Topic Presets */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5">Gợi ý chủ đề nhanh:</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TOPICS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTopic(p.topic)}
                      className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-amber-600/30 border border-slate-700 text-slate-300 hover:text-amber-200 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* LLM Provider */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nhà cung cấp LLM:</label>
                  <select
                    value={llmProvider}
                    onChange={e => setLlmProvider(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
                  >
                    <option value="demo">Demo Generator (Miễn phí)</option>
                    <option value="openai">OpenAI (GPT-4o-mini)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="claude">Anthropic Claude</option>
                    <option value="groq">Groq (Llama-3)</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                </div>

                {llmProvider !== 'demo' && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">API Key:</label>
                    <input
                      type="password"
                      value={llmApiKey}
                      onChange={e => setLlmApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1.5 text-slate-200 font-mono"
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={handleGenerateScript}
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs gap-1.5 font-medium py-2"
              >
                <Sparkles className="w-4 h-4" /> {loading ? 'Đang viết kịch bản...' : 'Tạo Kịch Bản Bằng LLM'}
              </Button>
            </Card>

            {/* PREVIEW: Full Script Textarea */}
            <Card className="md:col-span-7 p-5 bg-slate-900/80 border-slate-800 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" /> Preview Kịch Bản Đầy Đủ
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="border-slate-700 text-slate-300">
                    {scriptText ? `${scriptText.split(/\s+/).filter(Boolean).length} từ` : '0 từ'}
                  </Badge>
                  <Badge variant="outline" className="border-slate-700 text-amber-300">
                    ~{Math.round((scriptText.split(/\s+/).filter(Boolean).length / 140) * 60)} giây
                  </Badge>
                </div>
              </div>

              <textarea
                rows={14}
                value={scriptText}
                onChange={e => setScriptText(e.target.value)}
                placeholder="Nội dung kịch bản sẽ hiển thị ở đây. Bạn có thể tự do gõ hoặc chỉnh sửa từng câu từ trước khi chuyển sang bước thu âm..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed font-sans resize-y"
              />

              <div className="flex items-center justify-between pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveScript}
                  disabled={loading || !scriptText}
                  className="text-xs border-slate-700 hover:bg-slate-800"
                >
                  Lưu Chỉnh Sửa Kịch Bản
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    handleSaveScript()
                    setActiveStage(3)
                  }}
                  disabled={!scriptText}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5"
                >
                  Tiếp Tục Thu Âm Minimax <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* STAGE 3: THU ÂM GIỌNG ĐỌC (MINIMAX AUDIO)                     */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {activeStage === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <Card className="md:col-span-5 p-5 bg-slate-900/80 border-slate-800 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-1">
                  <Mic className="w-4 h-4" /> 3. Tạo Giọng Đọc (Minimax Audio)
                </h3>
                <p className="text-xs text-slate-400">
                  Tùy chọn Minimax T2A v2 (Speech-02 Turbo / HD) chất lượng cao để lồng tiếng cho toàn bộ kịch bản.
                </p>
              </div>

              {/* Minimax Config */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Minimax API Key:</label>
                  <input
                    type="password"
                    value={minimaxKey}
                    onChange={e => setMinimaxKey(e.target.value)}
                    placeholder="ey..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Group ID (Tùy chọn):</label>
                    <input
                      type="text"
                      value={minimaxGroupId}
                      onChange={e => setMinimaxGroupId(e.target.value)}
                      placeholder="GroupId nếu có"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Model:</label>
                    <select
                      value={minimaxModel}
                      onChange={e => setMinimaxModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="speech-02-turbo">speech-02-turbo</option>
                      <option value="speech-02-hd">speech-02-hd</option>
                      <option value="speech-01-turbo">speech-01-turbo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Giọng đọc (Voice ID):</label>
                    <select
                      value={minimaxVoice}
                      onChange={e => setMinimaxVoice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="male-qn-qingse">Nam truyền cảm (male-qn-qingse)</option>
                      <option value="presenter_male">Nam phóng viên (presenter_male)</option>
                      <option value="audiobook_male_2">Kể chuyện trầm ấm (audiobook_male_2)</option>
                      <option value="presenter_female">Nữ phát thanh (presenter_female)</option>
                      <option value="female-yujie">Nữ trầm ấm (female-yujie)</option>
                      <option value="English_expressive_narrator">English Narrator</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Tốc độ: {minimaxSpeed}x</label>
                    <input
                      type="range"
                      min="0.8"
                      max="1.4"
                      step="0.05"
                      value={minimaxSpeed}
                      onChange={e => setMinimaxSpeed(parseFloat(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGenerateAudio}
                disabled={loading || !scriptText}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 py-2 font-medium"
              >
                <Volume2 className="w-4 h-4" /> {loading ? 'Minimax đang tổng hợp giọng đọc...' : 'Tạo Giọng Đọc Minimax'}
              </Button>

              <div className="pt-3 border-t border-slate-800">
                <label className="text-[11px] text-slate-400 block mb-1">Hoặc tải lên file âm thanh có sẵn:</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleUploadAudio}
                  className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>
            </Card>

            {/* PREVIEW: Audio Player Card */}
            <Card className="md:col-span-7 p-5 bg-slate-900/80 border-slate-800 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="flex items-center gap-2"><Play className="w-4 h-4 text-amber-400" /> Preview File Âm Thanh</span>
                  {currentProject?.audio_url && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                      Thời lượng: {currentProject.audio_duration ? `${currentProject.audio_duration.toFixed(1)}s` : 'OK'}
                    </Badge>
                  )}
                </h3>

                <div className="py-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 mt-4 px-4">
                  {currentProject?.audio_url ? (
                    <div className="space-y-4 max-w-md mx-auto">
                      <div className="flex items-center justify-center gap-3">
                        <div className="p-3 bg-amber-500/20 rounded-full text-amber-400 border border-amber-500/30">
                          <Volume2 className="w-6 h-6 animate-pulse" />
                        </div>
                        <div className="text-left">
                          <div className="text-xs font-semibold text-slate-200">Giọng Đọc Kịch Bản</div>
                          <div className="text-[10px] text-slate-400">
                            {currentProject.tts_provider === 'minimax' ? 'Minimax T2A v2' : 'File Audio Đã Tải Lên'}
                          </div>
                        </div>
                      </div>

                      <audio
                        ref={audioRef}
                        controls
                        src={currentProject.audio_url}
                        className="w-full mt-2"
                      />
                    </div>
                  ) : (
                    <div className="text-slate-500 space-y-1">
                      <Mic className="w-8 h-8 mx-auto opacity-30 mb-2" />
                      <div className="text-xs">Chưa có file âm thanh</div>
                      <div className="text-[10px]">Bấm nút tạo giọng đọc Minimax hoặc upload file ở khung bên trái</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <Button
                  size="sm"
                  onClick={() => setActiveStage(4)}
                  disabled={!currentProject?.audio_url}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5"
                >
                  Tiếp Tục Bóc Tách Transcript <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* STAGE 4: BÓC TÁCH TRANSCRIPT [mm:ss]                           */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {activeStage === 4 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> 4. Bóc Tách & Khớp Mốc Thời Gian (Transcript Alignment)
                  </h3>
                  <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400" /> Groq Whisper Large-v3 (Chuẩn 100%)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Phân rã câu thoại theo mốc thời gian dạng <code className="text-amber-300 font-mono">[mm:ss]</code> khớp chuẩn xác 100% sóng âm giọng đọc.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowGroqConfig(!showGroqConfig)}
                  className="text-xs border-slate-700 text-slate-300 hover:text-purple-300"
                >
                  {showGroqConfig ? 'Ẩn Cấu Hình Groq' : 'Groq Key'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRawTranscriptInput(!showRawTranscriptInput)}
                  className="text-xs border-slate-700"
                >
                  {showRawTranscriptInput ? 'Ẩn Ô Dán Transcript' : 'Dán File Transcript [mm:ss]'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTranscribe('heuristic')}
                  disabled={loading || !currentProject?.script_text}
                  className="text-xs border-slate-700 text-slate-400 hover:text-slate-200"
                  title="Ước tính theo tỷ lệ từ (dành cho kịch bản chưa có audio)"
                >
                  Ước Tính Theo Từ
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleTranscribe('groq')}
                  disabled={loading || (!currentProject?.audio_url && !currentProject?.script_text)}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5 font-medium shadow-lg shadow-purple-950/50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  {loading ? 'Đang bóc tách Whisper...' : 'Bóc Tách Bằng Groq Whisper AI'}
                </Button>

                <Button
                  size="sm"
                  onClick={() => setActiveStage(5)}
                  disabled={!currentProject?.scenes?.length}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
                >
                  Tiếp Tục Tạo Ảnh <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Optional Groq Config Drawer */}
            {showGroqConfig && (
              <Card className="p-4 bg-slate-950 border border-purple-900/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Groq API Key (Whisper Large V3):
                  </label>
                  <span className="text-[11px] text-slate-400">Model: <code className="text-purple-300 font-mono">whisper-large-v3</code> (Free tier 2.000 req/ngày)</span>
                </div>
                <input
                  type="password"
                  value={groqKey}
                  onChange={e => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono focus:border-purple-500 focus:outline-none"
                />
              </Card>
            )}

            {/* Optional Raw Paste Drawer */}
            {showRawTranscriptInput && (
              <Card className="p-4 bg-slate-950 border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Dán nội dung transcript (định dạng như file <code className="text-amber-300">transcript.txt</code>):
                  </label>
                  <Button
                    size="sm"
                    onClick={() => handleTranscribe('groq')}
                    disabled={loading || !rawTranscript}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-[11px] h-7 px-3"
                  >
                    Lưu & Khớp Phân Đoạn Này
                  </Button>
                </div>
                <textarea
                  rows={6}
                  value={rawTranscript}
                  onChange={e => setRawTranscript(e.target.value)}
                  placeholder={`[0:00] You open the laptop.\n[0:01] You already know how the day will feel.\n[0:03] The inbox is waiting before you have decided anything.`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono"
                />
              </Card>
            )}

            {/* PREVIEW: Transcript Table */}
            <Card className="p-4 bg-slate-900/80 border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-amber-400" /> Danh Sách Phân Cảnh ({currentProject?.scenes?.length || 0} cảnh)
                </h4>
                <div className="text-[11px] text-slate-400">
                  Tổng thời lượng: {currentProject?.audio_duration ? `${currentProject.audio_duration.toFixed(1)}s` : '—'}
                </div>
              </div>

              {currentProject?.scenes && currentProject.scenes.length > 0 ? (
                <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
                  {currentProject.scenes.map((sc, i) => (
                    <div
                      key={sc.id}
                      className={`flex items-start gap-3 p-3 bg-slate-950/60 rounded-lg border transition-all ${
                        playingSceneId === sc.id
                          ? 'border-amber-500/80 bg-amber-500/5 ring-1 ring-amber-500/40 shadow-sm shadow-amber-500/10'
                          : 'border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                          {sc.timestamp_str}
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePlaySceneAudio(sc)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                            playingSceneId === sc.id
                              ? 'bg-amber-400 text-slate-950 font-bold animate-pulse'
                              : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                          }`}
                          title={playingSceneId === sc.id ? 'Tạm dừng nghe' : `Phát audio đoạn này (${sc.start_s ?? 0}s - ${sc.end_s ?? ''}s)`}
                        >
                          {playingSceneId === sc.id ? (
                            <>
                              <Pause className="w-2.5 h-2.5 fill-current" />
                              <span>Dừng</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>
                                {sc.end_s && sc.start_s !== undefined && (sc.end_s - sc.start_s) > 0
                                  ? `${(sc.end_s - sc.start_s).toFixed(1)}s`
                                  : 'Nghe'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium transition-colors ${
                          playingSceneId === sc.id ? 'text-amber-200' : 'text-slate-200'
                        }`}>
                          {sc.text}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                          <span>Từ {sc.start_s}s ➔ {sc.end_s}s</span>
                          <span>(Thời lượng: {(sc.end_s - sc.start_s).toFixed(1)}s)</span>
                          {playingSceneId === sc.id && (
                            <span className="text-amber-400 font-semibold animate-pulse flex items-center gap-1">
                              <Volume2 className="w-3 h-3" /> Đang phát audio...
                            </span>
                          )}
                        </div>
                      </div>

                      <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-400">
                        Scene #{i + 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500">
                  <Clock className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  <div className="text-xs">Chưa có phân cảnh nào</div>
                  <div className="text-[10px]">Bấm nút "Bóc Tách Tự Động" ở trên để sinh transcript theo mốc thời gian</div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* STAGE 5: TẠO ẢNH DOODLE KHỚP NHÂN VẬT GỐC                     */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {activeStage === 5 && (() => {
          const completedCount = currentProject?.scenes?.filter(s => s.status === 'completed' && s.image_url).length || 0
          const totalCount = currentProject?.scenes?.length || 0
          const missingCount = totalCount - completedCount
          const unwatermarkedCount = currentProject?.scenes?.filter(s => s.status === 'completed' && s.watermark_removed).length || 0
          const hasGenerating = isBatchGenerating || Boolean(currentProject?.scenes?.some(s => s.status === 'generating'))

          return (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> 5. Tạo Ảnh Doodle Cho Mỗi Dòng Transcript
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Mỗi cảnh tự động mang <code className="text-amber-300">HERO LOCK</code> và tham chiếu ảnh nhân vật chính để giữ vững sự nhất quán thị giác.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={imageModel}
                      onChange={e => setImageModel(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200"
                    >
                      <option value="BELUGA">BELUGA (Nano Banana 2 - Khuyên dùng)</option>
                      <option value="GEM_PIX_2">GEM_PIX_2 (Nano Banana Pro)</option>
                      <option value="NARWHAL">NARWHAL (Nano Banana 2 - Mã cũ)</option>
                    </select>

                    <Button
                      size="sm"
                      onClick={handleGenerateMissingScenes}
                      disabled={isBatchGenerating || missingCount === 0}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 font-semibold shadow-md shadow-amber-600/20"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-200" />
                      {isBatchGenerating ? `Đang tạo batch...` : `Tạo Tiếp Ảnh Còn Thiếu (${missingCount})`}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBatchGenerateImages}
                      disabled={isBatchGenerating || totalCount === 0}
                      className="text-xs border-slate-700 text-slate-300 hover:text-white"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Tạo Lại Tất Cả ({totalCount})
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRemoveWatermarkAll}
                      disabled={isBatchGenerating || isBatchWatermarking || completedCount === 0}
                      className="text-xs border-cyan-700/80 text-cyan-300 hover:bg-cyan-950/60 hover:text-cyan-200 gap-1.5 font-medium shadow-sm"
                      title="Xóa watermark Gemini ở góc dưới bên phải cho tất cả ảnh đã tạo"
                    >
                      <Eraser className={`w-3.5 h-3.5 ${isBatchWatermarking ? 'animate-spin' : ''}`} />
                      {isBatchWatermarking ? `Đang xóa watermark...` : `Xóa Watermark Tất Cả (${completedCount})`}
                    </Button>

                    {hasGenerating && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleStopAll}
                        className="bg-red-600 hover:bg-red-500 text-white text-xs gap-1.5 font-bold shadow-md shadow-red-600/30 animate-pulse"
                        title="Dừng khẩn cấp toàn bộ các ảnh đang generating và huỷ đợt tiếp theo"
                      >
                        <StopCircle className="w-3.5 h-3.5" /> Stop All ({activeAbortControllersRef.current.size || 'Dừng'})
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => setActiveStage(6)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
                    >
                      Tiếp Tục Ghép Video <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* ── AI PROMPT GENERATOR & DOODLE MASTER FRAMEWORK ── */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-slate-100">
                          Tạo Prompt Cho Từng Ảnh Bằng AI (2D Doodle Animation)
                        </span>
                        <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full font-medium">
                          {aiModel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-2xl">
                        AI sẽ đọc toàn bộ transcript, tự động hiểu bối cảnh chủ đề và sinh prompt hành động trực quan cho từng ảnh, kết hợp với nhân vật tham chiếu & bộ khung bắt buộc (100% Không chữ, 16:9 widescreen).
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => handleBuildPromptsAI()}
                        disabled={loading || isAiBuildingPrompts || !currentProject?.scenes?.length}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs gap-1.5 h-8 font-semibold shadow-md shadow-purple-600/30"
                        title="Đưa toàn bộ transcript vào AI (OpenAI Compatible) để sinh prompt chuẩn xác theo kịch bản"
                      >
                        <Sparkles className={`w-3.5 h-3.5 text-purple-200 ${isAiBuildingPrompts && aiBuildingSceneId === null ? 'animate-spin' : ''}`} />
                        {isAiBuildingPrompts && aiBuildingSceneId === null ? 'AI Đang Sinh Prompt...' : '✨ Tạo Toàn Bộ Bằng AI'}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBuildPrompts('doodle')}
                        disabled={loading || isAiBuildingPrompts || !currentProject?.scenes?.length}
                        className="border-slate-700 hover:bg-slate-800 text-slate-300 text-xs gap-1.5 h-8 font-medium"
                        title="Tạo prompt nhanh theo mẫu quy tắc có sẵn (không dùng AI)"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                        Tạo Nhanh (Mẫu)
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAiPromptConfig(!showAiPromptConfig)}
                        className={`text-xs h-8 px-2 transition-colors ${showAiPromptConfig ? 'text-purple-400 bg-purple-950/40' : 'text-slate-400 hover:text-slate-200'}`}
                        title="Cài đặt kết nối AI Prompt (OpenAI Compatible URL, Key, Model)"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Core Master Rules Badge Strip */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900 text-[11px]">
                    <span className="text-slate-500 font-medium">Khung chuẩn bắt buộc:</span>
                    <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-amber-300/90 font-mono text-[10px]">
                      Hand-drawn 2D doodle cartoon, bold marker lines
                    </span>
                    <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-emerald-300/90 font-mono text-[10px]">
                      Khóa nhân vật tham chiếu (Hero Lock)
                    </span>
                    <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-rose-300/90 font-mono text-[10px]">
                      Nghiêm cấm chữ / No subtitles
                    </span>
                    <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-sky-300/90 font-mono text-[10px]">
                      16:9 Widescreen
                    </span>
                  </div>

                  {/* AI Prompt Configuration Panel */}
                  {showAiPromptConfig && (
                    <div className="p-3 bg-slate-900/90 border border-purple-500/30 rounded-xl space-y-2 text-xs mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          Cấu hình AI Prompt (OpenAI Compatible)
                        </span>
                        <span className="text-[10px] text-slate-400">Tự động lưu vào trình duyệt</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">API Base URL:</label>
                          <input
                            type="text"
                            value={aiBaseUrl}
                            onChange={e => setAiBaseUrl(e.target.value)}
                            placeholder="https://ai.tuvimoi.com/v1"
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Model Name:</label>
                          <input
                            type="text"
                            value={aiModel}
                            onChange={e => setAiModel(e.target.value)}
                            placeholder="ag/gemini-3.8-flash-high"
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">API Key:</label>
                          <input
                            type="password"
                            value={aiApiKey}
                            onChange={e => setAiApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Batch Config Controls: Delay giữa mỗi ảnh, Timeout */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">Delay giữa mỗi ảnh:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={delayMin}
                          onChange={e => setDelayMin(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
                          className="w-12 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono font-bold text-sky-300 focus:outline-none focus:border-sky-500"
                          disabled={isBatchGenerating}
                          title="Thời gian delay tối thiểu (giây)"
                        />
                        <span className="text-slate-400 text-xs font-bold">➔</span>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={delayMax}
                          onChange={e => setDelayMax(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
                          className="w-12 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono font-bold text-sky-300 focus:outline-none focus:border-sky-500"
                          disabled={isBatchGenerating}
                          title="Thời gian delay tối đa (giây)"
                        />
                        <span className="text-slate-500 text-[11px]">giây (ngẫu nhiên)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">Timeout mỗi ảnh:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={15}
                          max={300}
                          value={batchTimeout}
                          onChange={e => setBatchTimeout(Math.max(15, Math.min(300, Number(e.target.value) || 60)))}
                          className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono font-bold text-red-300 focus:outline-none focus:border-red-500"
                          disabled={isBatchGenerating}
                          title="Nếu quá thời gian này (mặc định 60s / 1p) mà chưa có ảnh thì coi như thất bại"
                        />
                        <span className="text-slate-500 text-[11px]">giây</span>
                      </div>
                    </div>
                  </div>

                  {hasGenerating && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleStopAll}
                      className="text-xs h-7 px-3 gap-1 bg-red-600 hover:bg-red-500 font-bold ml-auto"
                      title="Dừng khẩn cấp toàn bộ các ảnh đang tạo ngay lập tức"
                    >
                      <StopCircle className="w-3.5 h-3.5" /> Stop All ({activeAbortControllersRef.current.size || 'Dừng'})
                    </Button>
                  )}
                </div>

                {/* Batch Progress Bar */}
                {batchGenProgress && (
                  <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-lg space-y-1.5 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        {batchGenProgress.message || `Đang tạo ảnh (${batchGenProgress.current}/${batchGenProgress.total})...`}
                      </span>
                      <span className="font-mono text-slate-400">
                        {Math.round((batchGenProgress.current / batchGenProgress.total) * 100)}% ({batchGenProgress.current}/{batchGenProgress.total})
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round((batchGenProgress.current / batchGenProgress.total) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Quota & Multi-Account Card */}
              <Card className="p-4 bg-slate-900/90 border border-amber-500/30 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                      <RotateCw className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-300 flex items-center gap-2">
                        Xử Lý Hết Quota: Đổi Tài Khoản Google Flow & Giữ Nguyên Tham Chiếu
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Tài khoản hiện tại hết quota? Hãy đăng nhập tài khoản Google khác trên Chrome, mở Flow và dán Project ID mới vào đây. Hệ thống tự động re-upload ảnh nhân vật gốc sang tài khoản mới và tạo tiếp {missingCount} ảnh còn thiếu (các ảnh cũ đã tải về máy không bị mất).
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-xs px-2.5 py-1">
                      ✓ Đã xong: {completedCount} / {totalCount} ảnh
                    </Badge>
                    {unwatermarkedCount > 0 && (
                      <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 bg-cyan-500/10 text-xs px-2.5 py-1 font-semibold gap-1">
                        <Check className="w-3 h-3" /> Đã xóa WM: {unwatermarkedCount} / {completedCount}
                      </Badge>
                    )}
                    {missingCount > 0 ? (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-xs px-2.5 py-1 font-semibold">
                        ⏳ Còn thiếu: {missingCount} ảnh
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/20 text-xs px-2.5 py-1 font-semibold">
                        ✓ Đủ 100% ảnh
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-1">
                  <div className="md:col-span-8 flex items-center gap-2.5">
                    <label className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
                      Flow Project ID của Acc mới:
                    </label>
                    <input
                      type="text"
                      value={flowProjectId}
                      onChange={e => setFlowProjectId(e.target.value)}
                      placeholder="e.g. ac385651-cad3-4fae-a2ba-8e37574d5e1b"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="md:col-span-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleResyncCharacter}
                      disabled={loading || !flowProjectId.trim()}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs gap-1.5 font-medium h-8"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Đồng Bộ Tham Chiếu Sang Acc Mới
                    </Button>
                  </div>
                </div>
              </Card>

              {/* PREVIEW: Scenes Grid with Images and Prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {currentProject?.scenes && currentProject.scenes.map(sc => (
                <Card
                  key={sc.id}
                  className={`p-3 bg-slate-900/80 border flex flex-col justify-between space-y-2.5 overflow-hidden transition-all duration-200 ${
                    playingSceneId === sc.id
                      ? 'border-amber-500/80 bg-slate-900 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Scene Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        {sc.timestamp_str}
                      </span>
                      {/* Play Scene Audio Button */}
                      <button
                        type="button"
                        onClick={() => handlePlaySceneAudio(sc)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                          playingSceneId === sc.id
                            ? 'bg-amber-400 text-slate-950 font-bold shadow-sm shadow-amber-400/40 animate-pulse'
                            : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-400'
                        }`}
                        title={
                          playingSceneId === sc.id
                            ? 'Tạm dừng nghe'
                            : `Phát audio đoạn này (${sc.start_s ?? 0}s - ${sc.end_s ?? ''}s)`
                        }
                      >
                        {playingSceneId === sc.id ? (
                          <>
                            <Pause className="w-2.5 h-2.5 fill-current" />
                            <span>Dừng</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>
                              {sc.end_s && sc.start_s !== undefined && (sc.end_s - sc.start_s) > 0
                                ? `${(sc.end_s - sc.start_s).toFixed(1)}s`
                                : 'Nghe'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        sc.status === 'completed'
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : sc.status === 'generating'
                          ? 'border-amber-500/30 text-amber-300 bg-amber-500/10 animate-pulse'
                          : sc.status === 'failed'
                          ? 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                          : 'border-slate-800 text-slate-500'
                      }`}
                    >
                      {sc.status || 'pending'}
                    </Badge>
                  </div>

                  {/* Scene Image Preview */}
                  <div className="aspect-video bg-slate-950 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center relative group">
                    {sc.watermark_removed && (
                      <div className="absolute top-2 left-2 bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1 z-20 shadow-md">
                        <Check className="w-2.5 h-2.5 text-emerald-400" /> Đã xóa WM
                      </div>
                    )}

                    {playingSceneId === sc.id && (
                      <div className="absolute top-2 right-2 bg-black/85 backdrop-blur-sm text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1 z-20 animate-pulse shadow-md">
                        <Volume2 className="w-3 h-3 text-amber-400" />
                        <span>{sc.start_s ?? 0}s - {sc.end_s ?? 0}s</span>
                      </div>
                    )}

                    {sc.image_url ? (
                      <>
                        <img
                          src={sc.image_url}
                          alt={`Scene ${sc.id}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white gap-2 text-[11px] z-10">
                          <button
                            onClick={() => setPreviewLightboxImg(sc.image_url || null)}
                            className="flex items-center gap-1 bg-slate-800/90 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 text-slate-200"
                          >
                            <Maximize2 className="w-3.5 h-3.5" /> Phóng To
                          </button>
                          <button
                            onClick={() => handlePlaySceneAudio(sc)}
                            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2 py-1 rounded shadow-md shadow-amber-500/30"
                          >
                            {playingSceneId === sc.id ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                            {playingSceneId === sc.id ? 'Dừng' : 'Nghe Tiếng'}
                          </button>
                        </div>
                      </>
                    ) : sc.status === 'generating' ? (
                      <div className="text-center p-3 text-amber-400 animate-pulse">
                        <RotateCw className="w-6 h-6 mx-auto mb-1 animate-spin" />
                        <div className="text-[10px]">Đang sinh ảnh qua Flow...</div>
                      </div>
                    ) : (
                      <div className="text-center p-3 text-slate-600 flex flex-col items-center justify-center gap-1">
                        <ImageIcon className="w-6 h-6 opacity-40" />
                        <div className="text-[10px]">Chưa sinh ảnh</div>
                        <button
                          onClick={() => handlePlaySceneAudio(sc)}
                          className="text-[10px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 mt-1 bg-slate-900 border border-slate-800 hover:border-slate-700 px-2 py-0.5 rounded transition-colors"
                        >
                          {playingSceneId === sc.id ? (
                            <Pause className="w-2.5 h-2.5 fill-current" />
                          ) : (
                            <Play className="w-2.5 h-2.5 fill-current" />
                          )}
                          {playingSceneId === sc.id ? 'Dừng audio' : 'Nghe tiếng cảnh này'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scene Text */}
                  <p className={`text-[11px] line-clamp-2 leading-tight transition-colors ${
                    playingSceneId === sc.id ? 'text-amber-200 font-medium' : 'text-slate-300'
                  }`}>
                    {sc.text}
                  </p>

                  {/* Prompt Preview (Collapsible) */}
                  <details className="text-[10px] text-slate-500 group">
                    <summary className="cursor-pointer hover:text-slate-300 select-none flex items-center justify-between">
                      <span>Xem câu Prompt đầy đủ</span>
                      <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-1 p-2 bg-slate-950 rounded border border-slate-800/80 text-slate-400 font-mono text-[9px] max-h-24 overflow-y-auto">
                      {sc.prompt}
                    </div>
                  </details>

                  {/* Action Buttons: AI Prompt, Regenerate & Remove Watermark */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBuildPromptsAI(sc.id)}
                      disabled={isAiBuildingPrompts && aiBuildingSceneId === sc.id}
                      className="text-[10px] h-7 border-purple-500/40 hover:bg-purple-950/40 text-purple-300 gap-1 px-2"
                      title="Dùng AI viết lại prompt riêng bám sát câu thoại này"
                    >
                      <Sparkles className={`w-3 h-3 text-purple-300 ${isAiBuildingPrompts && aiBuildingSceneId === sc.id ? 'animate-spin' : ''}`} />
                      {isAiBuildingPrompts && aiBuildingSceneId === sc.id ? 'Đang viết...' : 'AI Prompt'}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateSingleScene(sc.id, sc.prompt)}
                      disabled={sc.status === 'generating' || isBatchGenerating}
                      className="flex-1 text-[10px] h-7 border-slate-700 hover:bg-slate-800 gap-1"
                    >
                      <RotateCw className="w-3 h-3" />
                      {sc.image_url ? 'Tạo Lại' : 'Sinh Ảnh'}
                    </Button>

                    {sc.image_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveWatermarkSingle(sc.id)}
                        disabled={watermarkingSceneId === sc.id || isBatchWatermarking}
                        className={`text-[10px] h-7 px-2.5 gap-1 font-medium transition-colors ${
                          sc.watermark_removed
                            ? 'border-emerald-600/50 text-emerald-400 hover:bg-emerald-950/40'
                            : 'border-cyan-700/60 text-cyan-300 hover:bg-cyan-950/40 hover:text-cyan-200'
                        }`}
                        title={sc.watermark_removed ? 'Watermark đã được xóa (bấm để xóa lại)' : 'Xóa watermark Gemini ở góc dưới bên phải'}
                      >
                        <Eraser className={`w-3 h-3 ${watermarkingSceneId === sc.id ? 'animate-spin' : ''}`} />
                        {watermarkingSceneId === sc.id ? 'Đang xóa...' : sc.watermark_removed ? 'Đã Xóa WM' : 'Xóa WM'}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      })()}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* STAGE 6: GHÉP & XEM VIDEO THÀNH PHẨM (VIDEO ASSEMBLY)          */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {activeStage === 6 && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <Card className="md:col-span-5 p-5 bg-slate-900/80 border-slate-800 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-1">
                  <Video className="w-4 h-4" /> 6. Ghép Video Khớp Thời Gian (FFmpeg)
                </h3>
                <p className="text-xs text-slate-400">
                  Tự động căn chỉnh từng bức ảnh xuất hiện đúng chuẩn từng giây theo giọng đọc Minimax, kèm phụ đề chữ trắng viền đen YouTube Explainer.
                </p>
              </div>

              {/* Assembly Options */}
              <div className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Chèn phụ đề (Burn Subtitles):</span>
                  <input
                    type="checkbox"
                    checked={burnSubtitles}
                    onChange={e => setBurnSubtitles(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Độ phân giải:</span>
                  <Badge variant="outline" className="border-slate-700 text-slate-300">1080p (1920x1080) 16:9</Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Tổng số cảnh ghép:</span>
                  <span className="font-mono text-slate-200">{currentProject?.scenes?.length || 0} ảnh</span>
                </div>
              </div>

              <Button
                onClick={handleRenderVideo}
                disabled={renderingVideo || !currentProject?.audio_url || !currentProject?.scenes?.length}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs gap-1.5 py-2.5 font-medium shadow-lg shadow-emerald-950/40"
              >
                <Video className="w-4 h-4" /> {renderingVideo ? 'FFmpeg đang ghép video...' : 'Bắt Đầu Ghép Video Hoàn Chỉnh'}
              </Button>

              {currentProject?.video_url && (
                <a
                  href={currentProject.video_url}
                  download="final_story_video.mp4"
                  className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition-colors border border-slate-700"
                >
                  <Download className="w-4 h-4 text-amber-400" /> Tải Video Về Máy (MP4)
                </a>
              )}
            </Card>

            {/* PREVIEW: Full Video Player */}
            <Card className="md:col-span-7 p-5 bg-slate-900/80 border-slate-800 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="flex items-center gap-2"><Play className="w-4 h-4 text-emerald-400" /> Xem Trước Video Thành Phẩm (Full Preview)</span>
                  {currentProject?.video_url && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                      ✓ Đã Render Hoàn Tất
                    </Badge>
                  )}
                </h3>

                <div className="aspect-video bg-black rounded-xl border border-slate-800 overflow-hidden mt-4 flex items-center justify-center relative">
                  {currentProject?.video_url ? (
                    <video
                      controls
                      playsInline
                      src={currentProject.video_url}
                      className="w-full h-full object-contain"
                    />
                  ) : renderingVideo ? (
                    <div className="text-center p-6 text-emerald-400 space-y-2 animate-pulse">
                      <RotateCw className="w-8 h-8 mx-auto animate-spin" />
                      <div className="text-xs font-semibold">Đang tổng hợp khung hình & âm thanh...</div>
                      <div className="text-[10px] text-slate-500">Tiến trình này mất khoảng 5–15 giây tùy độ dài kịch bản</div>
                    </div>
                  ) : (
                    <div className="text-center p-6 text-slate-600 space-y-1">
                      <Video className="w-12 h-12 mx-auto opacity-30 mb-2" />
                      <div className="text-xs">Chưa có video thành phẩm</div>
                      <div className="text-[10px]">Bấm nút "Bắt Đầu Ghép Video" ở khung bên trái</div>
                    </div>
                  )}
                </div>
              </div>

              {currentProject?.video_size && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                  <span>Dung lượng: {(currentProject.video_size / (1024 * 1024)).toFixed(2)} MB</span>
                  <span>Định dạng: MP4 (H.264 / AAC)</span>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* ── Hidden Scene Audio Player (Stage 4 & 5 timestamp check) ── */}
      <audio
        ref={sceneAudioRef}
        src={currentProject?.audio_url || undefined}
        preload="auto"
        onEnded={stopSceneAudio}
      />

      {/* ── Modal Xác Nhận Xóa Dự Án ─────────────────────────────── */}
      {showDeleteModal && currentProject && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isDeletingProject && setShowDeleteModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Xác nhận xóa dự án?</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Hành động này sẽ xóa vĩnh viễn dự án <strong className="text-amber-400">"{currentProject.title}"</strong> cùng toàn bộ ảnh doodle, kịch bản, file âm thanh và video liên quan.
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Dữ liệu đã xóa sẽ không thể phục hồi lại.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                size="sm"
                variant="ghost"
                disabled={isDeletingProject}
                onClick={() => setShowDeleteModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                disabled={isDeletingProject}
                onClick={handleDeleteProject}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs gap-1.5"
              >
                {isDeletingProject ? (
                  <>Đang xóa...</>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Xác Nhận Xóa
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox Modal for Large Image Preview ─────────────────── */}
      {previewLightboxImg && (
        <div
          onClick={() => setPreviewLightboxImg(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-950 p-2 rounded-2xl border border-slate-800 shadow-2xl">
            <button
              onClick={() => setPreviewLightboxImg(null)}
              className="absolute top-4 right-4 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/90 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewLightboxImg}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
