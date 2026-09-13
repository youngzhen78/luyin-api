export interface Speaker {
  id: string
  name: string
}

export interface TranscriptSegment {
  id: string
  speakerId: string
  start: number
  end: number
  text: string
}

export type RecordingStatus = 'pending' | 'transcribing' | 'done' | 'error'

export type ASREngine = 'local' | 'xfyun' | 'bailian' | 'doubao'

export interface Recording {
  id: string
  title: string
  fileName: string
  mimeType: string
  duration: number
  createdAt: number
  status: RecordingStatus
  error?: string
  engine?: ASREngine
  speakers?: Speaker[]
  segments?: TranscriptSegment[]
}
