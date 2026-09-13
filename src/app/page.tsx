'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, Play, Download, Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import type { Transcript } from '@/types/transcript'
import { formatTimestamp, transcriptToMarkdown, downloadTextFile } from '@/lib/transcript-export'

const STORAGE_KEY = 'transcribe_current'

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function TranscribePage() {
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
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
    if (audioRef.current) {
      audioRef.current.currentTime = sec
      audioRef.current.play()
    }
  }

  function handleExport() {
    if (!transcript) return
    downloadTextFile(`${transcript.title}.md`, transcriptToMarkdown(transcript), 'text/markdown;charset=utf-8')
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="录音转文字" subtitle="识别、区分发言人、导出 Markdown" />

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* 上传区 */}
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

        {error && <p className="text-[13px] text-red-500 mt-2">{error}</p>}

        {transcript && (
          <div className="mt-5">
            {/* 音频播放条 */}
            {audioUrl && (
              <audio ref={audioRef} src={audioUrl} controls className="w-full mb-4" />
            )}

            {/* 标题 */}
            <input
              className="w-full text-[16px] font-semibold text-gray-900 mb-3 outline-none border-b border-gray-100 pb-2"
              value={transcript.title}
              onChange={(e) => setTranscript({ ...transcript, title: e.target.value })}
            />

            {/* 发言人列表 */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {transcript.speakers.map((sp) => (
                <input
                  key={sp.id}
                  value={sp.name}
                  onChange={(e) => renameSpeaker(sp.id, e.target.value)}
                  className="text-[12px] font-medium px-2 py-1 rounded-full bg-blue-50 text-[#378ADD] outline-none w-20"
                />
              ))}
              <button
                onClick={addSpeaker}
                className="flex items-center gap-0.5 text-[12px] text-gray-400 px-2 py-1 rounded-full border border-gray-200"
              >
                <Plus size={12} /> 发言人
              </button>
            </div>

            {/* 分段文字 */}
            <div className="flex flex-col gap-3">
              {transcript.segments.map((seg) => (
                <div key={seg.id} className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <button
                      onClick={() => seekTo(seg.start)}
                      className="flex items-center gap-1 text-[11px] text-gray-400"
                    >
                      <Play size={10} />
                      {formatTimestamp(seg.start)}
                    </button>
                    <select
                      value={seg.speakerId}
                      onChange={(e) => updateSegmentSpeaker(seg.id, e.target.value)}
                      className="text-[12px] font-medium text-[#378ADD] bg-transparent outline-none"
                    >
                      {transcript.speakers.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={seg.text}
                    onChange={(e) => updateSegmentText(seg.id, e.target.value)}
                    rows={2}
                    className="w-full text-[14px] text-gray-800 bg-transparent outline-none resize-none"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 mt-5 py-3 rounded-xl bg-[#378ADD] text-white text-[14px] font-medium active:opacity-80 transition-opacity"
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
