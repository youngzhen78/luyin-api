import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { getRecording, audioFilePath } from '@/lib/recordings-store'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const rec = getRecording(params.id)
  if (!rec) return NextResponse.json({ error: '未找到该录音' }, { status: 404 })

  const filePath = audioFilePath(params.id)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '音频文件不存在' }, { status: 404 })
  }

  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': rec.mimeType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  })
}
