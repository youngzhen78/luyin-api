import type { Speaker, TranscriptSegment } from '@/types/transcript'

export function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface MarkdownSource {
  title: string
  fileName: string
  createdAt: number
  speakers: Speaker[]
  segments: TranscriptSegment[]
}

export function transcriptToMarkdown(t: MarkdownSource): string {
  const speakerName = (id: string) => t.speakers.find((s) => s.id === id)?.name ?? id

  const lines = [
    `# ${t.title}`,
    '',
    `- 文件：${t.fileName}`,
    `- 生成时间：${new Date(t.createdAt).toLocaleString('zh-CN')}`,
    '',
    '---',
    '',
  ]

  for (const seg of t.segments) {
    lines.push(
      `**${speakerName(seg.speakerId)}**（${formatTimestamp(seg.start)} - ${formatTimestamp(seg.end)}）`
    )
    lines.push(seg.text)
    lines.push('')
  }

  return lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
