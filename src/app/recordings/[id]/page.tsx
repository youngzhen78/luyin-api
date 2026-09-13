'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, Pencil, Plus, Users, Loader2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import AudioPlayer, { type AudioPlayerHandle } from '@/components/AudioPlayer'
import type { ASREngine, Recording, TranscriptSegment } from '@/types/transcript'
import { formatTimestamp, transcriptToMarkdown, downloadTextFile } from '@/lib/transcript-export'
import { ENGINE_LABELS, ENGINE_OPTIONS } from '@/lib/engine-labels'

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

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export default function RecordingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [recording, setRecording] = useState<Recording | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcribing, setTranscribing] = useState<ASREngine | null>(null)
  const [speakerCount, setSpeakerCount] = useState('')
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const playerRef = useRef<AudioPlayerHandle>(null)

  useEffect(() => {
    fetch(`/api/recordings/${id}`)
      .then((res) => res.json())
      .then((data) => setRecording(data.recording ?? null))
      .finally(() => setLoading(false))
  }, [id])

  async function persist(patch: Partial<Recording>) {
    if (!recording) return
    const updated = { ...recording, ...patch }
    setRecording(updated)
    await fetch(`/api/recordings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  async function startTranscribe(engine: ASREngine) {
    setTranscribing(engine)
    try {
      const res = await fetch(`/api/recordings/${id}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine, speakerCount: Number(speakerCount) || undefined }),
      })
      const data = await res.json()
      if (data.recording) setRecording(data.recording)
    } finally {
      setTranscribing(null)
    }
  }

  function setSegmentsLocal(segments: TranscriptSegment[]) {
    if (!recording) return
    setRecording({ ...recording, segments })
  }

  function updateSegmentSpeaker(segId: string, speakerId: string) {
    if (!recording?.segments) return
    persist({ segments: recording.segments.map((s) => (s.id === segId ? { ...s, speakerId } : s)) })
  }

  function renameSpeaker(speakerId: string, name: string) {
    if (!recording?.speakers) return
    persist({ speakers: recording.speakers.map((s) => (s.id === speakerId ? { ...s, name } : s)) })
  }

  function addSpeaker() {
    if (!recording?.speakers) return
    persist({
      speakers: [...recording.speakers, { id: genId(), name: `发言人${recording.speakers.length + 1}` }],
    })
  }

  function seekTo(sec: number) {
    playerRef.current?.seek(sec)
  }

  function handleExport() {
    if (!recording?.speakers || !recording.segments) return
    downloadTextFile(
      `${recording.title}.md`,
      transcriptToMarkdown({
        title: recording.title,
        fileName: recording.fileName,
        createdAt: recording.createdAt,
        speakers: recording.speakers,
        segments: recording.segments,
      }),
      'text/markdown;charset=utf-8'
    )
  }

  if (loading) {
    return <div className="p-5 text-[13px] text-gray-400">加载中…</div>
  }
  if (!recording) {
    return <div className="p-5 text-[13px] text-gray-400">未找到这条录音</div>
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={recording.title}
        subtitle={
          formatTimestamp(recording.duration) +
          (recording.engine ? ` · ${ENGINE_LABELS[recording.engine]}` : '')
        }
        left={
          <button onClick={() => router.push('/')} className="p-1 -ml-1 text-gray-400 flex-shrink-0">
            <ArrowLeft size={20} />
          </button>
        }
        right={
          recording.status === 'done' && (
            <button onClick={handleExport} className="p-1.5 text-[#378ADD]">
              <Download size={20} />
            </button>
          )
        }
      />

      <div className="border-b border-gray-100">
        <AudioPlayer ref={playerRef} src={`/api/recordings/${id}/audio`} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        {/* 标题编辑 */}
        <input
          className="w-full text-[14px] font-medium text-gray-800 outline-none border-b border-gray-100 pb-2 mb-3"
          value={recording.title}
          onChange={(e) => setRecording({ ...recording, title: e.target.value })}
          onBlur={(e) => persist({ title: e.target.value })}
        />

        {recording.status === 'pending' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-[13px] text-gray-400">还没有转写，选一种识别方式</p>
            <label className="flex items-center gap-2 text-[12px] text-gray-400">
              说话人数（可选，帮助百炼分得更准）
              <input
                type="number"
                min={2}
                max={100}
                value={speakerCount}
                onChange={(e) => setSpeakerCount(e.target.value)}
                placeholder="自动判断"
                className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-center text-gray-700 outline-none"
              />
            </label>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {ENGINE_OPTIONS.map((engine) => (
                <button
                  key={engine}
                  onClick={() => startTranscribe(engine)}
                  disabled={!!transcribing}
                  className="px-4 py-2.5 rounded-xl border border-[#378ADD] text-[#378ADD] text-[13px] font-medium active:opacity-70 disabled:opacity-50"
                >
                  {transcribing === engine ? '识别中…' : ENGINE_LABELS[engine]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-300 text-center">
              本地：阿里 FunASR，需要先启动 local-asr/server.py，不出网
            </p>
          </div>
        )}

        {recording.status === 'transcribing' && (
          <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <p className="text-[13px]">识别中，请稍候…</p>
          </div>
        )}

        {recording.status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-[13px] text-red-400">{recording.error || '识别失败'}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {ENGINE_OPTIONS.map((engine) => (
                <button
                  key={engine}
                  onClick={() => startTranscribe(engine)}
                  disabled={!!transcribing}
                  className="px-4 py-2.5 rounded-xl border border-[#378ADD] text-[#378ADD] text-[13px] font-medium active:opacity-70 disabled:opacity-50"
                >
                  {transcribing === engine ? '识别中…' : `${ENGINE_LABELS[engine]}重试`}
                </button>
              ))}
            </div>
          </div>
        )}

        {recording.status === 'done' && recording.segments && recording.speakers && (
          <div>
            {recording.segments.map((seg) => {
              const speaker = recording.speakers!.find((s) => s.id === seg.speakerId)
              const speakerName = speaker?.name ?? seg.speakerId
              const colorIdx = recording.speakers!.findIndex((s) => s.id === seg.speakerId)
              const color = BADGE_COLORS[colorIdx < 0 ? 0 : colorIdx % BADGE_COLORS.length]

              return (
                <div key={seg.id} className="py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium flex-shrink-0"
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
                        className="text-[12px] font-medium text-gray-800 outline-none border-b border-blue-300 w-16"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingSegmentId(seg.id)}
                        className="flex items-center gap-1 text-[12px] font-medium text-gray-800"
                      >
                        {speakerName}
                        <Pencil size={9} className="text-gray-300" />
                      </button>
                    )}

                    <div className="relative">
                      <Users size={11} className="text-gray-300" />
                      <select
                        value={seg.speakerId}
                        onChange={(e) => updateSegmentSpeaker(seg.id, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      >
                        {recording.speakers!.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="text-[10px] text-gray-300 ml-auto">{formatTimestamp(seg.start)}</span>
                  </div>

                  <textarea
                    ref={autoResize}
                    defaultValue={seg.text}
                    onMouseDown={() => seekTo(seg.start)}
                    onInput={(e) => {
                      autoResize(e.currentTarget)
                      setSegmentsLocal(
                        recording.segments!.map((s) =>
                          s.id === seg.id ? { ...s, text: e.currentTarget.value } : s
                        )
                      )
                    }}
                    onBlur={(e) =>
                      persist({
                        segments: recording.segments!.map((s) =>
                          s.id === seg.id ? { ...s, text: e.target.value } : s
                        ),
                      })
                    }
                    rows={1}
                    className="w-full text-[13px] leading-snug text-gray-800 bg-transparent outline-none resize-none overflow-hidden"
                  />
                </div>
              )
            })}

            <button
              onClick={addSpeaker}
              className="flex items-center gap-0.5 text-[12px] text-gray-400 px-2 py-1 mt-3 rounded-full border border-gray-200"
            >
              <Plus size={12} /> 新增发言人
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
