import type { RawSegment } from './types'

/**
 * 识别引擎按停顿断句，同一个人说话中间只要停顿久一点就会被拆成好几句，
 * 转写结果刷屏一样碎。这里把连续的、说话人相同的句子合并成一段——
 * 不管中间停顿多久，只要没换人，就还是算这个人的一段发言。
 */
export function mergeConsecutiveSegments(segments: RawSegment[]): RawSegment[] {
  if (segments.length === 0) return []

  const merged: RawSegment[] = [{ ...segments[0] }]
  for (const seg of segments.slice(1)) {
    const prev = merged[merged.length - 1]
    if (seg.speakerTag === prev.speakerTag) {
      prev.text += seg.text
      prev.end = seg.end
    } else {
      merged.push({ ...seg })
    }
  }
  return merged
}
