import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { getRecording, audioFilePath } from '@/lib/recordings-store'

export const runtime = 'nodejs'

/**
 * <audio> 元素要能拖动进度条/跳转播放，浏览器需要用 HTTP Range 请求按字节区间
 * 取音频片段。不支持 Range 的话，seek 经常表现为无效或直接从头开始播放。
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = getRecording(params.id)
  if (!rec) return NextResponse.json({ error: '未找到该录音' }, { status: 404 })

  const filePath = audioFilePath(params.id)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '音频文件不存在' }, { status: 404 })
  }

  const fileSize = fs.statSync(filePath).size
  const range = req.headers.get('range')

  if (!range) {
    const buffer = fs.readFileSync(filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': rec.mimeType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    })
  }

  const match = range.match(/bytes=(\d+)-(\d*)/)
  if (!match) {
    return NextResponse.json({ error: 'Range 无效' }, { status: 416 })
  }

  const start = Number(match[1])
  const end = match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1
  const chunkSize = end - start + 1

  const buffer = Buffer.alloc(chunkSize)
  const fd = fs.openSync(filePath, 'r')
  fs.readSync(fd, buffer, 0, chunkSize, start)
  fs.closeSync(fd)

  return new NextResponse(buffer, {
    status: 206,
    headers: {
      'Content-Type': rec.mimeType,
      'Content-Length': String(chunkSize),
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  })
}
