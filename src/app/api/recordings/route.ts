import { randomUUID } from 'crypto'
import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { listRecordings, saveRecording, audioFilePath } from '@/lib/recordings-store'
import type { Recording } from '@/types/transcript'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ recordings: listRecordings() })
}

function formatAutoTitle(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} 录音`
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file')
  const durationRaw = formData.get('duration')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '未收到音频文件' }, { status: 400 })
  }

  const id = randomUUID()
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(audioFilePath(id), buffer)

  const createdAt = Date.now()
  const recording: Recording = {
    id,
    title: formatAutoTitle(createdAt),
    fileName: file.name,
    mimeType: file.type || 'audio/mpeg',
    duration: Number(durationRaw) || 0,
    createdAt,
    status: 'pending',
  }
  saveRecording(recording)

  return NextResponse.json({ recording })
}
