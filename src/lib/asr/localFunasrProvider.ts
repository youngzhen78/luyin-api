import type { ASRProvider } from './types'

/**
 * 纯本地识别：转发给 local-asr/server.py 起的 FunASR 服务（阿里达摩院开源，
 * Paraformer + cam++ 说话人分离），全程不出网。需要用户自己先在
 * local-asr/ 目录下把那个 Python 服务跑起来，具体见该目录 README。
 */
const LOCAL_ASR_URL = process.env.LOCAL_ASR_URL || 'http://127.0.0.1:8001'

export const localFunasrProvider: ASRProvider = {
  name: 'local-funasr',
  async transcribe({ buffer, fileName, mimeType }) {
    const formData = new FormData()
    formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName)

    let res: Response
    try {
      res = await fetch(`${LOCAL_ASR_URL}/transcribe`, { method: 'POST', body: formData })
    } catch {
      throw new Error(
        `连不上本地识别服务（${LOCAL_ASR_URL}）。请确认已经在 local-asr/ 目录下运行 python server.py`
      )
    }

    if (!res.ok) {
      throw new Error(`本地识别服务出错（HTTP ${res.status}）`)
    }

    const data = await res.json()
    return data.segments
  },
}
