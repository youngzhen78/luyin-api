import type { ASRProvider } from './types'
import { mockProvider } from './mockProvider'
import { xfyunIfasrProvider } from './xfyunIfasrProvider'

const providers: Record<string, ASRProvider> = {
  mock: mockProvider,
  xfyun: xfyunIfasrProvider,
}

export function getASRProvider(): ASRProvider {
  const key = process.env.ASR_PROVIDER || 'mock'
  return providers[key] ?? mockProvider
}

export * from './types'
