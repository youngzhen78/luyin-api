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
  /** 预估说话人数量，部分引擎支持用它辅助提升说话人分离准确度 */
  speakerCount?: number
}

export interface ASRProvider {
  name: string
  transcribe(input: ASRInput): Promise<RawSegment[]>
}
