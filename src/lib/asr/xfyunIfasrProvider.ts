import crypto from 'crypto'
import type { ASRProvider, RawSegment } from './types'

/**
 * 讯飞"录音文件转写大模型"接入
 * 文档: https://www.xfyun.cn/doc/spark/asr_llm/Ifasr_llm.html
 * 需要环境变量: XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET
 */

const BASE_URL = 'https://office-api-ist-dx.iflyaisol.com'

interface XfyunEnv {
  appId: string
  accessKeyId: string
  accessKeySecret: string
}

function getEnv(): XfyunEnv {
  const appId = process.env.XFYUN_APP_ID
  const accessKeyId = process.env.XFYUN_API_KEY
  const accessKeySecret = process.env.XFYUN_API_SECRET
  if (!appId || !accessKeyId || !accessKeySecret) {
    throw new Error('未配置讯飞转写引擎：请设置 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET')
  }
  return { appId, accessKeyId, accessKeySecret }
}

function nowDateTime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const tzOffsetMin = -d.getTimezoneOffset()
  const sign = tzOffsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(tzOffsetMin)
  const tz = `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tz}`
}

function randomString(len = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/**
 * 讯飞签名示例代码用的是 Java URLEncoder.encode，和 JS encodeURIComponent 不完全一样：
 * 空格要编码成 "+"（而不是 %20），"! ~ ' ( )" 这几个字符也要编码（JS 默认不编码）。
 * fileName 常带空格，编码方式不一致会导致签名校验不通过，所以单独处理。
 */
function javaUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!~'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

/** 按讯飞签名规则：剔除空值，按 key 自然排序，URL 编码后拼接，再 HmacSHA1 + base64 */
function sign(params: Record<string, string>, accessKeySecret: string): string {
  const baseString = Object.keys(params)
    .filter((k) => k !== 'signature' && params[k] !== '' && params[k] != null)
    .sort()
    .map((k) => `${k}=${javaUrlEncode(params[k])}`)
    .join('&')
  return crypto.createHmac('sha1', accessKeySecret).update(baseString, 'utf8').digest('base64')
}

function buildUrl(path: string, params: Record<string, string>): string {
  const qs = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] != null)
    .map((k) => `${k}=${javaUrlEncode(params[k])}`)
    .join('&')
  return `${BASE_URL}${path}?${qs}`
}

async function upload(env: XfyunEnv, input: { buffer: Buffer; fileName: string }): Promise<string> {
  const params: Record<string, string> = {
    appId: env.appId,
    accessKeyId: env.accessKeyId,
    dateTime: nowDateTime(),
    signatureRandom: randomString(),
    fileSize: String(input.buffer.length),
    fileName: input.fileName,
    durationCheckDisable: 'true',
    language: 'autodialect',
    roleType: '1',
  }
  const signature = sign(params, env.accessKeySecret)
  const url = buildUrl('/v2/upload', params)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', signature },
    body: new Uint8Array(input.buffer),
  })
  const data = await res.json()
  if (String(data.code) !== '000000') {
    throw new Error(`讯飞上传失败：${data.descInfo || data.code}`)
  }
  return data.content.orderId as string
}

async function getResult(env: XfyunEnv, orderId: string): Promise<any> {
  const params: Record<string, string> = {
    accessKeyId: env.accessKeyId,
    dateTime: nowDateTime(),
    signatureRandom: randomString(),
    orderId,
    resultType: 'transfer',
  }
  const signature = sign(params, env.accessKeySecret)
  const url = buildUrl('/v2/getResult', params)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', signature },
    body: '{}',
  })
  const data = await res.json()
  if (String(data.code) !== '000000') {
    throw new Error(`讯飞查询失败：${data.descInfo || data.code}`)
  }
  return data.content
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** orderResult 是一段被转义过的 JSON 字符串，内部 json_1best 又是一层 JSON 字符串 */
function parseOrderResult(orderResult: string): RawSegment[] {
  const parsed = JSON.parse(orderResult) as { lattice: { json_1best: string }[] }
  return parsed.lattice.map((item) => {
    const best = JSON.parse(item.json_1best)
    const st = best.st
    const words: string[] = []
    for (const rt of st.rt || []) {
      for (const ws of rt.ws || []) {
        const w = ws.cw?.[0]?.w
        if (w) words.push(w)
      }
    }
    return {
      speakerTag: st.rl || '1',
      start: Number(st.bg) / 1000,
      end: Number(st.ed) / 1000,
      text: words.join(''),
    }
  })
}

export const xfyunIfasrProvider: ASRProvider = {
  name: 'xfyun-ifasr-llm',
  async transcribe({ buffer, fileName }) {
    const env = getEnv()
    const orderId = await upload(env, { buffer, fileName })

    const maxAttempts = 60 // 最长等待 3 分钟
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(3000)
      const content = await getResult(env, orderId)
      const status = content.orderInfo?.status
      if (status === 4) {
        return parseOrderResult(content.orderResult)
      }
      if (status === -1) {
        throw new Error(`讯飞转写失败（failType=${content.orderInfo?.failType}）`)
      }
    }
    throw new Error('讯飞转写超时，请稍后重试')
  },
}
