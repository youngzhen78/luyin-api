'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Trash2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import type { Recording, RecordingStatus } from '@/types/transcript'
import { formatTimestamp } from '@/lib/transcript-export'
import { ENGINE_LABELS } from '@/lib/engine-labels'

const STATUS_LABEL: Record<RecordingStatus, string> = {
  pending: '未转写',
  transcribing: '转写中…',
  done: '已完成',
  error: '识别失败',
}

const STATUS_COLOR: Record<RecordingStatus, string> = {
  pending: 'text-gray-400',
  transcribing: 'text-amber-500',
  done: 'text-[#378ADD]',
  error: 'text-red-400',
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 拿到音频真实时长（部分浏览器/格式下上传前就能读出来） */
function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0)
    audio.onerror = () => resolve(0)
    audio.src = URL.createObjectURL(file)
  })
}

export default function RecordingsListPage() {
  const router = useRouter()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadList() {
    const res = await fetch('/api/recordings')
    const data = await res.json()
    setRecordings(data.recordings ?? [])
  }

  useEffect(() => {
    loadList()
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const duration = await readAudioDuration(file)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('duration', String(duration))
      const res = await fetch('/api/recordings', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) router.push(`/recordings/${data.recording.id}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('确定删除这条录音吗？删除后无法恢复。')) return
    await fetch(`/api/recordings/${id}`, { method: 'DELETE' })
    setRecordings((list) => list.filter((r) => r.id !== id))
  }

  async function handleRename(id: string, title: string) {
    setRecordings((list) => list.map((r) => (r.id === id ? { ...r, title } : r)))
    await fetch(`/api/recordings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="录音转文字" subtitle="识别、区分发言人、导出 Markdown" />

      <div className="px-5">
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 cursor-pointer active:bg-gray-50 transition-colors">
          <Upload size={16} />
          <span className="text-[13px]">{uploading ? '上传中…' : '上传新录音'}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        {recordings.length === 0 && (
          <p className="text-center text-[13px] text-gray-300 mt-12">还没有录音，上传一个开始吧</p>
        )}

        <div className="flex flex-col gap-2">
          {recordings.map((r) => (
            <div
              key={r.id}
              onClick={() => router.push(`/recordings/${r.id}`)}
              className="rounded-xl bg-gray-50 p-3 cursor-pointer active:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  value={r.title}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setRecordings((list) =>
                      list.map((item) => (item.id === r.id ? { ...item, title: e.target.value } : item))
                    )
                  }
                  onBlur={(e) => handleRename(r.id, e.target.value)}
                  className="flex-1 min-w-0 text-[14px] font-medium text-gray-900 bg-transparent outline-none truncate"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(r.id)
                  }}
                  className="flex-shrink-0 p-1 text-gray-300 active:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400">
                <span>{formatDate(r.createdAt)}</span>
                <span>·</span>
                <span>{formatTimestamp(r.duration)}</span>
                <span>·</span>
                <span className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</span>
                {r.engine && (
                  <>
                    <span>·</span>
                    <span>{ENGINE_LABELS[r.engine]}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
