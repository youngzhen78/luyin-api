export interface RawSegment {
  /** 识别引擎返回的原始说话人编号，如 "1" "2" */
  speakerTag: string
  start: number
  end: number
  text: string
}

export interface ASRInput {
  buffer: Buffer
  fileName: string
  mimeType: string
}

export interface ASRProvider {
  name: string
  transcribe(input: ASRInput): Promise<RawSegment[]>
}
