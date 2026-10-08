import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchAPI } from '../api/client'
import type { Project } from '../types'
import ProjectDetailPage from './ProjectDetailPage'
import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n/translations'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, CardFooter } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import CreateProjectDialog from '../components/projects/CreateProjectDialog'

type FilterTab = 'ACTIVE' | 'ARCHIVED' | 'ALL'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString()
}

function TierBadge({ tier, t }: { tier: string | null; t: (key: TranslationKey) => string }) {
  if (!tier) return null
  const isTwo = tier.includes('TWO')
  return <Badge variant={isTwo ? 'default' : 'secondary'}>{isTwo ? t('projects.tier2') : t('projects.tier1')}</Badge>
}

function ProjectCard({ project, onClick, onDelete, t }: { project: Project; onClick: () => void; onDelete: (e: React.MouseEvent) => void; t: (key: TranslationKey, params?: Record<string, string | number>) => string }) {
  return (
    <Card className="py-4 gap-3 h-full cursor-pointer transition-opacity hover:opacity-90 relative group" onClick={onClick}>
      <CardHeader>
        <CardTitle className="text-sm">{project.name}</CardTitle>
        {project.description && (
          <CardDescription className="text-[11px] leading-relaxed line-clamp-2">{project.description}</CardDescription>
        )}
        <CardAction>
          <div className="flex items-center gap-1.5">
            <TierBadge tier={project.user_paygate_tier} t={t} />
            <button
              type="button"
              onClick={onDelete}
              title="Xóa dự án"
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-opacity cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {project.material && <Badge variant="outline">{project.material}</Badge>}
          <Badge variant="outline">{project.status}</Badge>
        </div>
      </CardContent>
      <CardFooter>
        <span className="text-[10px] tracking-wide" style={{ color: 'var(--muted)' }}>{t('projects.footer', { date: formatDate(project.created_at), id: project.id.slice(0, 8) })}</span>
      </CardFooter>
    </Card>
  )
}

export default function ProjectsPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<FilterTab>('ACTIVE')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    fetchAPI<Project[]>('/api/projects')
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // If there's an :id param, show detail page
  if (id) {
    return <ProjectDetailPage projectId={id} onBack={() => navigate('/projects')} />
  }

  const filtered = projects.filter(p => {
    if (tab === 'ALL') return p.status !== 'DELETED'
    return p.status === tab
  })

  async function handleDelete(e: React.MouseEvent, p: Project) {
    e.stopPropagation()
    if (!window.confirm(`Bạn có chắc chắn muốn xóa dự án "${p.name}"?`)) return
    try {
      await fetchAPI(`/api/projects/${p.id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(item => item.id !== p.id))
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa dự án')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Tabs value={tab} onValueChange={v => setTab(v as FilterTab)}>
            <TabsList>
              <TabsTrigger value="ACTIVE">{t('projects.tab.active')}</TabsTrigger>
              <TabsTrigger value="ARCHIVED">{t('projects.tab.archived')}</TabsTrigger>
              <TabsTrigger value="ALL">{t('projects.tab.all')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {t('projects.count', { n: filtered.length })}
          </span>
        </div>

        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 font-medium cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tạo dự án mới</span>
        </Button>
      </div>

      {loading ? (
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{t('projects.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-dashed gap-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>{t(`projects.empty.${tab}` as TranslationKey)}</div>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo dự án đầu tiên</span>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {filtered.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => navigate(`/projects/${p.id}`)}
              onDelete={(e) => handleDelete(e, p)}
              t={t}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(newProj) => {
          setProjects(prev => [newProj, ...prev])
          navigate(`/projects/${newProj.id}?tab=pipeline`)
        }}
      />
    </div>
  )
}
