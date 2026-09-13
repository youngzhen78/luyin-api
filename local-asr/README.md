# 本地识别服务（FunASR）

阿里达摩院开源的 FunASR：Paraformer 语音识别 + cam++ 说话人分离，全程本地推理，
不发任何请求到云端。跟上层的 Next.js 项目是两个独立进程，靠 HTTP 通信。

## 安装

建议用虚拟环境，避免跟系统 Python 环境打架：

```bash
cd local-asr
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 启动

```bash
python server.py
```

**首次启动会自动下载模型**（VAD、Paraformer、标点、说话人分离，加起来大概 1GB
左右），需要几分钟，模型会缓存在 `~/.cache/modelscope`，以后启动就很快了。

看到这行说明启动成功：

```
模型加载完成，本地识别服务已就绪：http://127.0.0.1:8001
```

这个终端窗口要一直开着，跟 `npm run dev` 一样常驻，不要关掉。

## 跟主项目的关系

`npm run dev` 跑起来的 Next.js 项目里，详情页转写的时候选"本地识别"，
会把音频转发给这个服务处理；选"云端识别"走的还是讯飞的接口，两条路径互不影响，
这个服务不启动完全不影响云端识别正常使用。

## 排查

- 详情页点"本地识别"提示连不上服务：确认这个终端窗口还在跑，端口是 8001。
- 想换端口：改 `server.py` 最后一行的 `port=8001`，同时在 Next.js 项目的
  `.env.local` 里加一行 `LOCAL_ASR_URL=http://127.0.0.1:换成新端口`。
