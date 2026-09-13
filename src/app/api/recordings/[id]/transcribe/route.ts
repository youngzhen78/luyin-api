import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { getRecording, saveRecording, audioFilePath } from '@/lib/recordings-store'
import { getASRProvider } from '@/lib/asr'
import type { ASREngine } from '@/types/transcript'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = getRecording(params.id)
  if (!rec) return NextResponse.json({ error: '未找到该录音' }, { status: 404 })

  let engine: ASREngine | undefined
  try {
    const body = await req.json()
    engine = body?.engine
  } catch {
    // 没传 body 就走默认引擎（ASR_PROVIDER 环境变量）
  }

  rec.status = 'transcribing'
  saveRecording(rec)

  try {
    const buffer = fs.readFileSync(audioFilePath(params.id))
    const provider = getASRProvider(engine)
    const rawSegments = await provider.transcribe({
      buffer,
      fileName: rec.fileName,
      mimeType: rec.mimeType,
    })

    const speakerTags = Array.from(new Set(rawSegments.map((s) => s.speakerTag)))
    const speakers = speakerTags.map((tag, i) => ({ id: tag, name: `发言人${i + 1}` }))
    const segments = rawSegments.map((s, i) => ({
      id: `${Date.now()}-${i}`,
      speakerId: s.speakerTag,
      start: s.start,
      end: s.end,
      text: s.text,
    }))

    const updated = {
      ...rec,
      status: 'done' as const,
      engine,
      speakers,
      segments,
      error: undefined,
    }
    saveRecording(updated)
    return NextResponse.json({ recording: updated })
  } catch (err) {
    const updated = {
      ...rec,
      status: 'error' as const,
      error: err instanceof Error ? err.message : '识别失败',
    }
    saveRecording(updated)
    return NextResponse.json({ recording: updated }, { status: 500 })
  }
}
