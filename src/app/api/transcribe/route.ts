import { NextRequest, NextResponse } from 'next/server'
import { getASRProvider } from '@/lib/asr'
import type { Transcript } from '@/types/transcript'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '未收到音频文件' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const provider = getASRProvider()
    const rawSegments = await provider.transcribe({
      buffer,
      fileName: file.name,
      mimeType: file.type,
    })

    const speakerTags = Array.from(new Set(rawSegments.map((s) => s.speakerTag)))
    const speakers = speakerTags.map((tag, i) => ({ id: tag, name: `发言人${i + 1}` }))

    const transcript: Transcript = {
      title: file.name.replace(/\.[^/.]+$/, ''),
      fileName: file.name,
      createdAt: Date.now(),
      speakers,
      segments: rawSegments.map((s, i) => ({
        id: `${Date.now()}-${i}`,
        speakerId: s.speakerTag,
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    }

    return NextResponse.json({ provider: provider.name, transcript })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '识别失败' },
      { status: 500 }
    )
  }
}
