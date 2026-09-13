import type { ASREngine } from '@/types/transcript'

export const ENGINE_LABELS: Record<ASREngine, string> = {
  local: '本地识别',
  xfyun: '讯飞云端',
  bailian: '百炼云端',
  doubao: '豆包云端',
}

export const ENGINE_OPTIONS: ASREngine[] = ['local', 'xfyun', 'bailian', 'doubao']
