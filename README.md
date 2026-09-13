# 录音API

中文语音转文字工具：上传录音 → 讯飞"录音文件转写大模型"识别（自动区分发言人）→ 手动修改文字/发言人 → 导出 Markdown。

## 启动

```bash
npm install
cp .env.local.example .env.local  # 填入讯飞的 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET
npm run dev
```

打开 http://localhost:3000

## 识别引擎

`ASR_PROVIDER` 环境变量切换：

- `mock`：占位示例数据，用于本地跑通上传-编辑-导出流程，不需要任何密钥
- `xfyun`：讯飞"录音文件转写大模型"真实识别，需要在 [讯飞开放平台](https://www.xfyun.cn/) 申请对应服务的密钥

接入其他识别引擎：在 `src/lib/asr/` 下新增一个实现 `ASRProvider` 接口（见 `src/lib/asr/types.ts`）的文件，并在 `src/lib/asr/index.ts` 的 `providers` 里注册即可。
