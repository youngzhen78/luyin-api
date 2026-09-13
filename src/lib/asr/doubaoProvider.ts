import { randomUUID } from 'crypto'
import TosClient, { TosServerError } from '@volcengine/tos-sdk'
import type { ASRProvider, RawSegment } from './types'
import { mergeConsecutiveSegments } from './mergeSegments'

/** TOS 报错信息太简单（比如只有一句 "Access Denied"），补上错误码和 requestId 方便定位 */
function describeTosError(err: unknown): string {
  if (err instanceof TosServerError) {
    return `${err.message}（code: ${err.code}, requestId: ${err.requestId}）`
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * 火山引擎豆包"大模型录音文件识别"，带说话人分离。
 * 文档（用户提供）：
 * - 提交任务 POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit
 * - 查询结果 POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query
 *
 * 这个接口不接受直接上传文件，只认音频 URL，且火山引擎没有百炼那种免费临时
 * 存储，所以要先把本地音频传到火山引擎对象存储 TOS，生成一个带签名的临时
 * 下载链接，再拿这个链接提交转写任务。
 *
 * 需要环境变量：VOLC_API_KEY、TOS_ACCESS_KEY_ID、TOS_SECRET_ACCESS_KEY，
 * 可选 TOS_BUCKET（默认 luyin-api-audio）、TOS_REGION（默认 cn-beijing）。
 *
 * 注意：官方文档没有写明 utterances 里说话人字段的确切名字（只写了 text /
 * start_time / end_time），下面 parseSpeaker() 按几个候选字段名尝试读取，
 * 如果说话人一直是同一个值，需要用真实响应核对字段名再调整。
 */

const SUBMIT_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit'
const QUERY_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query'

function getApiKey(): string {
  const key = process.env.VOLC_API_KEY
  if (!key) throw new Error('未配置豆包引擎：请设置 VOLC_API_KEY 环境变量')
  return key
}

function getResourceId(): string {
  // volc.bigasr.auc：豆包录音文件识别模型1.0；volc.seedasr.auc：2.0
  return process.env.VOLC_RESOURCE_ID || 'volc.bigasr.auc'
}

function getTosClient(): TosClient {
  const accessKeyId = process.env.TOS_ACCESS_KEY_ID
  const accessKeySecret = process.env.TOS_SECRET_ACCESS_KEY
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('未配置豆包引擎：请设置 TOS_ACCESS_KEY_ID / TOS_SECRET_ACCESS_KEY 环境变量')
  }
  const region = process.env.TOS_REGION || 'cn-beijing'
  const endpoint = process.env.TOS_ENDPOINT || `tos-${region}.volces.com`
  return new TosClient({ accessKeyId, accessKeySecret, region, endpoint })
}

function getBucket(): string {
  return process.env.TOS_BUCKET || 'luyin-api-audio'
}

const FORMAT_BY_EXT: Record<string, string> = {
  wav: 'wav',
  mp3: 'mp3',
  ogg: 'ogg',
  spx: 'spx',
  amr: 'amr',
  aac: 'aac',
  m4a: 'm4a',
}

function detectFormat(fileName: string): string {
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase() : ''
  const format = FORMAT_BY_EXT[ext]
  if (!format) {
    throw new Error(`豆包引擎不支持该音频格式（.${ext || '未知'}），仅支持 wav/mp3/ogg/spx/amr/aac/m4a`)
  }
  return format
}

/** 上传到 TOS 并生成一个 1 小时有效期的预签名下载链接 */
async function uploadAndGetUrl(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const client = getTosClient()
  const bucket = getBucket()
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : ''
  const key = `luyin-api/${randomUUID()}${ext}`

  try {
    await client.putObject({ bucket, key, body: buffer, contentType: mimeType })
  } catch (err) {
    // TOS 明确告诉我们是桶不存在时才自动建桶，其他错误直接抛出，不瞎猜
    const isNoSuchBucket = err instanceof TosServerError && err.code === 'NoSuchBucket'
    if (!isNoSuchBucket) throw new Error(`上传音频到 TOS 失败：${describeTosError(err)}`)
    try {
      await client.createBucket({ bucket })
      await client.putObject({ bucket, key, body: buffer, contentType: mimeType })
    } catch (err2) {
      throw new Error(`上传音频到 TOS 失败：${describeTosError(err2)}`)
    }
  }

  return client.getPreSignedUrl({ bucket, key, method: 'GET', expires: 3600 })
}

async function submitTask(apiKey: string, audioUrl: string, format: string, speakerCount?: number): Promise<string> {
  const requestId = randomUUID()
  const res = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Api-Resource-Id': getResourceId(),
      'X-Api-Request-Id': requestId,
      'X-Api-Sequence': '-1',
    },
    body: JSON.stringify({
      audio: { url: audioUrl, format },
      request: {
        model_name: 'bigmodel',
        enable_speaker_info: true,
        show_utterances: true,
        ssd_version: '200',
        enable_itn: true,
        enable_punc: true,
        ...(speakerCount ? { ssd_mode: speakerCount > 5 ? 1 : 0 } : {}),
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`提交豆包转写任务失败：${res.headers.get('X-Api-Message') || res.status}`)
  }
  return requestId
}

interface DoubaoUtterance {
  text: string
  start_time: number
  end_time: number
  speaker?: string | number
  speaker_id?: string | number
  additions?: { speaker?: string | number; speaker_id?: string | number }
}

interface DoubaoQueryResult {
  text?: string
  utterances?: DoubaoUtterance[]
}

async function pollTask(apiKey: string, requestId: string): Promise<DoubaoQueryResult> {
  const maxAttempts = 200 // 最长等待 10 分钟
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const res = await fetch(QUERY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': getResourceId(),
        'X-Api-Request-Id': requestId,
      },
      body: '{}',
    })
    if (!res.ok) {
      throw new Error(`查询豆包转写结果失败：${res.headers.get('X-Api-Message') || res.status}`)
    }
    const data = await res.json().catch(() => ({}))
    // 文档：result 字段"识别成功后返回"，还没出现就说明还在处理中
    if (data.result) {
      return data.result as DoubaoQueryResult
    }
  }
  throw new Error('豆包转写超时，请稍后重试')
}

function parseSpeaker(u: DoubaoUtterance): string {
  const candidate = u.speaker ?? u.speaker_id ?? u.additions?.speaker ?? u.additions?.speaker_id
  return candidate === undefined ? '0' : String(candidate)
}

export const doubaoProvider: ASRProvider = {
  name: 'doubao',
  async transcribe({ buffer, fileName, mimeType, speakerCount }) {
    const apiKey = getApiKey()
    const format = detectFormat(fileName)

    const audioUrl = await uploadAndGetUrl(buffer, fileName, mimeType)
    const requestId = await submitTask(apiKey, audioUrl, format, speakerCount)
    const result = await pollTask(apiKey, requestId)

    const utterances = result.utterances ?? []
    if (utterances.length === 0) {
      throw new Error('豆包转写结果为空')
    }

    const segments: RawSegment[] = utterances.map((u) => ({
      speakerTag: parseSpeaker(u),
      start: u.start_time / 1000,
      end: u.end_time / 1000,
      text: u.text,
    }))
    return mergeConsecutiveSegments(segments)
  },
}
