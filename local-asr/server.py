"""
纯本地语音识别服务：阿里达摩院开源的 FunASR
（Paraformer 识别 + fsmn-vad 断句 + ct-punc 标点 + cam++ 说话人分离）

不依赖任何云端 API，全程本地推理。跟 Next.js 项目是完全独立的两个进程，
靠 HTTP 通信：Next.js 的 localFunasrProvider 把音频文件 POST 到这里的
/transcribe 接口，这里跑完模型把分好段、分好说话人的结果返回回去。

用法见同目录 README.md。
"""

import os
import tempfile

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from funasr import AutoModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# VAD 按停顿断句，同一个人说话中间只要停顿久一点就会被拆成好几句。
# 这里把连续的、说话人相同的句子合并成一段——不管中间停顿多久，
# 只要没换人，就还是算这个人的一段发言。
def merge_consecutive(sentence_info):
    if not sentence_info:
        return []
    merged = [dict(sentence_info[0])]
    for item in sentence_info[1:]:
        prev = merged[-1]
        if item.get("spk") == prev.get("spk"):
            prev["text"] += item.get("text", "")
            prev["end"] = item.get("end", prev["end"])
        else:
            merged.append(dict(item))
    return merged


print("正在加载 FunASR 模型（首次运行会自动下载，可能需要几分钟）...")
model = AutoModel(
    model="paraformer-zh",
    vad_model="fsmn-vad",
    punc_model="ct-punc",
    spk_model="cam++",
    disable_update=True,
)
print("模型加载完成，本地识别服务已就绪：http://127.0.0.1:8001")


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result = model.generate(input=tmp_path, batch_size_s=300)
        segments = []

        if result and "sentence_info" in result[0]:
            # 开了 spk_model 之后，FunASR 会把结果按句子拆好，
            # 每句带 start/end（毫秒）和 spk（说话人编号）
            for item in merge_consecutive(result[0]["sentence_info"]):
                segments.append(
                    {
                        "speakerTag": str(item.get("spk", 0)),
                        "start": item.get("start", 0) / 1000,
                        "end": item.get("end", 0) / 1000,
                        "text": item.get("text", ""),
                    }
                )
        elif result:
            # 兜底：拿不到分句/分说话人信息时，整段作为一句返回
            segments.append(
                {
                    "speakerTag": "0",
                    "start": 0,
                    "end": 0,
                    "text": result[0].get("text", ""),
                }
            )

        return {"segments": segments}
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8001)
