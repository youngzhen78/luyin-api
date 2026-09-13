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

export interface Transcript {
  title: string
  fileName: string
  createdAt: number
  speakers: Speaker[]
  segments: TranscriptSegment[]
}
