import type { ASRProvider } from './types'

/**
 * 占位识别引擎：还没有接入真实的语音识别 API 时，
 * 用它跑通"上传 -> 转录 -> 编辑说话人/文字 -> 导出 Markdown"的完整流程。
 * 接入真实引擎时，实现同样的 ASRProvider 接口，并在 ./index.ts 里注册即可替换。
 */
export const mockProvider: ASRProvider = {
  name: 'mock',
  async transcribe({ fileName }) {
    return [
      {
        speakerTag: '1',
        start: 0,
        end: 4,
        text: `这是示例转录内容，尚未配置真实语音识别引擎（文件：${fileName}）。`,
      },
      {
        speakerTag: '2',
        start: 4,
        end: 9,
        text: '接入真实引擎：在 src/lib/asr 下新增实现 ASRProvider 接口的文件，并在 index.ts 的 providers 里注册，再设置环境变量 ASR_PROVIDER 即可切换。',
      },
      {
        speakerTag: '1',
        start: 9,
        end: 14,
        text: '在此之前，可以先用这份示例数据体验修改说话人、编辑文字和导出 Markdown。',
      },
    ]
  },
}
