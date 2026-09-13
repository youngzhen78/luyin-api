'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, Download, Plus, Pencil, Users } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import AudioPlayer, { type AudioPlayerHandle } from '@/components/AudioPlayer'
import type { Transcript } from '@/types/transcript'
import { formatTimestamp, transcriptToMarkdown, downloadTextFile } from '@/lib/transcript-export'

const STORAGE_KEY = 'transcribe_current'

const BADGE_COLORS = [
  { bg: '#E6F1FB', text: '#378ADD' },
  { bg: '#F3E8FF', text: '#9333EA' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#DCFCE7', text: '#16A34A' },
  { bg: '#FCE7F3', text: '#DB2777' },
  { bg: '#E0E7FF', text: '#4F46E5' },
]

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function speakerAvatar(name: string): string {
  const m = name.match(/^发言人(\d+)$/)
  if (m) return m[1]
  return name.slice(-2)
}

export default function TranscribePage() {
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const playerRef = useRef<AudioPlayerHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 恢复上次未完成的编辑（不含音频本身，音频只存在于本次会话中）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setTranscript(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (transcript) localStorage.setItem(STORAGE_KEY, JSON.stringify(transcript))
  }, [transcript])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setLoading(true)
    setAudioUrl(URL.createObjectURL(file))

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '识别失败')
      setTranscript(data.transcript as Transcript)
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败')
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function updateSegmentText(id: string, text: string) {
    if (!transcript) return
    setTranscript({
      ...transcript,
      segments: transcript.segments.map((s) => (s.id === id ? { ...s, text } : s)),
    })
  }

  function updateSegmentSpeaker(id: string, speakerId: string) {
    if (!transcript) return
    setTranscript({
      ...transcript,
      segments: transcript.segments.map((s) => (s.id === id ? { ...s, speakerId } : s)),
    })
  }

  function renameSpeaker(id: string, name: string) {
    if (!transcript) return
    setTranscript({
      ...transcript,
      speakers: transcript.speakers.map((s) => (s.id === id ? { ...s, name } : s)),
    })
  }

  function addSpeaker() {
    if (!transcript) return
    const id = genId()
    setTranscript({
      ...transcript,
      speakers: [...transcript.speakers, { id, name: `发言人${transcript.speakers.length + 1}` }],
    })
  }

  function seekTo(sec: number) {
    playerRef.current?.seek(sec)
  }

  function handleExport() {
    if (!transcript) return
    downloadTextFile(`${transcript.title}.md`, transcriptToMarkdown(transcript), 'text/markdown;charset=utf-8')
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="录音转文字" subtitle="识别、区分发言人、导出 Markdown" />

      {/* 固定播放条：不随下面的转写内容滚动 */}
      {transcript && audioUrl && (
        <div className="border-b border-gray-100">
          <AudioPlayer ref={playerRef} src={audioUrl} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!transcript && (
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-6 text-gray-400 cursor-pointer active:bg-gray-50 transition-colors">
            <Upload size={18} />
            <span className="text-[14px]">{loading ? '识别中…' : '点击上传音频 / 视频文件'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              disabled={loading}
              onChange={handleFileChange}
            />
          </label>
        )}

        {error && <p className="text-[13px] text-red-500 mt-2">{error}</p>}

        {transcript && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <input
                className="flex-1 min-w-0 text-[16px] font-semibold text-gray-900 outline-none border-b border-gray-100 pb-2"
                value={transcript.title}
                onChange={(e) => setTranscript({ ...transcript, title: e.target.value })}
              />
              <label className="flex-shrink-0 text-[12px] text-gray-400 cursor-pointer">
                {loading ? '识别中…' : '重新上传'}
                <input
                  type="file"
                  accept="audio/*,video/*"
                  className="hidden"
                  disabled={loading}
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {/* 分段文字 */}
            <div className="flex flex-col gap-3">
              {transcript.segments.map((seg) => {
                const speaker = transcript.speakers.find((s) => s.id === seg.speakerId)
                const speakerName = speaker?.name ?? seg.speakerId
                const colorIdx = transcript.speakers.findIndex((s) => s.id === seg.speakerId)
                const color = BADGE_COLORS[colorIdx < 0 ? 0 : colorIdx % BADGE_COLORS.length]

                return (
                  <div key={seg.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-medium flex-shrink-0"
                        style={{ background: color.bg, color: color.text }}
                      >
                        {speakerAvatar(speakerName)}
                      </span>

                      {editingSegmentId === seg.id ? (
                        <input
                          ref={(el) => {
                            if (el) setTimeout(() => el.focus(), 0)
                          }}
                          defaultValue={speakerName}
                          onBlur={(e) => {
                            renameSpeaker(seg.speakerId, e.target.value.trim() || speakerName)
                            setEditingSegmentId(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                          }}
                          className="text-[13px] font-medium text-gray-800 outline-none border-b border-blue-300 w-20"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingSegmentId(seg.id)}
                          className="flex items-center gap-1 text-[13px] font-medium text-gray-800"
                        >
                          {speakerName}
                          <Pencil size={10} className="text-gray-300" />
                        </button>
                      )}

                      {/* 把这一句改到别的发言人（识别分错的时候用） */}
                      <div className="relative">
                        <Users size={12} className="text-gray-300" />
                        <select
                          value={seg.speakerId}
                          onChange={(e) => updateSegmentSpeaker(seg.id, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        >
                          {transcript.speakers.map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              {sp.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="text-[11px] text-gray-300 ml-auto">{formatTimestamp(seg.start)}</span>
                    </div>

                    <textarea
                      value={seg.text}
                      onClick={() => seekTo(seg.start)}
                      onChange={(e) => updateSegmentText(seg.id, e.target.value)}
                      rows={2}
                      className="w-full text-[14px] text-gray-800 bg-gray-50 rounded-lg p-2.5 outline-none resize-none"
                    />
                  </div>
                )
              })}
            </div>

            <button
              onClick={addSpeaker}
              className="flex items-center gap-0.5 text-[12px] text-gray-400 px-2 py-1 mt-3 rounded-full border border-gray-200"
            >
              <Plus size={12} /> 新增发言人
            </button>

            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 mt-4 py-3 rounded-xl bg-[#378ADD] text-white text-[14px] font-medium active:opacity-80 transition-opacity"
            >
              <Download size={16} />
              导出 Markdown
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
