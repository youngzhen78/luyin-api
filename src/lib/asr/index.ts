import type { ASRProvider } from './types'
import { mockProvider } from './mockProvider'
import { xfyunIfasrProvider } from './xfyunIfasrProvider'
import { localFunasrProvider } from './localFunasrProvider'
import { bailianProvider } from './bailianProvider'
import { doubaoProvider } from './doubaoProvider'

const providers: Record<string, ASRProvider> = {
  mock: mockProvider,
  xfyun: xfyunIfasrProvider,
  local: localFunasrProvider,
  bailian: bailianProvider,
  doubao: doubaoProvider,
}

export function getASRProvider(preferred?: string): ASRProvider {
  const key = preferred || process.env.ASR_PROVIDER || 'mock'
  return providers[key] ?? mockProvider
}

export * from './types'
