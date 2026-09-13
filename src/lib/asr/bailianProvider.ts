import { randomUUID } from 'crypto'
import type { ASRProvider, RawSegment } from './types'
import { mergeConsecutiveSegments } from './mergeSegments'

/**
 * 阿里云百炼（DashScope）Paraformer 录音文件识别，带说话人分离。
 * 文档：
 * - https://help.aliyun.com/zh/model-studio/get-temporary-file-url
 * - https://help.aliyun.com/zh/model-studio/paraformer-recorded-speech-recognition-restful-api
 *
 * 这个接口不接受直接上传文件，只认"公网可访问的URL"，所以要先把本地音频
 * 传到百炼给的临时存储换一个 oss:// 链接，再拿这个链接提交转写任务。
 * 需要环境变量 DASHSCOPE_API_KEY。
 */

const BASE_URL = 'https://dashscope.aliyuncs.com'
const MODEL = 'paraformer-v2'

function getApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY
  if (!key) throw new Error('未配置百炼引擎：请设置 DASHSCOPE_API_KEY 环境变量')
  return key
}

interface UploadPolicy {
  policy: string
  signature: string
  upload_dir: string
  upload_host: string
  oss_access_key_id: string
  x_oss_object_acl: string
  x_oss_forbid_overwrite: string
}

async function getUploadPolicy(apiKey: string): Promise<UploadPolicy> {
  const res = await fetch(`${BASE_URL}/api/v1/uploads?action=getPolicy&model=${MODEL}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`获取百炼上传凭证失败：${data.message || res.status}`)
  }
  return data.data
}

/** 文件名用随机串代替原名，避开中文/空格在 OSS key 里可能引发的编码问题 */
async function uploadToOss(policy: UploadPolicy, buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : ''
  const key = `${policy.upload_dir}/${randomUUID()}${ext}`

  const formData = new FormData()
  formData.append('OSSAccessKeyId', policy.oss_access_key_id)
  formData.append('policy', policy.policy)
  formData.append('Signature', policy.signature)
  formData.append('key', key)
  formData.append('x-oss-object-acl', policy.x_oss_object_acl)
  formData.append('x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite)
  formData.append('success_action_status', '200')
  // file 必须是最后一个表单域
  formData.append('file', new Blob([new Uint8Array(buffer)]), fileName)

  const res = await fetch(policy.upload_host, { method: 'POST', body: formData })
  if (!res.ok) {
    throw new Error(`上传音频到百炼临时存储失败（HTTP ${res.status}）`)
  }
  return `oss://${key}`
}

async function submitTask(apiKey: string, ossUrl: string, speakerCount?: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/services/audio/asr/transcription`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
      // oss:// 临时链接需要这个头，官方文档里有写（虽然标了"不推荐"，但个人使用场景够用）
      'X-DashScope-OssResourceResolve': 'enable',
    },
    body: JSON.stringify({
      model: MODEL,
      input: { file_urls: [ossUrl] },
      parameters: {
        channel_id: [0],
        diarization_enabled: true,
        language_hints: ['zh'],
        // 说话人数量只是"参考值"，能辅助算法但不保证一定输出这个人数
        ...(speakerCount ? { speaker_count: speakerCount } : {}),
      },
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.output?.task_id) {
    throw new Error(`提交百炼转写任务失败：${data.message || res.status}`)
  }
  return data.output.task_id as string
}

async function pollTask(apiKey: string, taskId: string): Promise<string> {
  const maxAttempts = 200 // 最长等待 10 分钟
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const data = await res.json()
    const status = data.output?.task_status

    if (status === 'SUCCEEDED') {
      const result = data.output.results?.[0]
      if (!result?.transcription_url) {
        throw new Error(`百炼转写失败：${result?.message || result?.code || '未知错误'}`)
      }
      return result.transcription_url as string
    }
    if (status === 'FAILED') {
      throw new Error('百炼转写任务失败')
    }
    // PENDING / RUNNING 继续轮询
  }
  throw new Error('百炼转写超时，请稍后重试')
}

interface BailianSentence {
  begin_time: number
  end_time: number
  text: string
  speaker_id?: number
}

export const bailianProvider: ASRProvider = {
  name: 'bailian',
  async transcribe({ buffer, fileName, speakerCount }) {
    const apiKey = getApiKey()

    const policy = await getUploadPolicy(apiKey)
    const ossUrl = await uploadToOss(policy, buffer, fileName)
    const taskId = await submitTask(apiKey, ossUrl, speakerCount)
    const transcriptionUrl = await pollTask(apiKey, taskId)

    const resultRes = await fetch(transcriptionUrl)
    if (!resultRes.ok) {
      throw new Error(`下载百炼转写结果失败（HTTP ${resultRes.status}）`)
    }
    const result = await resultRes.json()
    const sentences: BailianSentence[] = result.transcripts?.[0]?.sentences ?? []

    const segments: RawSegment[] = sentences.map((s) => ({
      speakerTag: String(s.speaker_id ?? 0),
      start: s.begin_time / 1000,
      end: s.end_time / 1000,
      text: s.text,
    }))
    return mergeConsecutiveSegments(segments)
  },
}
