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
  Layers,
  Lock,
  Tag,
  Save,
  Link2,
  Film,
  Copy,
  Scissors,
  Flame,
  Smartphone,
  Globe,
  Sliders,
  Tv,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fetchAPI } from '@/api/client'

export interface ChannelItem {
  id: string
  name: string
  handle?: string
  title_prefix?: string
  description?: string
  niche?: string
  character_name?: string
  character_image_url?: string
  hero_lock?: string
  video_count?: number
  created_at?: number
  updated_at?: number
  character_settings?: {
    character_name?: string
    character_image_url?: string
    character_media_id?: string
    hero_lock?: string
    flow_project_id?: string
  }
  prompt_templates?: {
    scene_prefix?: string
    scene_suffix_no_text?: string
    scene_suffix_concept_card?: string
    ai_director_system_prompt?: string
  }
  tts_preset?: {
    provider?: string
    voice_id?: string
    speed?: number
    model?: string
  }
  browser_profile?: {
    profile_dir?: string
    proxy?: string
    last_opened_at?: number
  }
}

const DEFAULT_CHANNELS: ChannelItem[] = [
  {
    id: 'channel_k1',
    name: 'KÊNH 1 — Tâm Lý Học & Não Bộ',
    handle: '@TamLyHocNaoBo',
    niche: 'brain_psychology',
    title_prefix: 'K1',
    character_name: 'Doodle Master K1',
    character_image_url: '/output/story_studio/channel_k1/master_character.png',
    character_settings: {
      character_name: 'Doodle Master K1',
      character_image_url: '/output/story_studio/channel_k1/master_character.png'
    },
    video_count: 3,
    prompt_templates: {
      scene_prefix: 'Hand-drawn 2D doodle cartoon animation, flat solid colors, bold black hand-drawn outlines, slightly wobbly imperfect marker lines, minimalist style, ',
      scene_suffix_no_text: ', same character design as the reference image, preserving character facial features and minimalist stick figure body, do not redesign the character, no text, no words, no letters, no subtitles, no speech bubbles, no captions, no photorealism, no 3D render, no CGI, no realistic shading, 16:9 widescreen, simple educational YouTube explainer doodle style.',
      scene_suffix_concept_card: ', centered single bold red hand-lettered keyword text on plain background only, no subtitles, no paragraphs, no extra words, no gradients, no photographic textures, 16:9 widescreen, simple educational YouTube explainer doodle style.',
      ai_director_system_prompt: 'You are an elite Visual Director and Lead Storyboard Illustrator for viral educational 2D doodle animations about brain psychology, cognitive bias, and neuroscience (Kurzgesagt / MinutePhysics style). Read the transcript, ground every scene in relatable human dilemmas and brain gags, maintain character continuity, and produce concise, direct visual prompts for each scene.'
    },
    tts_preset: {
      provider: 'minimax',
      voice_id: 'male-qn-qingse',
      speed: 1.05,
      model: 'speech-02-turbo'
    }
  },
  {
    id: 'channel_k2',
    name: 'KÊNH 2 — Con Người Cổ Đại & Sinh Tồn',
    handle: '@ConNguoiCoDai',
    niche: 'ancient_humans',
    title_prefix: 'K2',
    character_name: 'Doodle Master K2',
    character_image_url: '/output/story_studio/channel_k2/master_character.png',
    character_settings: {
      character_name: 'Doodle Master K2',
      character_image_url: '/output/story_studio/channel_k2/master_character.png'
    },
    video_count: 3,
    prompt_templates: {
      scene_prefix: 'Hand-drawn 2D doodle cartoon animation, flat solid colors, bold black hand-drawn outlines, slightly wobbly imperfect marker lines, minimalist style, ',
      scene_suffix_no_text: ', same character design as the reference image, preserving character facial features and hair style, do not redesign the character, do not change hair color or clothes, no text, no words, no letters, no subtitles, no speech bubbles, no captions, no blank background, no photorealism, no 3D render, no CGI, no realistic shading, 16:9 widescreen, simple educational YouTube explainer doodle style.',
      scene_suffix_concept_card: ', centered single bold red hand-lettered keyword text on plain background only, no subtitles, no paragraphs, no extra words, no gradients, no photographic textures, 16:9 widescreen, simple educational YouTube explainer doodle style.',
      ai_director_system_prompt: 'You are an elite Visual Director and Lead Storyboard Illustrator for viral educational 2D doodle animations about ancient humans, prehistory, and survival (Kurzgesagt / MinutePhysics style). Read the transcript, ground every scene in prehistoric savanna environment, caves, campfires, and survival artifacts, maintain the orange spiky-haired character continuity, and produce concise, direct visual prompts for each scene.'
    },
    tts_preset: {
      provider: 'minimax',
      voice_id: 'male-qn-qingse',
      speed: 1.0,
      model: 'speech-02-turbo'
    }
  }
]

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
  media_id?: string
  transition_type?: 'new_scene' | 'inherit_edit' | 'hold_frame' | string
  source_scene_id?: number | null
  status?: 'pending' | 'generating' | 'completed' | 'failed'
  error?: string
  watermark_removed?: boolean
}

export interface YoutubeTitleItem {
  type: string
  title: string
}

export interface YoutubeThumbnailConcept {
  variant: number
  name: string
  slogan?: string
  hook_text: string
  visual_description: string
  prompt: string
}

export interface YoutubeMetadata {
  titles: YoutubeTitleItem[]
  description: string
  tags: string
  hashtags: string[]
  thumbnail_concepts: YoutubeThumbnailConcept[]
}

interface ShortItem {
  id: string
  title: string
  description?: string
  hook_text: string
  hook_reason?: string
  virality_score: number
  start_scene_id: number
  end_scene_id: number
  start_s: number
  end_s: number
  duration_s: number
  layout_mode?: string
  status: 'ready' | 'rendering' | 'completed' | 'failed'
  video_url?: string
  thumb_url?: string
  video_size?: number
  hashtags?: string[]
  created_at?: number
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
  background_mode?: 'dynamic' | 'fixed' | string
  topic_requirements?: string
  chaining_mode?: boolean
  ken_burns?: boolean
  youtube_metadata?: YoutubeMetadata
  thumbnail_url?: string
  thumbnail_watermark_removed?: boolean
  thumbnail_hook_text?: string
  shorts_candidates?: ShortItem[]
  shorts?: ShortItem[]
  channel_id?: string
  prompt_config?: {
    scene_prefix?: string
    scene_suffix_no_text?: string
    scene_suffix_concept_card?: string
    ai_director_system_prompt?: string
  }
}

export interface PromptStyleInfo {
  id: string
  name: string
  short_desc: string
  description_vi: string
  badge_color: string
  default_hero_lock: string
  key_elements: string[]
  default_topic_requirements?: string
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
    default_topic_requirements: `- Bối cảnh sông nước & làng quê: Nhà sàn gỗ mộc mạc, sương sớm mờ ảo trên mặt sông, thuyền độc mộc hẹp với mái chèo đơn trên làn nước êm đềm.
- Đời sống thường nhật: Chợ phiên ngoài trời nhộn nhịp với chum vại gốm nung, các bó muối trắng và cá khô trải trên chiếu cói; đồng lúa xanh ngát vùng ngoại ô.
- Yếu tố biểu tượng: Phế tích đền đá cổ kính bị gạch chéo đỏ X to đậm ngang khung hình để bác bỏ ảo tưởng về cung điện/kho báu hoàng gia; lửa trại bên bờ sông lúc hoàng hôn dưới trăng lưỡi liềm vàng.`,
  },
  {
    id: 'ancient_humans',
    name: 'Con Người Cổ Đại & Tiến Hóa (Ancient Humans)',
    short_desc: 'Doodle tiền sử, thảo nguyên savanna, tảng đá dán nhãn, lửa trại bộ lạc',
    description_vi: 'Phong cách doodle 2D chuẩn Ancient Humans về nhân chủng học, tiến hóa và sinh tồn tiền sử. Nhân vật que đầu tròn tóc cam nhọn đặc trưng (#F58220) hoặc người tiền sử tóc nâu xù. Đặc trưng: tảng đá dán nhãn chữ trắng ALL-CAPS (SURVIVAL), thảo nguyên savanna cây keo lẻ loi, mây mưa khó khăn, lửa trại bộ lạc, nhà khảo cổ nón cối, dấu X đỏ phủ định.',
    badge_color: 'bg-orange-950/70 text-orange-300 border-orange-800/60',
    default_hero_lock: 'The main stick figure character from the reference image with spiky bright orange hair',
    key_elements: ['Thảo nguyên savanna cây keo (acacia)', 'Tảng đá lớn dán nhãn chữ trắng (SURVIVAL)', 'Lửa trại bộ lạc & nhà khảo cổ nón cối', 'Mây mưa gian khổ & Dấu X đỏ phủ định'],
    default_topic_requirements: `- Bối cảnh tiền sử: Thảo nguyên savanna rộng lớn với bầu trời cam hoàng hôn/bình minh, nền đất nâu cát với khóm cỏ dại và cây keo (acacia) tán phẳng đơn độc ở xa; ban ngày trời xanh đất nâu cát.
- Nhân vật & kiểu tóc: Nhân vật chính 'bạn' có tóc cam nhọn dựng đứng (#F58220); người tiền sử tổ tiên có mái tóc nâu bù xù; nhân vật thời hiện đại đầu tròn trắng trọc.
- Thiết bị hình ảnh đặc trưng (Ancient Humans Framework):
  * Ngọn giáo gỗ nguyên thủy cầm trên tay với vẻ mặt nghiến răng kiên định khi đi săn hoặc đối mặt thú dữ.
  * Tảng đá xám khổng lồ có nhãn chữ trắng IN HOA viết tay 'SURVIVAL' cho các khái niệm sinh tồn trừu tượng.
  * Bộ lạc thân thiện ngồi thành vòng tròn quanh đống lửa trại bập bùng trên nền đất cát.
  * Nhà khảo cổ đội nón cối màu nâu, đeo ba lô, cầm đèn bão vàng đứng bên cạnh cửa hang đá tối.
  * Gian khổ / đau đớn: Nhân vật que ngồi bó gối buồn bã dưới đám mây xám đổ mưa hạt xanh.
  * Dấu X đỏ phủ định: Nhân vật hoặc hình vẽ minh họa bị gạch chéo một dấu X ĐỎ to bản ngang khung hình ('quan niệm sai / không phải thế này').
  * Khung mốc thời gian: Nền trắng/kem với chữ số đỏ nổi bật viết tay in hoa (ví dụ: '300,000 YEARS').`,
  },
  {
    id: 'brain_psychology',
    name: 'Tâm Lý Học Não Bộ (Why Brain Ignores Advice)',
    short_desc: 'Doodle tâm lý học, não bộ hồng 2D ngộ nghĩnh, lời khuyên bị phớt lờ, thiên kiến nhận thức',
    description_vi: 'Phong cách hoạt hình doodle 2D chuyên đề Tâm lý học & Khoa học Hành vi (Psychology & Behavioral Neuroscience). Nhân vật que tối giản tương tác cùng bộ não hoạt hình 2D màu hồng pastel/san hô với biểu cảm ngộ nghĩnh (bối rối, lười biếng, hoảng sợ), người que bịt tai phớt lờ loa phóng thanh lời khuyên, đám mây suy nghĩ rối như tơ vò, bẫy dopamine lướt điện thoại, ngã rẽ thói quen và các thí nghiệm tâm lý với dấu X đỏ phủ định.',
    badge_color: 'bg-rose-950/70 text-rose-300 border-rose-800/60',
    default_hero_lock: 'The main minimalist stick figure character from the reference image with a round white head',
    key_elements: ['Bộ não hoạt hình 2D màu hồng biểu cảm', 'Người que bịt tai phớt lờ loa phóng thanh', 'Bẫy dopamine (lướt điện thoại, giường ngủ)', 'Đám mây suy nghĩ rối rắm & Thiên kiến nhận thức'],
    default_topic_requirements: `- Bối cảnh & Nhân vật: Người que tối giản đầu tròn trắng; bối cảnh đời thường hiện đại (bàn làm việc với laptop, phòng ngủ đêm, ngã rẽ hai con đường).
- Thiết bị hình ảnh đặc trưng:
  * Người que bịt tai quay mặt đi trước một chiếc loa phóng thanh màu đỏ đang phát ra biểu tượng sóng âm lời khuyên.
  * Phòng ngủ lúc nửa đêm: nằm trùm chăn trong bóng tối, mặt sáng lên bởi ánh đèn màn hình điện thoại đang lướt ngón tay.
  * Phòng thủ cái tôi: vội vã xây một bức tường gạch hoạt hình trước mặt rồi thò đầu nhìn qua với vẻ mặt cố chấp.
  * Đám mây suy nghĩ rối như búi len đen lơ lửng trên đầu tượng trưng cho lo âu, rối rắm nhận thức.
  * Bộ não hoạt hình 2D phẳng màu hồng nhỏ xinh với biểu cảm ngộ nghĩnh cho các chi tiết về thần kinh.
  * Thẻ khái niệm với từ khóa ĐỎ IN HOA viết tay (ví dụ: 'REACTANCE', 'BIAS', 'DOPAMINE') khi định nghĩa thuật ngữ.
  * Dấu X đỏ gạch chéo phủ định quan niệm sai lầm và thiên kiến tâm lý.`,
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
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
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
  const [backgroundMode, setBackgroundMode] = useState<'dynamic' | 'fixed'>('dynamic')
  const [chainingMode, setChainingMode] = useState<boolean>(() => localStorage.getItem('fk_story_chaining_mode') === 'true')
  const [topicRequirements, setTopicRequirements] = useState<string>('')
  const [topicSaveStatus, setTopicSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimeoutRef = useRef<any>(null)
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
  const [kenBurns, setKenBurns] = useState<boolean>(() => localStorage.getItem('fk_ken_burns') !== 'false')
  const [renderingVideo, setRenderingVideo] = useState<boolean>(false)

  // YouTube Viral Kit State
  const [isGeneratingYoutubeMeta, setIsGeneratingYoutubeMeta] = useState<boolean>(false)
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState<boolean>(false)
  const [isRemovingThumbWatermark, setIsRemovingThumbWatermark] = useState<boolean>(false)
  const [generatingThumbVariant, setGeneratingThumbVariant] = useState<number | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AI Auto Shorts Extractor State
  const [isAnalyzingShorts, setIsAnalyzingShorts] = useState<boolean>(false)
  const [renderingShortId, setRenderingShortId] = useState<string | null>(null)
  const [isBatchRenderingShorts, setIsBatchRenderingShorts] = useState<boolean>(false)
  const [shortsLayoutMode, setShortsLayoutMode] = useState<'stacked' | 'full_crop'>('stacked')
  const [shortsSfxMode, setShortsSfxMode] = useState<'none' | 'ding'>('none')
  const [customShortsInstruction, setCustomShortsInstruction] = useState<string>('')

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

  // Channel Management State
  const [channels, setChannels] = useState<ChannelItem[]>(DEFAULT_CHANNELS)
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => {
    const saved = localStorage.getItem('fk_selected_channel_id')
    return (saved && saved !== 'all') ? saved : 'channel_k1'
  })
  const [activeChannelDetail, setActiveChannelDetail] = useState<ChannelItem | null>(() => {
    const saved = localStorage.getItem('fk_selected_channel_id')
    const initId = (saved && saved !== 'all') ? saved : 'channel_k1'
    return DEFAULT_CHANNELS.find(c => c.id === initId) || DEFAULT_CHANNELS[0]
  })
  const [showChannelSettingsModal, setShowChannelSettingsModal] = useState<boolean>(false)
  const [channelSettingsTab, setChannelSettingsTab] = useState<'info' | 'character' | 'prompts' | 'tts' | 'browser'>('info')
  const [channelEditForm, setChannelEditForm] = useState<any>(() => {
    const saved = localStorage.getItem('fk_selected_channel_id')
    const initId = (saved && saved !== 'all') ? saved : 'channel_k1'
    const initCh = DEFAULT_CHANNELS.find(c => c.id === initId) || DEFAULT_CHANNELS[0]
    return JSON.parse(JSON.stringify(initCh))
  })
  const [isSavingChannel, setIsSavingChannel] = useState<boolean>(false)
  const [isOpeningBrowser, setIsOpeningBrowser] = useState<boolean>(false)
  const [browserIsOpen, setBrowserIsOpen] = useState<boolean>(false)
  const [browserPort, setBrowserPort] = useState<number>(9222)
  const [showCreateChannelModal, setShowCreateChannelModal] = useState<boolean>(false)
  const [newChannelName, setNewChannelName] = useState<string>('')
  const [newChannelPrefix, setNewChannelPrefix] = useState<string>('')
  const [newChannelNiche, setNewChannelNiche] = useState<string>('brain_psychology')
  const [isCreatingChannel, setIsCreatingChannel] = useState<boolean>(false)
  const [isUploadingChannelChar, setIsUploadingChannelChar] = useState<boolean>(false)
  const [channelModalStatus, setChannelModalStatus] = useState<{ type: 'ok' | 'err', text: string } | null>(null)
  const channelFileInputRef = useRef<HTMLInputElement>(null)

  // Per-project Prompt Overrides State (Scene Prefix, Suffix No Text, Suffix Concept Card, AI Director System Prompt)
  const [showPromptOverrides, setShowPromptOverrides] = useState<boolean>(false)
  const [projectScenePrefix, setProjectScenePrefix] = useState<string>('')
  const [projectSceneSuffixNoText, setProjectSceneSuffixNoText] = useState<string>('')
  const [projectSceneSuffixConcept, setProjectSceneSuffixConcept] = useState<string>('')
  const [projectSystemPrompt, setProjectSystemPrompt] = useState<string>('')
  const [isSavingPromptConfig, setIsSavingPromptConfig] = useState<boolean>(false)

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

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  // Load channels and projects
  const loadProjects = async (targetChannelId?: string) => {
    try {
      const chId = targetChannelId || selectedChannelId || 'channel_k1'
      const data = await fetchAPI<{ projects: any[] }>(`/api/story-studio/projects?channel_id=${chId}`)
      const projList = data.projects || []
      setProjects(projList)
      if (projList.length > 0) {
        if (!currentProject || !projList.some(p => p.id === currentProject.id)) {
          setSelectedProjectId(projList[0].id)
          await loadProjectDetail(projList[0].id)
        }
      } else {
        setCurrentProject(null)
        setSelectedProjectId('')
      }
    } catch (e: any) {
      console.error('Failed to load projects', e)
    }
  }

  const loadChannels = async () => {
    try {
      const res = await fetchAPI<{ channels: ChannelItem[] }>('/api/story-studio/channels')
      const chList = (res.channels && res.channels.length > 0) ? res.channels : DEFAULT_CHANNELS
      setChannels(chList)
      
      const effectiveCid = (selectedChannelId && selectedChannelId !== 'all' && chList.some(c => c.id === selectedChannelId))
        ? selectedChannelId
        : (chList[0]?.id || 'channel_k1')
      
      setSelectedChannelId(effectiveCid)
      localStorage.setItem('fk_selected_channel_id', effectiveCid)
      await loadChannelDetail(effectiveCid)
      await loadProjects(effectiveCid)
    } catch (e) {
      console.warn('Failed to load channels from server, using local defaults', e)
      setChannels(DEFAULT_CHANNELS)
      const effectiveCid = (selectedChannelId && selectedChannelId !== 'all') ? selectedChannelId : 'channel_k1'
      setSelectedChannelId(effectiveCid)
      const current = DEFAULT_CHANNELS.find(c => c.id === effectiveCid) || DEFAULT_CHANNELS[0]
      setActiveChannelDetail(current)
      setChannelEditForm(JSON.parse(JSON.stringify(current)))
      await loadProjects(effectiveCid)
    }
  }

  const loadChannelDetail = async (cid: string) => {
    try {
      const ch = await fetchAPI<ChannelItem>(`/api/story-studio/channels/${cid}`)
      if (ch && ch.id) {
        setActiveChannelDetail(ch)
        setChannelEditForm(JSON.parse(JSON.stringify(ch)))
        checkBrowserStatus(cid)
      }
    } catch (e) {
      console.warn('Failed to load channel detail', e)
    }
  }

  const checkBrowserStatus = async (cid: string) => {
    try {
      const res = await fetchAPI<{ is_open: boolean; port: number }>(`/api/story-studio/channels/${cid}/browser-status`)
      setBrowserIsOpen(res.is_open)
      setBrowserPort(res.port)
    } catch {
      setBrowserIsOpen(false)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [])

  useEffect(() => {
    if (!activeChannelDetail?.id) return
    const interval = setInterval(() => {
      checkBrowserStatus(activeChannelDetail.id)
    }, 10000)
    return () => clearInterval(interval)
  }, [activeChannelDetail?.id])

  const handleSwitchChannel = async (cid: string) => {
    const targetCid = (!cid || cid === 'all') ? 'channel_k1' : cid
    setSelectedChannelId(targetCid)
    localStorage.setItem('fk_selected_channel_id', targetCid)
    const local = channels.find(c => c.id === targetCid) || DEFAULT_CHANNELS.find(c => c.id === targetCid)
    if (local) {
      setActiveChannelDetail(local)
      setChannelEditForm(JSON.parse(JSON.stringify(local)))
    }
    await loadChannelDetail(targetCid)
    await loadProjects(targetCid)
  }

  const handleOpenChannelSettings = async (cid?: string) => {
    const targetCid = cid || selectedChannelId || 'channel_k1'
    const target = channels.find(c => c.id === targetCid) 
      || (activeChannelDetail?.id === targetCid ? activeChannelDetail : null) 
      || DEFAULT_CHANNELS.find(c => c.id === targetCid) 
      || DEFAULT_CHANNELS[0]
    setChannelEditForm(JSON.parse(JSON.stringify(target)))
    setChannelModalStatus(null)
    setShowChannelSettingsModal(true)
    try {
      const ch = await fetchAPI<ChannelItem>(`/api/story-studio/channels/${targetCid}`)
      if (ch && ch.id) {
        setActiveChannelDetail(ch)
        setChannelEditForm(JSON.parse(JSON.stringify(ch)))
      }
    } catch (e) {
      console.warn('Could not refresh channel detail from server, using local data', e)
    }
  }

  const handleOpenChannelBrowser = async (cid?: string) => {
    const targetCid = cid || (selectedChannelId !== 'all' ? selectedChannelId : activeChannelDetail?.id)
    if (!targetCid || targetCid === 'all') {
      setStatusMsg({ type: 'err', text: 'Vui lòng chọn 1 kênh cụ thể trong danh sách để mở profile trình duyệt!' })
      return
    }
    try {
      setIsOpeningBrowser(true)
      setStatusMsg({ type: 'ok', text: 'Đang mở cửa sổ Chrome YouTube Studio với Profile riêng biệt (DrissionPage anti-detect)...' })
      const res = await fetchAPI<any>(`/api/story-studio/channels/${targetCid}/open-browser`, {
        method: 'POST',
      })
      setBrowserIsOpen(true)
      setStatusMsg({
        type: 'ok',
        text: `Đã mở cửa sổ Chrome cho kênh (Port ${res.debug_port || browserPort})! Profile độc lập, an toàn tuyệt đối.`,
      })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi khi mở trình duyệt kênh' })
    } finally {
      setIsOpeningBrowser(false)
    }
  }

  const handleSaveChannelSettings = async () => {
    const targetId = channelEditForm?.id || activeChannelDetail?.id || selectedChannelId || 'channel_k1'
    try {
      setIsSavingChannel(true)
      setChannelModalStatus(null)
      const res = await fetchAPI<ChannelItem>(`/api/story-studio/channels/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelEditForm),
      })
      setActiveChannelDetail(res)
      setChannelEditForm(JSON.parse(JSON.stringify(res)))
      await loadChannels()
      setChannelModalStatus({ type: 'ok', text: `✓ Đã lưu cài đặt cho kênh "${res.name}" thành công!` })
      setStatusMsg({ type: 'ok', text: `Đã lưu cài đặt cho kênh "${res.name}"!` })
    } catch (e: any) {
      setChannelModalStatus({ type: 'err', text: e.message || 'Lỗi khi lưu cài đặt kênh' })
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi khi lưu cài đặt kênh' })
    } finally {
      setIsSavingChannel(false)
    }
  }

  const handleUploadChannelCharacter = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetCid = channelEditForm?.id || activeChannelDetail?.id || selectedChannelId || 'channel_k1'
    if (!e.target.files?.[0] || !targetCid) return
    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('file', file)
    try {
      setIsUploadingChannelChar(true)
      setChannelModalStatus(null)
      const res = await fetchAPI<any>(`/api/story-studio/channels/${targetCid}/character`, {
        method: 'POST',
        body: formData,
      })
      const charUrl = res.character_image_url || res.url
      setActiveChannelDetail(prev => prev ? {
        ...prev,
        character_image_url: charUrl,
        character_settings: {
          ...(prev.character_settings || {}),
          character_image_url: charUrl,
          hero_lock: res.hero_lock || prev.character_settings?.hero_lock,
        }
      } : null)
      setChannelEditForm((prev: any) => ({
        ...prev,
        character_image_url: charUrl,
        character_settings: {
          ...(prev?.character_settings || {}),
          character_image_url: charUrl,
        }
      }))
      await loadChannels()
      setChannelModalStatus({ type: 'ok', text: '✓ Đã tải ảnh nhân vật đại diện thành công!' })
      setStatusMsg({ type: 'ok', text: 'Tải ảnh nhân vật tham chiếu kênh thành công!' })
    } catch (e: any) {
      setChannelModalStatus({ type: 'err', text: e.message || 'Lỗi tải ảnh nhân vật kênh' })
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi tải ảnh nhân vật kênh' })
    } finally {
      setIsUploadingChannelChar(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      setStatusMsg({ type: 'err', text: 'Tên kênh không được để trống' })
      return
    }
    try {
      setIsCreatingChannel(true)
      const res = await fetchAPI<ChannelItem>('/api/story-studio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannelName.trim(),
          title_prefix: newChannelPrefix.trim() || undefined,
          niche: newChannelNiche,
        }),
      })
      await loadChannels()
      setSelectedChannelId(res.id)
      localStorage.setItem('fk_selected_channel_id', res.id)
      await loadChannelDetail(res.id)
      await loadProjects(res.id)
      setShowCreateChannelModal(false)
      setNewChannelName('')
      setNewChannelPrefix('')
      setStatusMsg({ type: 'ok', text: `Tạo kênh mới "${res.name}" thành công!` })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi tạo kênh mới' })
    } finally {
      setIsCreatingChannel(false)
    }
  }

  const handleSavePromptConfig = async () => {
    if (!currentProject) return
    try {
      setIsSavingPromptConfig(true)
      const pCfg = {
        scene_prefix: projectScenePrefix,
        scene_suffix_no_text: projectSceneSuffixNoText,
        scene_suffix_concept_card: projectSceneSuffixConcept,
        ai_director_system_prompt: projectSystemPrompt,
      }
      await fetchAPI<StoryProject>(`/api/story-studio/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_config: pCfg }),
      })
      setCurrentProject(prev => prev ? { ...prev, prompt_config: pCfg } : null)
      setStatusMsg({ type: 'ok', text: 'Đã lưu cấu hình Prefix / Suffix tùy biến cho tập này!' })
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message || 'Lỗi lưu cấu hình prompt' })
    } finally {
      setIsSavingPromptConfig(false)
    }
  }

  const handleResetPromptConfigToChannel = () => {
    const ch = activeChannelDetail || channels.find(c => c.id === currentProject?.channel_id)
    if (ch?.prompt_templates) {
      setProjectScenePrefix(ch.prompt_templates.scene_prefix || '')
      setProjectSceneSuffixNoText(ch.prompt_templates.scene_suffix_no_text || '')
      setProjectSceneSuffixConcept(ch.prompt_templates.scene_suffix_concept_card || '')
      setProjectSystemPrompt(ch.prompt_templates.ai_director_system_prompt || '')
      setStatusMsg({ type: 'ok', text: `Đã khôi phục Prefix/Suffix theo mặc định của kênh "${ch.name}"!` })
    } else {
      setStatusMsg({ type: 'err', text: 'Kênh chưa có mẫu prompt mặc định' })
    }
  }

  const loadProjectDetail = async (id: string) => {
    setSelectedProjectId(id)
    try {
      setLoading(true)
      const proj = await fetchAPI<StoryProject>(`/api/story-studio/projects/${id}`)
      setCurrentProject(proj)
      setHeroLock(proj.hero_lock || '')
      setPromptStyle(proj.prompt_style || 'forgotten_civilizations')

      const localBg = localStorage.getItem(`fk_bg_mode_${id}`) as 'dynamic' | 'fixed' | null
      const effectiveBg = (proj.background_mode as 'dynamic' | 'fixed') || localBg || 'dynamic'
      setBackgroundMode(effectiveBg)

      const localChaining = localStorage.getItem(`fk_chaining_mode_${id}`)
      const effectiveChaining = proj.chaining_mode !== undefined
        ? Boolean(proj.chaining_mode)
        : (localChaining !== null ? localChaining === 'true' : false)
      setChainingMode(effectiveChaining)

      const localTopic = localStorage.getItem(`fk_topic_reqs_${id}`)
      const effectiveTopic = (proj.topic_requirements !== undefined && proj.topic_requirements !== null && proj.topic_requirements !== '')
        ? proj.topic_requirements
        : (localTopic !== null && localTopic !== undefined ? localTopic : (proj.topic_requirements || ''))
      setTopicRequirements(effectiveTopic)
      setTopicSaveStatus('idle')

      if (effectiveTopic) {
        localStorage.setItem(`fk_topic_reqs_${id}`, effectiveTopic)
      }
      localStorage.setItem(`fk_bg_mode_${id}`, effectiveBg)
      localStorage.setItem(`fk_chaining_mode_${id}`, String(effectiveChaining))

      if (proj.flow_project_id) {
        setFlowProjectId(proj.flow_project_id)
        localStorage.setItem('fk_last_flow_project_id', proj.flow_project_id)
      }
      setTopic(proj.keyword || '')
      setScriptText(proj.script_text || '')
      if (proj.ken_burns !== undefined) {
        setKenBurns(Boolean(proj.ken_burns))
      }

      // Directly populate prompt_config from project or fallback directly to channel templates
      const pCfg = proj.prompt_config || {}
      const ch = channels.find(c => c.id === proj.channel_id) || activeChannelDetail
      const cPrompts = ch?.prompt_templates || {}

      setProjectScenePrefix(
        (pCfg.scene_prefix !== undefined && pCfg.scene_prefix !== '')
          ? pCfg.scene_prefix
          : (cPrompts.scene_prefix || '')
      )
      setProjectSceneSuffixNoText(
        (pCfg.scene_suffix_no_text !== undefined && pCfg.scene_suffix_no_text !== '')
          ? pCfg.scene_suffix_no_text
          : (cPrompts.scene_suffix_no_text || '')
      )
      setProjectSceneSuffixConcept(
        (pCfg.scene_suffix_concept_card !== undefined && pCfg.scene_suffix_concept_card !== '')
          ? pCfg.scene_suffix_concept_card
          : (cPrompts.scene_suffix_concept_card || '')
      )
      setProjectSystemPrompt(
        (pCfg.ai_director_system_prompt !== undefined && pCfg.ai_director_system_prompt !== '')
          ? pCfg.ai_director_system_prompt
          : (cPrompts.ai_director_system_prompt || '')
      )

      if (proj.channel_id && (!activeChannelDetail || activeChannelDetail.id !== proj.channel_id)) {
        loadChannelDetail(proj.channel_id)
      }

      setActiveStage(proj.current_stage || 1)
      setStatusMsg(null)
    } catch (e: any) {
      setCurrentProject(null)
      setStatusMsg({ type: 'err', text: e.message || 'Không thể tải dự án' })
    } finally {
      setLoading(false)
    }
  }

  const createNewProject = async (customTitle?: string) => {
    try {
      setLoading(true)
      const effectiveCid = selectedChannelId !== 'all' ? selectedChannelId : (channels[0]?.id || 'channel_k1')
      const ch = channels.find(c => c.id === effectiveCid)
      const prefix = ch?.title_prefix ? `${ch.title_prefix} ` : ''
      const newProj = await fetchAPI<StoryProject>('/api/story-studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: effectiveCid,
          title: customTitle || `${prefix}Dự án Story ${new Date().toLocaleDateString('vi-VN')}`,
          keyword: topic || '',
          hero_lock: heroLock || undefined,
          prompt_style: promptStyle || (ch?.niche === 'ancient_humans' ? 'ancient_humans' : 'brain_psychology'),
          background_mode: backgroundMode || 'dynamic',
          topic_requirements: topicRequirements || '',
        }),
      })
      await loadProjects(effectiveCid)
      setCurrentProject(newProj)
      const pCfg = newProj.prompt_config || {}
      const cPrompts = ch?.prompt_templates || {}
      setProjectScenePrefix(pCfg.scene_prefix || cPrompts.scene_prefix || '')
      setProjectSceneSuffixNoText(pCfg.scene_suffix_no_text || cPrompts.scene_suffix_no_text || '')
      setProjectSceneSuffixConcept(pCfg.scene_suffix_concept_card || cPrompts.scene_suffix_concept_card || '')
      setProjectSystemPrompt(pCfg.ai_director_system_prompt || cPrompts.ai_director_system_prompt || '')
      setActiveStage(1)
      setStatusMsg({ type: 'ok', text: `Đã tạo dự án mới cho kênh "${ch?.name || effectiveCid}"!` })
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
    const targetId = currentProject?.id || selectedProjectId
    if (!targetId) return
    try {
      setIsDeletingProject(true)
      const targetProj = projects.find(p => p.id === targetId)
      const deletedTitle = targetProj?.title || currentProject?.title || 'dự án'
      await fetchAPI(`/api/story-studio/projects/${targetId}`, {
        method: 'DELETE',
      })
      setShowDeleteModal(false)
      const remaining = projects.filter(p => p.id !== targetId)
      setProjects(remaining)
      setStatusMsg({ type: 'ok', text: `Đã xóa dự án "${deletedTitle}" thành công!` })
      if (remaining.length > 0) {
        await loadProjectDetail(remaining[0].id)
      } else {
        setCurrentProject(null)
        setSelectedProjectId('')
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

  // ── Stage 5: Topic Theme Rules & Background Mode Auto-Save ─────────
  const handleSaveTopicConfig = async (
    customRequirements?: string,
    customBgMode?: 'dynamic' | 'fixed',
    customStyle?: string,
    silent: boolean = false
  ) => {
    if (!currentProject) return
    const targetReqs = customRequirements !== undefined ? customRequirements : topicRequirements
    const targetBg = customBgMode !== undefined ? customBgMode : backgroundMode
    const targetStyle = customStyle !== undefined ? customStyle : promptStyle

    try {
      if (!silent) setTopicSaveStatus('saving')
      const updated = await fetchAPI<StoryProject>(`/api/story-studio/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_requirements: targetReqs,
          background_mode: targetBg,
          prompt_style: targetStyle,
        }),
      })

      setCurrentProject(prev => prev ? {
        ...prev,
        topic_requirements: updated.topic_requirements ?? targetReqs,
        background_mode: updated.background_mode ?? targetBg,
        prompt_style: updated.prompt_style ?? targetStyle,
      } : null)

      // Sync to localStorage
      localStorage.setItem(`fk_topic_reqs_${currentProject.id}`, targetReqs)
      localStorage.setItem(`fk_bg_mode_${currentProject.id}`, targetBg)
      localStorage.setItem(`fk_prompt_style_${currentProject.id}`, targetStyle)

      if (!silent) {
        setTopicSaveStatus('saved')
        setTimeout(() => {
          setTopicSaveStatus(prev => prev === 'saved' ? 'idle' : prev)
        }, 3000)
      }
    } catch (e: any) {
      console.error('Failed to save topic config:', e)
      if (!silent) {
        setTopicSaveStatus('error')
        setStatusMsg({ type: 'err', text: e.message || 'Lỗi lưu cấu hình chủ đề' })
      }
    }
  }

  const handleTopicRequirementsChange = (val: string) => {
    setTopicRequirements(val)
    if (currentProject) {
      localStorage.setItem(`fk_topic_reqs_${currentProject.id}`, val)
    }
    setTopicSaveStatus('idle')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleSaveTopicConfig(val, undefined, undefined, false)
    }, 1200)
  }

  const handleTopicRequirementsBlur = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    handleSaveTopicConfig(topicRequirements, undefined, undefined, false)
  }

  const handleApplyPreset = (styleId: string) => {
    const p = PROMPT_STYLES.find(s => s.id === styleId)
    if (!p) return
    const newReqs = p.default_topic_requirements || ''
    setTopicRequirements(newReqs)
    setPromptStyle(styleId)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    handleSaveTopicConfig(newReqs, undefined, styleId, false)
    setStatusMsg({
      type: 'ok',
      text: `Đã nạp & lưu mẫu quy tắc chủ đề "${p.name}"!`,
    })
  }

  const handleClearTopicRules = () => {
    setTopicRequirements('')
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    handleSaveTopicConfig('', undefined, undefined, false)
    setStatusMsg({
      type: 'ok',
      text: 'Đã xóa trống & lưu cấu hình quy tắc chủ đề!',
    })
  }

  const handleSelectBackgroundMode = (mode: 'dynamic' | 'fixed') => {
    setBackgroundMode(mode)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    handleSaveTopicConfig(undefined, mode, undefined, false)
  }

  const handleSelectChainingMode = (enabled: boolean) => {
    setChainingMode(enabled)
    localStorage.setItem('fk_story_chaining_mode', String(enabled))
    if (currentProject) {
      localStorage.setItem(`fk_chaining_mode_${currentProject.id}`, String(enabled))
      fetchAPI(`/api/story-studio/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chaining_mode: enabled }),
      }).catch(err => console.error('Failed to save chaining_mode:', err))
    }
    setStatusMsg({
      type: 'ok',
      text: enabled
        ? '🔗 Đã bật chế độ "Mạch phim liên kết AI" (kế thừa góc máy & liên kết nhịp thị giác)!'
        : '⚡ Đã chuyển về chế độ "Độc lập (Hiện tại)" (mỗi cảnh sinh ảnh độc lập theo prompt riêng)!',
    })
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
        body: JSON.stringify({
          hero_lock: heroLock,
          style: activeStyle,
          background_mode: backgroundMode,
          topic_requirements: topicRequirements,
          chaining_mode: chainingMode,
          custom_prefix: projectScenePrefix.trim() || undefined,
          custom_suffix_no_text: projectSceneSuffixNoText.trim() || undefined,
          custom_suffix_concept: projectSceneSuffixConcept.trim() || undefined,
          custom_system_prompt: projectSystemPrompt.trim() || undefined,
        }),
      })
      setCurrentProject(prev => prev ? {
        ...prev,
        scenes: res.scenes,
        prompt_style: activeStyle,
        background_mode: backgroundMode,
        topic_requirements: topicRequirements,
        chaining_mode: chainingMode,
        prompt_config: {
          scene_prefix: projectScenePrefix,
          scene_suffix_no_text: projectSceneSuffixNoText,
          scene_suffix_concept_card: projectSceneSuffixConcept,
          ai_director_system_prompt: projectSystemPrompt,
        },
      } : null)
      setPromptStyle(activeStyle)
      const matched = PROMPT_STYLES.find(s => s.id === activeStyle)
      setStatusMsg({
        type: 'ok',
        text: `Đã tái tạo prompt Doodle chuẩn phong cách "${matched?.name || activeStyle}" (${backgroundMode === 'dynamic' ? 'Bối cảnh động AI' : 'Nền kem studio'}) cho tất cả ${res.scenes?.length || 0} cảnh!`
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
    const modeLabel = chainingMode ? '🔗 Mạch phim liên kết AI' : (backgroundMode === 'dynamic' ? 'Bối cảnh động' : 'Nền kem studio')
    setStatusMsg({
      type: 'ok',
      text: sceneId !== undefined
        ? `Đang dùng AI (${aiModel}) sinh prompt cho cảnh #${sceneId} [${modeLabel}]...`
        : `Đang gửi toàn bộ transcript (${totalScenes} câu) vào AI (${aiModel}) để sinh prompt [${modeLabel}] (vui lòng chờ)...`,
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
          background_mode: backgroundMode,
          topic_requirements: topicRequirements,
          script_text: currentProject.script_text || scriptText || '',
          chaining_mode: chainingMode,
          custom_prefix: projectScenePrefix.trim() || undefined,
          custom_suffix: projectSceneSuffixNoText.trim() || undefined,
          custom_system_prompt: projectSystemPrompt.trim() || undefined,
        }),
      })

      setCurrentProject(prev => prev ? {
        ...prev,
        scenes: res.scenes,
        prompt_style: activeStyle,
        background_mode: backgroundMode,
        topic_requirements: topicRequirements,
        chaining_mode: chainingMode,
        prompt_config: {
          scene_prefix: projectScenePrefix,
          scene_suffix_no_text: projectSceneSuffixNoText,
          scene_suffix_concept_card: projectSceneSuffixConcept,
          ai_director_system_prompt: projectSystemPrompt,
        },
      } : null)
      setPromptStyle(activeStyle)
      setStatusMsg({
        type: 'ok',
        text: sceneId !== undefined
          ? `✨ Đã sinh xong prompt AI cho cảnh #${sceneId} [${modeLabel}]!`
          : chainingMode
            ? `✨ Đã nhận mạch phim liên kết từ AI cho tất cả ${res.scenes?.length || 0} cảnh (đã phân nhóm nhịp thị giác & liên kết cảnh)!`
            : `✨ Đã nhận đầy đủ prompt từ AI trong 1 lượt gửi và cập nhật đồng bộ cho tất cả ${res.scenes?.length || 0} timeline (${backgroundMode === 'dynamic' ? 'Bối cảnh động theo kịch bản' : 'Nền kem studio'})!`,
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
    const targetScene = currentProject.scenes?.find(s => s.id === sceneId)
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
          transition_type: targetScene?.transition_type,
          source_scene_id: targetScene?.source_scene_id,
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
            media_id: res.media_id || s.media_id,
            status: 'completed',
            error: undefined,
          } : s)
        }
      })
      setStatusMsg({
        type: 'ok',
        text: res.hold_frame
          ? `Cảnh ${sceneId} đã kế thừa và giữ nguyên ảnh từ cảnh #${targetScene?.source_scene_id} (~0s)!`
          : `Cảnh ${sceneId} đã tạo ảnh xong!`
      })
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

  const handleUpdateScenePrompt = async (sceneId: number, newPrompt: string) => {
    if (!currentProject) return
    setCurrentProject(prev => {
      if (!prev || !prev.scenes) return prev
      return {
        ...prev,
        scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, prompt: newPrompt } : s),
      }
    })

    try {
      await fetchAPI(`/api/story-studio/projects/${currentProject.id}/scenes/${sceneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: newPrompt }),
      })
    } catch (e: any) {
      console.error(`Failed to update prompt for scene #${sceneId}:`, e)
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

      let sceneSuccess = false
      let retryCount = 0
      const maxRetries = 2

      while (!sceneSuccess && retryCount <= maxRetries && !batchCancelRef.current) {
        try {
          await handleGenerateSingleScene(sc.id, sc.prompt, batchTimeout)
          sceneSuccess = true
        } catch (err: any) {
          const errMsg = String(err?.message || '')
          const lowerErr = errMsg.toLowerCase()

          const isConnDead = (
            lowerErr.includes('disconnect') ||
            lowerErr.includes('no_flow_tab') ||
            lowerErr.includes('not_connected')
          )

          // Hard quota exhaustion (e.g. out of monthly credits, paygate)
          const isHardQuota = (
            (lowerErr.includes('[quota_limit]') || lowerErr.includes('insufficient_credits') || lowerErr.includes('paygate') || lowerErr.includes('hết lượt')) &&
            !lowerErr.includes('cooldown') &&
            !lowerErr.includes('rate_limit') &&
            !lowerErr.includes('unusual')
          )

          // Rate limit / anti-flood cooldown (e.g. PUBLIC_ERROR_UNUSUAL_ACTIVITY, 429)
          const isRateLimit = (
            lowerErr.includes('rate_limit') ||
            lowerErr.includes('cooldown') ||
            lowerErr.includes('unusual') ||
            lowerErr.includes('429') ||
            lowerErr.includes('too many')
          )

          if (isConnDead) {
            batchCancelRef.current = true
            activeAbortControllersRef.current.forEach(controller => {
              try { controller.abort() } catch {}
            })
            activeAbortControllersRef.current.clear()

            setBatchGenProgress({ current: i + 1, total })
            setStatusMsg({
              type: 'err',
              text: `⚠️ ĐÃ DỪNG TOÀN BỘ TIẾN TRÌNH: Mất kết nối tới tab Google Flow ở cảnh #${sc.id}. Vui lòng mở lại tab Flow trên Chrome.`
            })
            break
          }

          if (isHardQuota) {
            batchCancelRef.current = true
            activeAbortControllersRef.current.forEach(controller => {
              try { controller.abort() } catch {}
            })
            activeAbortControllersRef.current.clear()

            setBatchGenProgress({ current: i + 1, total })
            setStatusMsg({
              type: 'err',
              text: `⚠️ ĐÃ DỪNG TIẾN TRÌNH: Tài khoản Google Flow đã thực sự hết Quota ở cảnh #${sc.id}. Hãy chuyển sang tài khoản Google khác trên Chrome và bấm 'Đồng bộ Tham Chiếu sang Acc mới' để tiếp tục.`
            })
            break
          }

          if (isRateLimit && retryCount < maxRetries && !batchCancelRef.current) {
            retryCount++
            const cooldownSec = 35
            // Clear backend hijack lock
            try {
              await fetchAPI('/api/flow/clear-hijack', { method: 'POST' })
            } catch {}

            for (let c = cooldownSec; c > 0; c--) {
              if (batchCancelRef.current) break
              setBatchGenProgress({
                current: i,
                total,
                message: `⏳ Cảnh #${sc.id}: Google Flow tạm nghỉ chống flood (Rate Limit). Tự động thử lại sau ${c}s (lần ${retryCount}/${maxRetries})...`
              })
              await new Promise(r => setTimeout(r, 1000))
            }
            if (!batchCancelRef.current) {
              setBatchGenProgress({
                current: i,
                total,
                message: `🔄 Đang thử lại tạo ảnh cảnh #${sc.id} (lần ${retryCount}/${maxRetries})...`
              })
              continue
            }
          }

          // If reached here: either not rate limit, or retries exhausted, or user cancelled
          if (!batchCancelRef.current) {
            setStatusMsg({
              type: 'err',
              text: `Cảnh #${sc.id} tạm thời không tạo được ảnh (${errMsg.slice(0, 100)}). Hệ thống sẽ bỏ qua để tiếp tục các cảnh còn lại.`
            })
          }
          break
        }
      }

      if (batchCancelRef.current) {
        break
      }

      setBatchGenProgress({ current: i + 1, total })

      // Periodic anti-flood breathing pause every 15 consecutive scenes
      if (i > 0 && (i + 1) % 15 === 0 && i < scenesToProcess.length - 1 && !batchCancelRef.current) {
        for (let s = 12; s > 0; s--) {
          if (batchCancelRef.current) break
          setBatchGenProgress({
            current: i + 1,
            total,
            message: `☕ Đã tạo liên tiếp ${i + 1} cảnh! Tạm nghỉ ${s}s để giữ an toàn cho tài khoản và chống chặn flood...`
          })
          await new Promise(r => setTimeout(r, 1000))
        }
      }

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

  const [isClearingImages, setIsClearingImages] = useState<boolean>(false)

  const handleClearAllImages = async () => {
    if (!currentProject) return
    const completedScenes = (currentProject.scenes || []).filter(s => s.status === 'completed' || s.image_url)
    if (completedScenes.length === 0) {
      setStatusMsg({ type: 'err', text: 'Dự án chưa có ảnh nào để xóa.' })
      return
    }

    if (!confirm(`⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA HẾT TOÀN BỘ ${completedScenes.length} ẢNH ĐÃ TẠO?\n\nToàn bộ file ảnh đã lưu trên máy sẽ bị xóa sạch và tất cả phân cảnh được đưa về trạng thái chờ tạo lại (kịch bản và câu prompt vẫn được bảo toàn nguyên vẹn 100%). Thao tác này không thể hoàn tác!`)) {
      return
    }

    setIsClearingImages(true)
    try {
      const res = await fetchAPI<{ project_id: string; deleted_files_count: number; reset_scenes_count: number; scenes: SceneItem[]; message: string }>(
        `/api/story-studio/projects/${currentProject.id}/clear-images`,
        { method: 'POST' }
      )
      setCurrentProject(prev => {
        if (!prev) return prev
        return {
          ...prev,
          scenes: res.scenes,
        }
      })
      setStatusMsg({ type: 'ok', text: res.message || `Đã xóa sạch toàn bộ ${res.deleted_files_count} ảnh!` })
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi khi xóa toàn bộ ảnh: ${err.message}` })
    } finally {
      setIsClearingImages(false)
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
        body: JSON.stringify({
          burn_subtitles: burnSubtitles,
          ken_burns: kenBurns,
        }),
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

  // ── Stage 6.5: Viral YouTube SEO & Thumbnail Handlers ───────────────
  const handleGenerateYoutubeMetadata = async (lang: string = 'en') => {
    if (!currentProject) return
    setIsGeneratingYoutubeMeta(true)
    setStatusMsg({ type: 'ok', text: 'Đang dùng AI tạo bộ Metadata YouTube Viral tiếng Anh chuẩn SEO...' })
    try {
      const res = await fetchAPI<YoutubeMetadata>(`/api/story-studio/projects/${currentProject.id}/youtube-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang || 'en',
          base_url: aiBaseUrl.trim(),
          api_key: aiApiKey.trim(),
          model: aiModel.trim(),
        }),
      })
      setCurrentProject(prev => prev ? { ...prev, youtube_metadata: res } : null)
      setStatusMsg({ type: 'ok', text: '✨ Đã tạo xong bộ Metadata YouTube Viral tiếng Anh chuẩn SEO!' })
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi tạo metadata YouTube: ${err.message}` })
    } finally {
      setIsGeneratingYoutubeMeta(false)
    }
  }

  const handleGenerateThumbnail = async (promptToUse: string, variantIndex?: number, hookText?: string) => {
    if (!currentProject) return
    if (!promptToUse.trim()) {
      setStatusMsg({ type: 'err', text: 'Prompt thumbnail không được để trống.' })
      return
    }
    const slogan = (hookText || '').trim()
    setIsGeneratingThumbnail(true)
    if (variantIndex !== undefined) setGeneratingThumbVariant(variantIndex)
    setStatusMsg({ type: 'ok', text: 'Đang gửi Google Flow tạo Thumbnail 16:9 (AI trực tiếp vẽ slogan hấp dẫn vào ảnh)...' })
    try {
      const res = await fetchAPI<{
        thumbnail_url: string
        status: string
        thumbnail_watermark_removed?: boolean
        hook_text?: string
      }>(`/api/story-studio/projects/${currentProject.id}/generate-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToUse,
          image_model: imageModel,
          flow_project_id: flowProjectId.trim() || currentProject.flow_project_id,
          timeout_seconds: 75,
          hook_text: slogan,
          burn_text: false,
        }),
      })
      setCurrentProject(prev => prev ? {
        ...prev,
        thumbnail_url: res.thumbnail_url,
        thumbnail_watermark_removed: res.thumbnail_watermark_removed ?? true,
        thumbnail_hook_text: res.hook_text || slogan,
      } : null)
      setStatusMsg({ type: 'ok', text: '🎨 Tạo Thumbnail YouTube hoàn tất! AI đã vẽ slogan hấp dẫn trực tiếp trong ảnh.' })
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi tạo Thumbnail: ${err.message}` })
    } finally {
      setIsGeneratingThumbnail(false)
      setGeneratingThumbVariant(null)
    }
  }

  const handleRemoveThumbnailWatermark = async () => {
    if (!currentProject) return
    setIsRemovingThumbWatermark(true)
    setStatusMsg({ type: 'ok', text: 'Đang xóa watermark logo Gemini trên ảnh Thumbnail...' })
    try {
      const res = await fetchAPI<{ status: string; thumbnail_url: string; thumbnail_watermark_removed: boolean }>(
        `/api/story-studio/projects/${currentProject.id}/remove-thumbnail-watermark`,
        { method: 'POST' }
      )
      if (res?.thumbnail_url) {
        setCurrentProject(prev => prev ? {
          ...prev,
          thumbnail_url: res.thumbnail_url,
          thumbnail_watermark_removed: true,
        } : null)
        setStatusMsg({ type: 'ok', text: '✓ Đã xóa watermark logo Gemini trên Thumbnail thành công!' })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi khi xóa watermark thumbnail: ${err.message || err}` })
    } finally {
      setIsRemovingThumbWatermark(false)
    }
  }

  const handleCopyText = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 2500)
  }

  // ── AI Auto Shorts Handlers ─────────────────────────────────────────
  const handleAnalyzeShorts = async () => {
    if (!currentProject) return
    setIsAnalyzingShorts(true)
    setStatusMsg({ type: 'ok', text: '⚡ AI đang quét kịch bản và tìm các đoạn Short cao trào...' })
    try {
      const res = await fetchAPI<{ candidates: ShortItem[] }>(
        `/api/story-studio/projects/${currentProject.id}/shorts/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base_url: aiBaseUrl,
            api_key: aiApiKey,
            model: aiModel,
            custom_instructions: customShortsInstruction,
          }),
        }
      )
      if (res?.candidates) {
        setCurrentProject(prev => prev ? {
          ...prev,
          shorts_candidates: res.candidates,
        } : null)
        setStatusMsg({ type: 'ok', text: `✨ AI đã tìm thấy ${res.candidates.length} đoạn Short tiềm năng có điểm viral cao!` })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi phân tích Shorts: ${err.message || err}` })
    } finally {
      setIsAnalyzingShorts(false)
    }
  }

  const handleRenderShort = async (shortId: string) => {
    if (!currentProject) return
    setRenderingShortId(shortId)
    setStatusMsg({ type: 'ok', text: `Đang render Short #${shortId} (Giọng đọc sạch, 9:16)...` })
    try {
      const res = await fetchAPI<ShortItem>(
        `/api/story-studio/projects/${currentProject.id}/shorts/render`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            short_id: shortId,
            layout_mode: shortsLayoutMode,
            burn_subtitles: false,
            sfx_mode: shortsSfxMode,
          }),
        }
      )
      if (res) {
        setCurrentProject(prev => {
          if (!prev) return prev
          const updatedShorts = (prev.shorts || []).filter(s => s.id !== shortId)
          updatedShorts.push(res)
          const updatedCandidates = (prev.shorts_candidates || []).map(c => 
            c.id === shortId ? { ...c, status: 'completed' as const } : c
          )
          return {
            ...prev,
            shorts: updatedShorts,
            shorts_candidates: updatedCandidates,
          }
        })
        setStatusMsg({ type: 'ok', text: `✓ Đã render Short #${shortId} thành công! Bạn có thể xem và tải về ngay.` })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi render Short #${shortId}: ${err.message || err}` })
    } finally {
      setRenderingShortId(null)
    }
  }

  const handleBatchRenderShorts = async () => {
    if (!currentProject) return
    setIsBatchRenderingShorts(true)
    setStatusMsg({ type: 'ok', text: 'Đang tiến hành render toàn bộ các video Shorts...' })
    try {
      const res = await fetchAPI<{ shorts: ShortItem[] }>(
        `/api/story-studio/projects/${currentProject.id}/shorts/batch-render`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            layout_mode: shortsLayoutMode,
            burn_subtitles: false,
            sfx_mode: shortsSfxMode,
          }),
        }
      )
      if (res?.shorts) {
        setCurrentProject(prev => {
          if (!prev) return prev
          return {
            ...prev,
            shorts: res.shorts,
          }
        })
        setStatusMsg({ type: 'ok', text: `✓ Đã render hoàn tất ${res.shorts.length} video Shorts!` })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi batch render Shorts: ${err.message || err}` })
    } finally {
      setIsBatchRenderingShorts(false)
    }
  }

  const handleDeleteShort = async (shortId: string) => {
    if (!currentProject) return
    try {
      await fetchAPI(`/api/story-studio/projects/${currentProject.id}/shorts/${shortId}`, {
        method: 'DELETE',
      })
      setCurrentProject(prev => {
        if (!prev) return prev
        return {
          ...prev,
          shorts: (prev.shorts || []).filter(s => s.id !== shortId),
          shorts_candidates: (prev.shorts_candidates || []).map(c => 
            c.id === shortId ? { ...c, status: 'ready' as const } : c
          ),
        }
      })
      setStatusMsg({ type: 'ok', text: `Đã xóa Short #${shortId}.` })
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: `Lỗi khi xóa Short: ${err.message || err}` })
    }
  }

  // Steps Definition
  const STAGES = [
    { num: 1, title: 'Nhân Vật Tham Chiếu', icon: User, desc: 'Hero Lock cố định' },
    { num: 2, title: 'Kịch Bản ', icon: FileText, desc: 'DNA 2nd-person' },
    { num: 3, title: 'Thu Âm Minimax', icon: Mic, desc: 'T2A v2 Audio' },
    { num: 4, title: 'Bóc Tách Transcript', icon: Clock, desc: 'Khớp mốc thời gian' },
    { num: 5, title: 'Tạo Ảnh Doodle', icon: ImageIcon, desc: 'Khớp nhân vật gốc' },
    { num: 6, title: 'Ghép Video & YouTube', icon: Video, desc: 'Render MP4 & Viral Kit' },
  ]

  const modalChannel: ChannelItem = (channelEditForm?.id ? channelEditForm : (activeChannelDetail || DEFAULT_CHANNELS[0]))

  return (
    <div className="flex flex-col min-h-screen p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* ── Top Bar: Channel Tabs & Isolated Workspace ────────────────── */}
      <div className="flex flex-col gap-4 pb-4 border-b border-slate-800">
        {/* Row 1: Brand & Channel Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-600/30 rounded-xl border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Doodle Story Studio
                </h1>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] bg-amber-500/10 font-mono">
                  Quản Lý Theo Kênh
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Quản lý kịch bản độc lập theo Kênh YouTube • Profile DrissionPage & Khóa nhân vật riêng biệt
              </p>
            </div>
          </div>

          {/* Primary Channel Tabs Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl shadow-inner">
              {channels.map(ch => {
                const isSelected = selectedChannelId === ch.id
                const isK1 = ch.id === 'channel_k1'
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSwitchChannel(ch.id)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? isK1
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-600/60 shadow-md shadow-rose-950/50'
                          : 'bg-orange-950/80 text-orange-300 border border-orange-600/60 shadow-md shadow-orange-950/50'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <Tv className={`w-3.5 h-3.5 ${isSelected ? (isK1 ? 'text-rose-400' : 'text-orange-400') : 'text-slate-500'}`} />
                    <span>{ch.name.split('—')[0].trim()}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? isK1 ? 'bg-rose-500/20 text-rose-200' : 'bg-orange-500/20 text-orange-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {ch.video_count ?? 0} tập
                    </span>
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setShowCreateChannelModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
                title="Tạo thêm kênh YouTube mới"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Thêm Kênh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Active Channel Header Card with Big Settings & Browser Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-slate-900/80 border border-slate-800/90 rounded-xl">
          <div className="flex items-center gap-3.5 min-w-0">
            {activeChannelDetail?.character_image_url ? (
              <img
                src={activeChannelDetail.character_image_url}
                alt="Master Character"
                className="w-12 h-12 object-contain rounded-lg border border-amber-500/40 bg-slate-950 shadow-md shrink-0 cursor-pointer"
                onClick={() => handleOpenChannelSettings(selectedChannelId)}
                title="Bấm để xem/sửa ảnh nhân vật đại diện kênh"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer hover:border-slate-700"
                onClick={() => handleOpenChannelSettings(selectedChannelId)}
                title="Bấm để upload ảnh nhân vật đại diện"
              >
                <Tv className="w-6 h-6 opacity-40" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-100 truncate">
                  {activeChannelDetail?.name || 'Đang tải thông tin kênh...'}
                </span>
                {activeChannelDetail?.handle && (
                  <span className="text-[11px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {activeChannelDetail.handle}
                  </span>
                )}
                {activeChannelDetail?.title_prefix && (
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300 font-mono">
                    Tiền tố: {activeChannelDetail.title_prefix}
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
                <span>Chủ đề: <strong className="text-slate-300">{activeChannelDetail?.niche === 'ancient_humans' ? '🌿 Con Người Cổ Đại & Sinh Tồn' : activeChannelDetail?.niche === 'forgotten_civilizations' ? '🏛️ Nền Văn Minh Bị Bỏ Quên' : '🧠 Tâm Lý Học Não Bộ'}</strong></span>
                <span>•</span>
                <span>Kho kịch bản: <strong className="text-amber-300 font-semibold">{projects.length} tập video</strong></span>
                <span>•</span>
                <span className="text-[10px] text-slate-500 font-mono">Profile: output/story_studio/browser_profiles/{activeChannelDetail?.id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {/* DrissionPage Browser Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenChannelBrowser(selectedChannelId)}
              disabled={isOpeningBrowser}
              className={`h-8 px-3 text-xs gap-1.5 font-medium transition-colors shadow-sm ${
                browserIsOpen
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/70'
                  : 'bg-slate-950 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800'
              }`}
              title={`Mở Chrome với User Data Profile độc lập cho ${activeChannelDetail?.name} (DrissionPage anti-detect, Port ${browserPort})`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${browserIsOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isOpeningBrowser ? 'Đang mở Chrome...' : browserIsOpen ? `Profile Kênh (Port ${browserPort})` : '🌐 Mở Profile Kênh'}</span>
            </Button>

            {/* Cài Đặt Kênh Button */}
            <Button
              size="sm"
              onClick={() => handleOpenChannelSettings(selectedChannelId)}
              className="h-8 px-3.5 bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 font-bold shadow-md shadow-amber-600/25 transition-all"
              title="Mở bảng cài đặt thông tin kênh, ảnh nhân vật đại diện, mẫu prompt prefix/suffix, giọng đọc"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>⚙️ Cài Đặt Kênh</span>
            </Button>
          </div>
        </div>

        {/* Row 3: Video List in this Channel */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-amber-400" /> Danh sách tập ({activeChannelDetail?.name.split('—')[0].trim()}):
            </span>
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
                  placeholder="Nhập tên tập..."
                  className="bg-transparent text-xs text-slate-100 focus:outline-none w-48 sm:w-72 font-medium"
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
              projects.length > 0 ? (
                <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1">
                  <select
                    value={currentProject?.id || selectedProjectId || (projects[0]?.id ?? '')}
                    onChange={e => loadProjectDetail(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-500 max-w-[220px] sm:max-w-[400px] truncate font-semibold text-slate-100"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>

                  {currentProject && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleStartEditTitle}
                      title="Sửa tên tập này"
                      className="h-7 px-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 text-xs gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Sửa tên</span>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDeleteModal(true)}
                    title="Xóa tập này"
                    className="h-7 px-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 text-xs gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Xóa</span>
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-slate-500 italic">Chưa có tập video nào trong kênh này</span>
              )
            )}
          </div>

          <Button
            size="sm"
            onClick={() => createNewProject()}
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 shrink-0 font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Tạo Tập Mới Trong {activeChannelDetail ? activeChannelDetail.name.split('—')[0].trim() : 'Kênh Này'}
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
                <p className="text-xs text-slate-400 mb-3">
                  Chọn 1 hình nhân vật mẫu 2D doodle chuẩn. Tất cả các phân cảnh sinh sau này sẽ dùng ảnh này làm tham chiếu hình ảnh để nhân vật không bị biến đổi!
                </p>

                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg mb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-400" />
                    <span>Nhân vật của kênh: <strong className="text-amber-300">{activeChannelDetail?.name || 'Kênh hiện tại'}</strong></span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenChannelSettings(selectedChannelId)}
                    className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 gap-1 font-semibold"
                  >
                    <Settings className="w-3 h-3" /> Cài Đặt Kênh
                  </Button>
                </div>

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

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearAllImages}
                      disabled={isBatchGenerating || isClearingImages || completedCount === 0}
                      className="text-xs border-rose-800/80 text-rose-300 hover:bg-rose-950/60 hover:text-rose-200 gap-1.5 font-medium shadow-sm"
                      title="Xóa vĩnh viễn toàn bộ file ảnh đã tạo và đưa tất cả cảnh về trạng thái chờ tạo mới (giữ nguyên câu prompt và timeline)"
                    >
                      <Trash2 className={`w-3.5 h-3.5 ${isClearingImages ? 'animate-spin text-rose-400' : 'text-rose-400'}`} />
                      {isClearingImages ? `Đang xóa ảnh...` : `Xóa Hết Ảnh (${completedCount})`}
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
                        onClick={() => handleBuildPrompts(promptStyle)}
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

                  {/* Background Mode Selector */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800/90 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        Chế độ bối cảnh nền (Background Mode):
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {backgroundMode === 'dynamic'
                          ? '✨ Bối cảnh thay đổi linh hoạt theo nội dung kịch bản và từng câu cụ thể (phòng ngủ đêm, thảo nguyên, dòng sông, văn phòng, ngã ba đường...).'
                          : '🔒 Tất cả ảnh đều dùng chung 1 màu nền kem tối giản + vệt đất xám (phong cách MinutePhysics/Kurzgesagt tối giản).'}
                      </p>
                    </div>

                    <div className="inline-flex rounded-lg p-0.5 bg-slate-950 border border-slate-700 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => handleSelectBackgroundMode('dynamic')}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                          backgroundMode === 'dynamic'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Bối cảnh sinh tự động theo nội dung kịch bản và từng câu cụ thể theo AI"
                      >
                        <Sparkles className="w-3 h-3 text-purple-200" />
                        2. Bối cảnh theo AI & Kịch bản (Khuyên dùng)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectBackgroundMode('fixed')}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                          backgroundMode === 'fixed'
                            ? 'bg-amber-600 text-white font-semibold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Fix cứng nền kem tối giản + vệt đất xám như hiện tại cho tất cả ảnh"
                      >
                        <Lock className="w-3 h-3 text-amber-200" />
                        1. Fix cứng bối cảnh (Nền kem Studio)
                      </button>
                    </div>
                  </div>

                  {/* Scene Continuity & Chaining Mode Selector */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800/90 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 max-w-xl">
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-indigo-400" />
                        Chế độ liên kết cảnh & mạch phim (Scene Continuity):
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {chainingMode
                          ? '🔗 AI tự động nhóm các cảnh vào "Visual Beat". Cảnh liên quan giữ nguyên góc máy & background của cảnh trước và chỉ thêm/sửa chi tiết mới (hoặc giữ nguyên ảnh ~0s), giúp mạch phim gắn kết mượt mà.'
                          : '⚡ Mỗi cảnh sinh ảnh độc lập theo prompt riêng (giữ nguyên 100% logic cũ, không chỉnh sửa gì).'}
                      </p>
                    </div>

                    <div className="inline-flex rounded-lg p-0.5 bg-slate-950 border border-slate-700 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => handleSelectChainingMode(false)}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                          !chainingMode
                            ? 'bg-amber-600 text-white font-semibold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Giữ nguyên cách sinh ảnh độc lập hiện tại (100% logic cũ)"
                      >
                        <Zap className="w-3 h-3 text-amber-200" />
                        1. Độc lập (Hiện tại)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectChainingMode(true)}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                          chainingMode
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="AI tự phân tích mạch phim, liên kết bối cảnh và kế thừa góc máy giữa các cảnh"
                      >
                        <Link2 className="w-3 h-3 text-indigo-200" />
                        2. Mạch phim liên kết AI (Mới)
                      </button>
                    </div>
                  </div>

                  {/* Per-Project Prompt Templates (Inherited directly from Channel, editable for this video) */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800/90 rounded-lg space-y-3">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowPromptOverrides(!showPromptOverrides)}>
                      <div className="flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-slate-200">
                          ⚙️ Mẫu Prompt, Tiền Tố & Hậu Tố Của Tập Này (Kế thừa từ: {activeChannelDetail?.name || 'Kênh'})
                        </span>
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] bg-amber-500/10">
                          Đang áp dụng cho tập này
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {showPromptOverrides ? 'Thu gọn' : 'Xem & chỉnh sửa mẫu prompt'}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showPromptOverrides ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {showPromptOverrides && (
                      <div className="space-y-3 pt-2 border-t border-slate-800">
                        <p className="text-[11px] text-slate-400">
                          Các giá trị mẫu bên dưới đã được điền sẵn từ cấu hình của <span className="text-amber-300 font-semibold">{activeChannelDetail?.name || 'Kênh'}</span>. Bạn có thể sửa trực tiếp ở đây để áp dụng riêng cho tập video này mà không ảnh hưởng tới Kênh gốc.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                              <span>Tiền tố từng cảnh (Scene Prefix):</span>
                              <span className="text-[10px] text-slate-500">Đầu câu prompt</span>
                            </label>
                            <textarea
                              rows={2}
                              value={projectScenePrefix}
                              onChange={e => setProjectScenePrefix(e.target.value)}
                              placeholder="Nhập tiền tố prompt cho từng cảnh..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                              <span>Hậu tố cảnh thường (Suffix - No Text):</span>
                              <span className="text-[10px] text-slate-500">Cấm chữ, giữ nhân vật</span>
                            </label>
                            <textarea
                              rows={2}
                              value={projectSceneSuffixNoText}
                              onChange={e => setProjectSceneSuffixNoText(e.target.value)}
                              placeholder="Nhập hậu tố cấm chữ, giữ nhân vật..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                              <span>Hậu tố thẻ bài khái niệm (Suffix - Concept Card):</span>
                              <span className="text-[10px] text-slate-500">Thẻ từ khóa / chữ đỏ</span>
                            </label>
                            <textarea
                              rows={2}
                              value={projectSceneSuffixConcept}
                              onChange={e => setProjectSceneSuffixConcept(e.target.value)}
                              placeholder="Nhập hậu tố cho thẻ bài khái niệm..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                              <span>Prompt đạo diễn AI (Visual Director System Prompt):</span>
                              <span className="text-[10px] text-slate-500">Chỉ đạo cho LLM</span>
                            </label>
                            <textarea
                              rows={2}
                              value={projectSystemPrompt}
                              onChange={e => setProjectSystemPrompt(e.target.value)}
                              placeholder="Chỉ đạo phong cách cho AI khi sinh prompt..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleResetPromptConfigToChannel}
                            className="text-xs border-slate-700 text-slate-400 hover:text-white"
                            title="Lấy lại toàn bộ mẫu gốc từ cấu hình của Kênh hiện tại"
                          >
                            <RotateCw className="w-3.5 h-3.5" /> Lấy Lại Mẫu Từ Kênh
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSavePromptConfig}
                            disabled={isSavingPromptConfig}
                            className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1 font-medium"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {isSavingPromptConfig ? 'Đang lưu...' : 'Lưu Mẫu Cho Tập Này'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Topic Mandatory Rules / Theme Requirements Panel */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800/90 rounded-lg space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-slate-200">
                          Yêu cầu & Chi tiết bắt buộc theo chủ đề (Topic Theme Rules):
                        </span>
                        <span className="text-[10px] text-slate-400">
                          (AI bắt buộc phải đưa vào prompt cho từng phân cảnh)
                        </span>
                      </div>

                      {/* Quick preset buttons & Save Controls */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-medium">Nạp nhanh mẫu:</span>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset('ancient_humans')}
                          className={`px-2 py-0.5 rounded text-[10px] bg-orange-950/70 hover:bg-orange-900/90 text-orange-300 border transition-colors font-medium flex items-center gap-1 ${
                            promptStyle === 'ancient_humans' ? 'border-orange-400 ring-1 ring-orange-500/50 shadow-sm font-semibold' : 'border-orange-700/60'
                          }`}
                          title="Nạp chuẩn Ancient Humans từ ancient_humans_master_prompt.txt (savanna, SURVIVAL boulder, campfire, archaeologist, red X...)"
                        >
                          🌿 Con Người Cổ Đại
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset('forgotten_civilizations')}
                          className={`px-2 py-0.5 rounded text-[10px] bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border transition-colors font-medium flex items-center gap-1 ${
                            promptStyle === 'forgotten_civilizations' ? 'border-amber-400 ring-1 ring-amber-500/50 shadow-sm font-semibold' : 'border-amber-700/60'
                          }`}
                          title="Nạp chuẩn Nền Văn Minh Bị Bỏ Quên (thuyền độc mộc, chợ làng, đền phế tích...)"
                        >
                          🏛️ Văn Minh Cổ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset('brain_psychology')}
                          className={`px-2 py-0.5 rounded text-[10px] bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 border transition-colors font-medium flex items-center gap-1 ${
                            promptStyle === 'brain_psychology' ? 'border-rose-400 ring-1 ring-rose-500/50 shadow-sm font-semibold' : 'border-rose-700/60'
                          }`}
                          title="Nạp chuẩn Tâm Lý Học Não Bộ (loa phóng thanh, điện thoại đêm, bức tường gạch, não hồng...)"
                        >
                          🧠 Tâm Lý Học
                        </button>
                        {topicRequirements.trim() && (
                          <button
                            type="button"
                            onClick={handleClearTopicRules}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                            title="Xóa trống để tự nhập quy tắc riêng"
                          >
                            Xóa trống
                          </button>
                        )}

                        {/* Save indicator & explicit save button */}
                        <div className="flex items-center gap-1.5 ml-auto sm:ml-2 sm:pl-2 border-slate-800 sm:border-l">
                          {topicSaveStatus === 'saving' && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium animate-pulse">
                              <RotateCw className="w-3 h-3 animate-spin" /> Đang lưu...
                            </span>
                          )}
                          {topicSaveStatus === 'saved' && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                              <Check className="w-3 h-3" /> Đã lưu
                            </span>
                          )}
                          {topicSaveStatus === 'error' && (
                            <span className="text-[10px] text-rose-400 flex items-center gap-1 font-medium">
                              Lỗi lưu
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveTopicConfig()}
                            disabled={topicSaveStatus === 'saving' || !currentProject}
                            className="h-6 px-2 text-[10px] border-slate-700 hover:bg-slate-800 text-slate-300 font-medium gap-1"
                            title="Lưu cấu hình quy tắc chủ đề và chế độ nền vào dự án"
                          >
                            <Save className="w-3 h-3 text-amber-400" /> Lưu Quy Tắc
                          </Button>
                        </div>
                      </div>
                    </div>

                    <textarea
                      value={topicRequirements}
                      onChange={e => handleTopicRequirementsChange(e.target.value)}
                      onBlur={handleTopicRequirementsBlur}
                      placeholder="Nhập các quy tắc, bối cảnh đặc trưng, đạo cụ và nhân vật bắt buộc theo chủ đề... (Ví dụ chuẩn Cổ Đại: Thảo nguyên savanna cây keo, nhân vật tóc cam nhọn, tảng đá dán nhãn SURVIVAL, lửa trại bộ lạc, nhà khảo cổ nón cối, dấu X đỏ phủ định...)"
                      rows={4}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-lg p-2.5 text-xs text-slate-200 font-mono leading-relaxed placeholder:text-slate-600 focus:outline-none resize-y"
                    />

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span>💡 Các yêu cầu này được lưu tự động vào dự án và đưa trực tiếp vào System Prompt của AI khi tạo prompt cho từng phân cảnh.</span>
                      <span className="font-mono">{topicRequirements.trim().length} ký tự</span>
                    </div>
                  </div>

                  {/* Core Master Rules Badge Strip */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900 text-[11px]">
                    <span className="text-slate-500 font-medium">Khung chuẩn bắt buộc:</span>
                    <span className={`border px-2 py-0.5 rounded font-mono text-[10px] ${
                      backgroundMode === 'dynamic'
                        ? 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                        : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                    }`}>
                      {backgroundMode === 'dynamic' ? '✨ Bối cảnh: Động theo AI & Kịch bản' : '🔒 Bối cảnh: Fix cứng nền kem'}
                    </span>
                    <span className={`border px-2 py-0.5 rounded font-mono text-[10px] ${
                      chainingMode
                        ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}>
                      {chainingMode ? '🔗 Mạch phim: Liên kết AI' : '⚡ Mạch phim: Độc lập'}
                    </span>
                    <span className={`border px-2 py-0.5 rounded font-mono text-[10px] ${
                      topicRequirements.trim()
                        ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}>
                      {topicRequirements.trim()
                        ? `🏷️ Yêu cầu chủ đề: Đã tùy biến (${topicRequirements.trim().length} ký tự)`
                        : '🏷️ Yêu cầu chủ đề: Tự động theo phong cách'}
                    </span>
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

                    <div className="flex items-center gap-1">
                      {sc.transition_type === 'hold_frame' && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-amber-500/40 text-amber-300 bg-amber-950/40 font-mono"
                          title={`Giữ nguyên ảnh từ cảnh #${sc.source_scene_id} (~0s render)`}
                        >
                          ⏸️ Giữ #{sc.source_scene_id}
                        </Badge>
                      )}
                      {sc.transition_type === 'inherit_edit' && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-indigo-500/40 text-indigo-300 bg-indigo-950/40 font-mono"
                          title={`Kế thừa góc máy & background từ cảnh #${sc.source_scene_id}`}
                        >
                          🔗 Kế thừa #{sc.source_scene_id}
                        </Badge>
                      )}
                      {sc.transition_type === 'new_scene' && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-sky-500/40 text-sky-300 bg-sky-950/40 font-mono"
                          title="Bối cảnh mới"
                        >
                          🌟 Cảnh mới
                        </Badge>
                      )}
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

                  {/* Prompt Preview & Edit (Collapsible) */}
                  <details className="text-[10px] text-slate-500 group">
                    <summary className="cursor-pointer hover:text-slate-300 select-none flex items-center justify-between">
                      <span className="flex items-center gap-1 font-medium text-slate-400 group-hover:text-amber-300">
                        <FileText className="w-3 h-3 text-amber-400/80" /> Xem & Sửa Prompt Cảnh
                      </span>
                      <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-1 space-y-1">
                      <textarea
                        value={sc.prompt || ''}
                        onChange={e => {
                          const val = e.target.value
                          setCurrentProject(prev => prev && prev.scenes ? {
                            ...prev,
                            scenes: prev.scenes.map(s => s.id === sc.id ? { ...s, prompt: val } : s)
                          } : prev)
                        }}
                        onBlur={e => handleUpdateScenePrompt(sc.id, e.target.value)}
                        placeholder="Nhập prompt tiếng Anh cho cảnh này..."
                        rows={3}
                        className="w-full bg-slate-950 rounded border border-slate-800 focus:border-amber-500/60 p-1.5 text-slate-300 font-mono text-[9px] leading-tight resize-y focus:outline-none"
                        title="Bạn có thể chỉnh sửa trực tiếp câu prompt này. Khi bấm ra ngoài, hệ thống tự động lưu vào dự án."
                      />
                      <div className="flex items-center justify-between text-[9px] text-slate-500">
                        <span>Tự động lưu khi sửa</span>
                        <span className="font-mono">{(sc.prompt || '').length} ký tự</span>
                      </div>
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
          <div className="space-y-6">
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

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                      <Film className="w-3.5 h-3.5 text-indigo-400" />
                      Lia máy nhẹ (Ken Burns / Slow Zoom):
                    </span>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Zoom nhẹ 3–5% mượt mà, nối tiếp camera cho các cảnh giữ ảnh (Hold Frame).
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={kenBurns}
                    onChange={e => {
                      setKenBurns(e.target.checked)
                      localStorage.setItem('fk_ken_burns', String(e.target.checked))
                    }}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer shrink-0"
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

          {/* ── YOUTUBE VIRAL METADATA & THUMBNAIL KIT ── */}
          <Card className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-6 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-amber-400 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Bộ Xuất Bản YouTube Viral (Viral Kit: Tiêu Đề, Mô Tả & Thumbnail)
                  </span>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px]">
                    Chuẩn SEO Explainer
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 max-w-2xl">
                  Tối ưu thuật toán YouTube và tỉ lệ nhấp (CTR): 5 công thức tiêu đề giật tít, mô tả 3-Zone kèm mốc chương tự động, 4 concept thumbnail độc đáo và bộ thẻ tag hoàn chỉnh.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-300">
                  <span className="text-sm">🇬🇧</span>
                  <span className="font-semibold text-amber-300">English Only</span>
                  <span className="text-[10px] text-slate-500">(Chuẩn YouTube Quốc Tế)</span>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleGenerateYoutubeMetadata('en')}
                  disabled={isGeneratingYoutubeMeta || !currentProject?.script_text}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs gap-1.5 h-8 shadow-md shadow-amber-500/20"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingYoutubeMeta ? 'animate-spin' : ''}`} />
                  {isGeneratingYoutubeMeta ? 'AI Đang Xây Dựng Metadata...' : (currentProject?.youtube_metadata ? '✨ Tạo Lại Metadata Tiếng Anh' : '✨ Tạo Bộ Metadata Bằng AI (English)')}
                </Button>
              </div>
            </div>

            {/* Render Metadata if present */}
            {currentProject?.youtube_metadata && (
              <div className="space-y-6">
                {/* SECTION 1: 5 TIÊU ĐỀ VIRAL */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> 1. Gợi Ý 5 Tiêu Đề Hook Viral (Chọn 1 tiêu đề hay nhất)
                    </span>
                    <span className="text-[11px] text-slate-500">Giới hạn lý tưởng: dưới 65-70 ký tự</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {currentProject.youtube_metadata.titles?.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 rounded-xl flex items-start justify-between gap-3 group transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] bg-slate-900 border-amber-500/30 text-amber-300 font-mono">
                              #{idx + 1} {t.type}
                            </Badge>
                            <span className="text-[10px] text-slate-500 font-mono">{t.title.length} ký tự</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-100 group-hover:text-amber-200 transition-colors leading-snug">
                            {t.title}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyText(t.title, `title_${idx}`)}
                          className="h-7 px-2 text-slate-400 hover:text-amber-300 hover:bg-slate-800 text-[11px] gap-1 shrink-0"
                          title="Sao chép tiêu đề này"
                        >
                          {copiedField === `title_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedField === `title_${idx}` ? 'Đã chép' : 'Copy'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 2: BỘ THUMBNAIL VIRAL & TRÌNH TẠO ẢNH */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" /> 2. Bộ Thumbnail Viral (4 Concept Khác Nhau)
                    </span>
                    <span className="text-[11px] text-slate-500">Tỉ lệ 16:9 • Khóa nhân vật theo Hero Lock</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Thumbnail Preview */}
                    <div className="lg:col-span-5 space-y-3">
                      <div className="aspect-video bg-black rounded-xl border border-slate-800 overflow-hidden relative flex items-center justify-center group shadow-md">
                        {currentProject.thumbnail_url ? (
                          <>
                            <img
                              src={currentProject.thumbnail_url}
                              alt="YouTube Thumbnail"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all gap-2 text-white text-xs">
                              <a
                                href={currentProject.thumbnail_url}
                                download="youtube_thumbnail.png"
                                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-md"
                              >
                                <Download className="w-3.5 h-3.5" /> Tải Thumbnail (PNG)
                              </a>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-6 text-slate-600 space-y-1">
                            <ImageIcon className="w-10 h-10 mx-auto opacity-30 mb-2" />
                            <div className="text-xs font-medium text-slate-400">Chưa có ảnh Thumbnail</div>
                            <div className="text-[10px] text-slate-500">Bấm nút "Tạo Thumbnail Này" ở một trong 4 mẫu bên phải</div>
                          </div>
                        )}
                      </div>

                      {currentProject.thumbnail_url && (
                        <div className="space-y-2.5 pt-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  currentProject.thumbnail_watermark_removed
                                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                                    : 'border-slate-700 text-slate-300 bg-slate-900/50'
                                }`}
                              >
                                {currentProject.thumbnail_watermark_removed ? '✓ Đã Xóa Watermark' : '✓ Thumbnail Sẵn Sàng'}
                              </Badge>
                              {currentProject.thumbnail_hook_text && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-amber-500/40 text-amber-300 bg-amber-950/40 font-mono"
                                >
                                  🔤 Chữ: "{currentProject.thumbnail_hook_text}"
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleRemoveThumbnailWatermark}
                                disabled={isRemovingThumbWatermark}
                                className={`text-[10px] h-7 px-2 gap-1 font-medium transition-colors ${
                                  currentProject.thumbnail_watermark_removed
                                    ? 'border-emerald-600/50 text-emerald-400 hover:bg-emerald-950/40'
                                    : 'border-cyan-700/60 text-cyan-300 hover:bg-cyan-950/40 hover:text-cyan-200'
                                }`}
                                title="Xóa watermark Gemini ở góc dưới bên phải của thumbnail"
                              >
                                <Eraser className={`w-3 h-3 ${isRemovingThumbWatermark ? 'animate-spin' : ''}`} />
                                {isRemovingThumbWatermark ? 'Đang xóa...' : currentProject.thumbnail_watermark_removed ? 'Xóa Lại WM' : 'Xóa Watermark'}
                              </Button>

                              <a
                                href={currentProject.thumbnail_url}
                                download="youtube_thumbnail.png"
                                className="text-[11px] text-amber-300 hover:text-white flex items-center gap-1 font-semibold px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 rounded-lg border border-amber-500/30 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" /> Tải Ảnh
                              </a>
                            </div>
                          </div>

                          {/* AI In-Image Slogan Banner */}
                          <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Slogan AI vẽ trực tiếp trong ảnh:
                            </span>
                            <span className="font-bold text-amber-300 tracking-wide">
                              "{currentProject.thumbnail_hook_text || (currentProject.youtube_metadata?.thumbnail_concepts?.[0]?.slogan || currentProject.youtube_metadata?.thumbnail_concepts?.[0]?.hook_text || 'THE SECRET THEY FORGOT')}"
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: 4 Concepts */}
                    <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentProject.youtube_metadata.thumbnail_concepts?.map((c, cIdx) => (
                        <div
                          key={cIdx}
                          className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-[9px] bg-slate-900 border-indigo-500/40 text-indigo-300 font-mono">
                                Concept #{c.variant || cIdx + 1}: {c.name}
                              </Badge>
                            </div>
                            <div className="p-1.5 bg-amber-950/30 border border-amber-500/20 rounded text-[11px] font-bold text-amber-300">
                              💬 Slogan: "{c.slogan || c.hook_text}"
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-2">
                              {c.visual_description}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleGenerateThumbnail(c.prompt, c.variant || cIdx + 1, c.hook_text)}
                              disabled={isGeneratingThumbnail}
                              className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-[11px] h-7 font-semibold gap-1 shadow-sm"
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingThumbnail && generatingThumbVariant === (c.variant || cIdx + 1) ? 'animate-spin' : ''}`} />
                              {isGeneratingThumbnail && generatingThumbVariant === (c.variant || cIdx + 1) ? 'Đang tạo...' : '🎨 Tạo Thumbnail Này'}
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyText(c.prompt, `thumb_prompt_${cIdx}`)}
                              className="h-7 px-2 text-slate-400 hover:text-slate-200 text-[10px]"
                              title="Sao chép prompt này"
                            >
                              {copiedField === `thumb_prompt_${cIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SECTION 3: MÔ TẢ 3-ZONE (DESCRIPTION) & SECTION 4: TAGS */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2 border-t border-slate-800/80">
                  {/* Description (7 cols) */}
                  <div className="md:col-span-7 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> 3. Mô Tả Video Chuẩn 3-Zone (Kèm Mốc Chapters)
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyText(currentProject.youtube_metadata?.description || '', 'desc')}
                        className="h-7 px-2.5 text-xs text-amber-400 hover:text-amber-300 hover:bg-slate-800 gap-1 font-semibold"
                      >
                        {copiedField === 'desc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedField === 'desc' ? 'Đã Sao Chép Mô Tả' : 'Sao Chép Mô Tả'}
                      </Button>
                    </div>

                    <textarea
                      readOnly
                      rows={10}
                      value={currentProject.youtube_metadata.description}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
                    />
                  </div>

                  {/* Tags & Hashtags (5 cols) */}
                  <div className="md:col-span-5 space-y-4">
                    {/* Hashtags */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          Hashtags
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyText(currentProject.youtube_metadata?.hashtags?.join(' ') || '', 'hashtags')}
                          className="h-6 px-2 text-[10px] text-slate-400 hover:text-amber-300 gap-1"
                        >
                          {copiedField === 'hashtags' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                        {currentProject.youtube_metadata.hashtags?.map((h, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] bg-slate-900 border-indigo-500/30 text-indigo-300 font-mono">
                            {h}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* SEO Tags */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          4. Thẻ Tags YouTube (Dán vào ô Tags)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyText(currentProject.youtube_metadata?.tags || '', 'tags')}
                          className="h-6 px-2 text-[10px] text-amber-400 hover:text-amber-300 gap-1 font-semibold"
                        >
                          {copiedField === 'tags' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedField === 'tags' ? 'Đã Chép' : 'Sao Chép Tags'}
                        </Button>
                      </div>
                      <textarea
                        readOnly
                        rows={4}
                        value={currentProject.youtube_metadata.tags}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500 leading-normal resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ── AI AUTO SHORTS EXTRACTOR (VOICE-ONLY + WHOOSH & DING SFX) ── */}
          <Card className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-6 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-amber-400 flex items-center gap-2">
                    <Scissors className="w-5 h-5 text-amber-400" />
                    Tách Shorts Tự Động Bằng AI (AI Shorts Studio)
                  </span>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px] flex items-center gap-1 font-semibold">
                    <Smartphone className="w-3 h-3" /> 9:16 Vertical
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px]">
                    Clean Voice-Only
                  </Badge>
                  <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[10px]">
                    Không Phụ Đề
                  </Badge>
                  <Badge variant="outline" className="border-blue-500/40 text-blue-300 bg-blue-500/10 text-[10px]">
                    0% Vi Phạm Bản Quyền
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 max-w-2xl">
                  AI quét kịch bản & timeline để tự động chọn các phân đoạn cao trào (50–60 giây) bám sát trực tiếp chủ đề chính và có retention cao nhất. Video được dựng bố cục dọc 9:16 (Stacked Explainer), âm thanh giọng đọc Minimax trong trẻo 100% (không dính tạp âm chuyển cảnh), tối giản không chèn phụ đề.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Layout Mode Selector */}
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Bố cục 9:16:</span>
                  <select
                    value={shortsLayoutMode}
                    onChange={e => setShortsLayoutMode(e.target.value as any)}
                    className="bg-transparent text-amber-300 font-medium text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="stacked" className="bg-slate-900 text-slate-200">Stacked Explainer (16:9 + Nền Mờ)</option>
                    <option value="full_crop" className="bg-slate-900 text-slate-200">Full 9:16 Crop (Toàn Màn Hình)</option>
                  </select>
                </div>

                {/* Audio SFX Selector */}
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Âm thanh:</span>
                  <select
                    value={shortsSfxMode}
                    onChange={e => setShortsSfxMode(e.target.value as any)}
                    className="bg-transparent text-emerald-400 font-medium text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="none" className="bg-slate-900 text-slate-200">Chỉ giọng đọc sạch 100% (Khuyên dùng)</option>
                    <option value="ding" className="bg-slate-900 text-slate-200">Giọng đọc + Chuông Ding mở đầu</option>
                  </select>
                </div>

                {/* Batch Render Button */}
                {(currentProject?.shorts_candidates?.length || 0) > 0 && (
                  <Button
                    size="sm"
                    onClick={handleBatchRenderShorts}
                    disabled={isBatchRenderingShorts || renderingShortId !== null}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs gap-1.5 h-8 shadow-md"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isBatchRenderingShorts ? 'animate-spin' : ''}`} />
                    {isBatchRenderingShorts ? 'Đang Render Tất Cả...' : 'Render Tất Cả Shorts'}
                  </Button>
                )}

                {/* Analyze Button */}
                <Button
                  size="sm"
                  onClick={handleAnalyzeShorts}
                  disabled={isAnalyzingShorts || !currentProject?.audio_url || !currentProject?.scenes?.length}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs gap-1.5 h-8 shadow-md shadow-amber-500/20"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingShorts ? 'animate-spin' : ''}`} />
                  {isAnalyzingShorts ? 'AI Đang Quét Kịch Bản...' : '⚡ Phân Tích & Gợi Ý Shorts'}
                </Button>
              </div>
            </div>

            {/* Instruction input */}
            <div className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400 shrink-0 font-medium">Lưu ý chỉ đạo AI (Tùy chọn):</span>
              <input
                type="text"
                value={customShortsInstruction}
                onChange={e => setCustomShortsInstruction(e.target.value)}
                placeholder="Ví dụ: Tập trung vào đoạn đối lập ảo tưởng vs sự thật, ưu tiên câu hỏi gây sốc..."
                className="bg-transparent text-xs text-slate-200 focus:outline-none flex-1 placeholder:text-slate-600"
              />
            </div>

            {/* Shorts Candidates & Rendered Clips Grid */}
            {(!currentProject?.shorts_candidates || currentProject.shorts_candidates.length === 0) ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-2">
                <Scissors className="w-10 h-10 mx-auto text-amber-500/40 animate-pulse" />
                <p className="text-xs text-slate-400 font-medium">Chưa có phân đoạn Shorts nào được trích xuất.</p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Bấm nút <strong className="text-amber-400">"⚡ Phân Tích & Gợi Ý Shorts"</strong> ở trên để AI tự động phát hiện 2–4 đoạn cao trào độc lập (50–60s) chuẩn chủ đề và bùng nổ tương tác.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {currentProject.shorts_candidates.map((cand, idx) => {
                  const renderedShort = (currentProject.shorts || []).find(s => s.id === cand.id)
                  const isThisRendering = renderingShortId === cand.id

                  return (
                    <Card key={cand.id || idx} className="p-4 bg-slate-950 border border-slate-800/90 rounded-xl flex flex-col justify-between space-y-3.5 hover:border-amber-500/40 transition-colors">
                      {/* Top Header */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                            <Flame className="w-3 h-3 text-amber-400" /> Điểm Viral: {cand.virality_score}/100
                          </Badge>
                          <Badge variant="outline" className="bg-slate-900 text-slate-400 border-slate-800 text-[10px] font-mono">
                            ⏱️ {cand.duration_s}s
                          </Badge>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-xs font-bold text-slate-100 line-clamp-2 flex-1 leading-snug" title={cand.title}>
                              {cand.title}
                            </h4>
                            <button
                              onClick={() => handleCopyText(cand.title, `title_${cand.id}`)}
                              className="text-slate-400 hover:text-amber-300 p-1 rounded hover:bg-slate-900 shrink-0 transition-colors"
                              title="Sao chép tiêu đề Short"
                            >
                              {copiedField === `title_${cand.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Short Description */}
                        {cand.description && (
                          <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/80 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-amber-400/90 flex items-center gap-1">
                                📝 Mô tả Short
                              </span>
                              <button
                                onClick={() => handleCopyText(cand.description!, `desc_${cand.id}`)}
                                className="text-[10px] text-slate-400 hover:text-amber-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                              >
                                {copiedField === `desc_${cand.id}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400 text-[9px] font-medium">Đã copy</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span className="text-[9px]">Copy mô tả</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-300 line-clamp-3 leading-relaxed">
                              {cand.description}
                            </p>
                          </div>
                        )}

                        {/* Hashtags */}
                        {cand.hashtags && cand.hashtags.length > 0 && (
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex flex-wrap gap-1">
                              {cand.hashtags.slice(0, 4).map((tag, tIdx) => (
                                <span key={tIdx} className="text-[9px] font-mono text-cyan-400/90 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.2 rounded">
                                  {tag.startsWith('#') ? tag : `#${tag}`}
                                </span>
                              ))}
                            </div>
                            <button
                              onClick={() => handleCopyText(cand.hashtags!.join(' '), `tags_${cand.id}`)}
                              className="text-slate-400 hover:text-cyan-300 p-1 rounded hover:bg-slate-900 shrink-0 transition-colors"
                              title="Sao chép toàn bộ hashtag"
                            >
                              {copiedField === `tags_${cand.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Phân cảnh #{cand.start_scene_id} ➔ #{cand.end_scene_id}</span>
                            <span>{cand.start_s.toFixed(1)}s - {cand.end_s.toFixed(1)}s</span>
                          </div>
                          {cand.hook_reason && (
                            <p className="text-[10px] text-slate-400 italic line-clamp-2 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                              💡 {cand.hook_reason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Video Player or Thumbnail Preview */}
                      <div className="aspect-[9/16] w-full max-w-[200px] mx-auto bg-black rounded-xl border border-slate-800 overflow-hidden relative flex items-center justify-center">
                        {renderedShort?.video_url ? (
                          <video
                            key={renderedShort.video_url}
                            controls
                            playsInline
                            src={renderedShort.video_url}
                            className="w-full h-full object-cover"
                          />
                        ) : isThisRendering ? (
                          <div className="text-center p-4 text-amber-400 space-y-2 animate-pulse">
                            <RotateCw className="w-6 h-6 mx-auto animate-spin" />
                            <div className="text-[10px] font-semibold">Đang render 9:16...</div>
                            <div className="text-[9px] text-slate-500">Ghép video & giọng đọc</div>
                          </div>
                        ) : (
                          <div className="text-center p-3 text-slate-600 space-y-1.5">
                            <Smartphone className="w-8 h-8 mx-auto opacity-30" />
                            <div className="text-[10px] text-slate-400">Chưa render video</div>
                            <div className="text-[9px] text-slate-600">Bấm nút bên dưới để tạo MP4</div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        {renderedShort?.video_url ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={renderedShort.video_url}
                                download={`${cand.id}_short.mp4`}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" /> Tải Short MP4
                              </a>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteShort(cand.id)}
                                className="h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRenderShort(cand.id)}
                              disabled={isThisRendering || isBatchRenderingShorts}
                              className="w-full h-6 text-[10px] border-slate-800 text-slate-400 hover:text-white"
                            >
                              <RotateCw className="w-3 h-3 mr-1" /> Render Lại Short
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleRenderShort(cand.id)}
                            disabled={isThisRendering || isBatchRenderingShorts}
                            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium text-xs gap-1.5 h-8 shadow"
                          >
                            <Play className={`w-3.5 h-3.5 ${isThisRendering ? 'animate-spin' : ''}`} />
                            {isThisRendering ? 'Đang Ghép...' : 'Render Short Này (9:16)'}
                          </Button>
                        )}

                        {/* Hashtags display */}
                        {cand.hashtags && cand.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {cand.hashtags.map((h, i) => (
                              <span key={i} className="text-[9px] text-slate-500 font-mono bg-slate-900 px-1 rounded">
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
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
      {showDeleteModal && (currentProject || selectedProjectId) && (
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
                  Hành động này sẽ xóa vĩnh viễn dự án <strong className="text-amber-400">"{projects.find(p => p.id === (currentProject?.id || selectedProjectId))?.title || currentProject?.title || 'dự án'}"</strong> cùng toàn bộ ảnh doodle, kịch bản, file âm thanh và video liên quan.
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

      {/* ── Modal Tạo Kênh Mới ─────────────────────────────────────── */}
      {showCreateChannelModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isCreatingChannel && setShowCreateChannelModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-100">Tạo Kênh YouTube Mới</h3>
                  <p className="text-[11px] text-slate-400">Tạo không gian quản lý kịch bản & profile trình duyệt riêng</p>
                </div>
              </div>
              <button onClick={() => setShowCreateChannelModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Tên Kênh (*):</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  placeholder="Ví dụ: Kênh 3 — Lịch Sử Tiến Hóa"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Tiền Tố Tiêu Đề Video (Tự động gán):</label>
                <input
                  type="text"
                  value={newChannelPrefix}
                  onChange={e => setNewChannelPrefix(e.target.value)}
                  placeholder="Ví dụ: K3 -"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Chủ Đề & Phong Cách (Niche):</label>
                <select
                  value={newChannelNiche}
                  onChange={e => setNewChannelNiche(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="brain_psychology">🧠 Tâm Lý Học & Não Bộ (Brain Psychology)</option>
                  <option value="ancient_humans">🌿 Con Người Cổ Đại & Sinh Tồn (Ancient Humans)</option>
                  <option value="forgotten_civilizations">🏛️ Nền Văn Minh Bị Bỏ Quên (Forgotten Civilizations)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                size="sm"
                variant="ghost"
                disabled={isCreatingChannel}
                onClick={() => setShowCreateChannelModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                disabled={isCreatingChannel || !newChannelName.trim()}
                onClick={handleCreateChannel}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 font-medium"
              >
                {isCreatingChannel ? 'Đang tạo...' : 'Tạo Kênh'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cài Đặt Kênh Toàn Diện ─────────────────────────── */}
      {showChannelSettingsModal && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isSavingChannel && setShowChannelSettingsModal(false)}
        >
            <div
              className="relative max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/30 text-amber-400">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      Cài Đặt Kênh: {modalChannel.name || 'Cài Đặt Kênh'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ID: <code className="text-amber-300 font-mono">{modalChannel.id || selectedChannelId}</code> • {modalChannel.video_count ?? 0} video tập
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChannelSettingsModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800 bg-slate-950/40 overflow-x-auto">
              <button
                onClick={() => setChannelSettingsTab('info')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 ${
                  channelSettingsTab === 'info'
                    ? 'border-amber-500 text-amber-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Thông Tin & DNA
              </button>

              <button
                onClick={() => setChannelSettingsTab('character')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 ${
                  channelSettingsTab === 'character'
                    ? 'border-amber-500 text-amber-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Nhân Vật Đại Diện
              </button>

              <button
                onClick={() => setChannelSettingsTab('prompts')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 ${
                  channelSettingsTab === 'prompts'
                    ? 'border-amber-500 text-amber-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" /> Mẫu Prompt Kênh
              </button>

              <button
                onClick={() => setChannelSettingsTab('tts')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 ${
                  channelSettingsTab === 'tts'
                    ? 'border-amber-500 text-amber-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic className="w-3.5 h-3.5" /> Giọng Đọc Mặc Định
              </button>

              <button
                onClick={() => setChannelSettingsTab('browser')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 ${
                  channelSettingsTab === 'browser'
                    ? 'border-amber-500 text-amber-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Profile Trình Duyệt
              </button>
            </div>

            {/* Modal Body / Tab Contents */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* TAB 1: THÔNG TIN & DNA */}
              {channelSettingsTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Tên Kênh:</label>
                      <input
                        type="text"
                        value={channelEditForm.name || ''}
                        onChange={e => setChannelEditForm({ ...channelEditForm, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">YouTube Handle:</label>
                      <input
                        type="text"
                        value={channelEditForm.handle || ''}
                        onChange={e => setChannelEditForm({ ...channelEditForm, handle: e.target.value })}
                        placeholder="@kenh_youtube"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Tiền Tố Tiêu Đề Mặc Định (Title Prefix):</label>
                      <input
                        type="text"
                        value={channelEditForm.title_prefix || ''}
                        onChange={e => setChannelEditForm({ ...channelEditForm, title_prefix: e.target.value })}
                        placeholder="Ví dụ: K1 -"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Thể Loại (Niche):</label>
                      <select
                        value={channelEditForm.niche || 'brain_psychology'}
                        onChange={e => setChannelEditForm({ ...channelEditForm, niche: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="brain_psychology">🧠 Tâm Lý Học Não Bộ (Brain Psychology)</option>
                        <option value="ancient_humans">🌿 Con Người Cổ Đại & Sinh Tồn (Ancient Humans)</option>
                        <option value="forgotten_civilizations">🏛️ Nền Văn Minh Bị Bỏ Quên (Forgotten Civilizations)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Mô Tả & Tôn Chỉ Kênh (Channel DNA):</label>
                    <textarea
                      rows={3}
                      value={channelEditForm.description || ''}
                      onChange={e => setChannelEditForm({ ...channelEditForm, description: e.target.value })}
                      placeholder="Mô tả định hướng nội dung và đối tượng khán giả..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: NHÂN VẬT ĐẠI DIỆN */}
              {channelSettingsTab === 'character' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                      {(channelEditForm.character_settings?.character_image_url || channelEditForm.character_image_url || modalChannel.character_image_url) ? (
                        <img
                          src={channelEditForm.character_settings?.character_image_url || channelEditForm.character_image_url || modalChannel.character_image_url}
                          alt="Character Reference"
                          className="w-36 h-36 object-contain rounded-lg border border-amber-500/30 bg-slate-900"
                        />
                      ) : (
                        <div className="w-36 h-36 rounded-lg border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500">
                          <User className="w-10 h-10 opacity-30 mb-2" />
                          <span className="text-[11px]">Chưa có ảnh</span>
                        </div>
                      )}

                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isUploadingChannelChar}
                          onClick={() => channelFileInputRef.current?.click()}
                          className="text-xs border-amber-500/40 text-amber-300 hover:bg-amber-950/40 gap-1.5 w-full justify-center"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {isUploadingChannelChar ? 'Đang tải ảnh...' : 'Upload Ảnh Nhân Vật'}
                        </Button>
                        <input
                          ref={channelFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleUploadChannelCharacter}
                          disabled={isUploadingChannelChar}
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-8 space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Mô Tả Cố Định Nhân Vật (Hero Lock Anchor):
                        </label>
                        <p className="text-[11px] text-slate-400">
                          Câu văn mô tả ngoại hình cố định (màu tóc, trang phục, đầu que...) được gán tự động vào mọi cảnh của video trong kênh này.
                        </p>
                        <textarea
                          rows={4}
                          value={channelEditForm.character_settings?.hero_lock || ''}
                          onChange={e => setChannelEditForm({
                            ...channelEditForm,
                            character_settings: {
                              ...(channelEditForm.character_settings || {}),
                              hero_lock: e.target.value,
                            }
                          })}
                          placeholder="The main stick figure character from the reference image..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MẪU PROMPT KÊNH */}
              {channelSettingsTab === 'prompts' && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-amber-300 text-xs">
                    💡 <strong>Cơ chế kế thừa:</strong> Khi tạo một video mới trong kênh này, video sẽ tự động nhận các mẫu Prefix/Suffix bên dưới. Từng video vẫn có thể tùy biến đè lên mà không ảnh hưởng cấu hình gốc của kênh.
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Tiền Tố Cảnh Mặc Định (Scene Prefix):
                      </label>
                      <textarea
                        rows={2}
                        value={channelEditForm.prompt_templates?.scene_prefix || ''}
                        onChange={e => setChannelEditForm({
                          ...channelEditForm,
                          prompt_templates: {
                            ...(channelEditForm.prompt_templates || {}),
                            scene_prefix: e.target.value,
                          }
                        })}
                        placeholder="Hand-drawn educational 2D black whiteboard doodle animation..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Hậu Tố Cảnh Thường (Scene Suffix - No Text):
                      </label>
                      <textarea
                        rows={3}
                        value={channelEditForm.prompt_templates?.scene_suffix_no_text || ''}
                        onChange={e => setChannelEditForm({
                          ...channelEditForm,
                          prompt_templates: {
                            ...(channelEditForm.prompt_templates || {}),
                            scene_suffix_no_text: e.target.value,
                          }
                        })}
                        placeholder=", same character design as the reference image, no text, no words..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Hậu Tố Thẻ Khái Niệm / Chữ Đỏ (Scene Suffix - Concept Card):
                      </label>
                      <textarea
                        rows={3}
                        value={channelEditForm.prompt_templates?.scene_suffix_concept_card || ''}
                        onChange={e => setChannelEditForm({
                          ...channelEditForm,
                          prompt_templates: {
                            ...(channelEditForm.prompt_templates || {}),
                            scene_suffix_concept_card: e.target.value,
                          }
                        })}
                        placeholder=", same character design, bold red hand-drawn text..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Prompt Chỉ Đạo Đạo Diễn AI (Visual Director System Prompt):
                      </label>
                      <textarea
                        rows={4}
                        value={channelEditForm.prompt_templates?.ai_director_system_prompt || ''}
                        onChange={e => setChannelEditForm({
                          ...channelEditForm,
                          prompt_templates: {
                            ...(channelEditForm.prompt_templates || {}),
                            ai_director_system_prompt: e.target.value,
                          }
                        })}
                        placeholder="You are an expert visual director for 2D doodle YouTube explainer videos..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: GIỌNG ĐỌC TTS */}
              {channelSettingsTab === 'tts' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Minimax Voice ID:</label>
                      <input
                        type="text"
                        value={channelEditForm.tts_preset?.voice_id || 'male-qn-qingse'}
                        onChange={e => setChannelEditForm({
                          ...channelEditForm,
                          tts_preset: {
                            ...(channelEditForm.tts_preset || {}),
                            voice_id: e.target.value,
                          }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Tốc Độ Đọc (Speed):</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.5"
                        max="2.0"
                        value={channelEditForm.tts_preset?.speed || 1.0}
                        onChange={e => setChannelEditForm({
                          ...channelEditForm,
                          tts_preset: {
                            ...(channelEditForm.tts_preset || {}),
                            speed: parseFloat(e.target.value),
                          }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Model TTS:</label>
                      <input
                        type="text"
                        value={channelEditForm.tts_preset?.model || 'speech-02-turbo'}
                        onChange={e => setChannelEditForm({
                          ...channelEditForm,
                          tts_preset: {
                            ...(channelEditForm.tts_preset || {}),
                            model: e.target.value,
                          }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: PROFILE TRÌNH DUYỆT ANTI-DETECT */}
              {channelSettingsTab === 'browser' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-cyan-400" />
                        <div>
                          <div className="text-xs font-bold text-slate-200">Trạng Thái Cửa Sổ Trình Duyệt:</div>
                          <div className="text-[11px] text-slate-400">Profile độc lập chạy qua DrissionPage với CDP Port riêng biệt</div>
                        </div>
                      </div>
                      <Badge className={browserIsOpen ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}>
                        {browserIsOpen ? '🟢 Đang Mở' : '⚪ Đang Đóng'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-slate-400">Đường dẫn Profile:</span>
                        <div className="font-mono text-[11px] text-amber-300 truncate mt-0.5">
                          output/story_studio/browser_profiles/{modalChannel.id}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">CDP Debugging Port:</span>
                        <div className="font-mono text-[11px] text-cyan-300 mt-0.5">
                          {browserPort}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs font-semibold text-slate-300">Proxy Cố Định Cho Kênh (Tùy chọn):</label>
                      <input
                        type="text"
                        value={channelEditForm.browser_profile?.proxy || ''}
                        onChange={e => setChannelEditForm({
                          ...channelEditForm,
                          browser_profile: {
                            ...(channelEditForm.browser_profile || {}),
                            proxy: e.target.value,
                          }
                        })}
                        placeholder="http://user:password@ip:port (để trống nếu dùng IP máy)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleOpenChannelBrowser(modalChannel.id)}
                        disabled={isOpeningBrowser}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 w-full font-semibold shadow-md"
                      >
                        <Globe className="w-4 h-4" />
                        {isOpeningBrowser ? 'Đang mở Chrome...' : '🚀 Khởi Chạy Trình Duyệt Chrome Ngay (DrissionPage)'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2 text-xs">
                {channelModalStatus ? (
                  <span className={`flex items-center gap-1.5 font-medium ${
                    channelModalStatus.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {channelModalStatus.type === 'ok' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                    {channelModalStatus.text}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Lưu lại sẽ cập nhật ngay lập tức cấu hình cho kênh này mà không tắt modal.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isSavingChannel}
                  onClick={() => setShowChannelSettingsModal(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Đóng
                </Button>
                <Button
                  size="sm"
                  disabled={isSavingChannel}
                  onClick={handleSaveChannelSettings}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingChannel ? 'Đang lưu...' : 'Lưu Cài Đặt Kênh'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
