# 启动说明

## 平时怎么跑起来

只用云端识别（讯飞/百炼）的话，只需要一个终端窗口：

```bash
cd ~/luyin-api
npm run dev
```

打开 http://localhost:3000

**想用本地识别**（不联网、用阿里 FunASR）才需要再开一个终端窗口：

```bash
cd ~/luyin-api/local-asr
export KMP_DUPLICATE_LIB_OK=TRUE
export OMP_NUM_THREADS=1
python server.py
```

不用本地识别的话，这个窗口可以不开，不影响讯飞/百炼正常使用。

## 怎么停止

对应终端窗口按 `Ctrl+C`。

## 更新代码

有新功能推送过来时：

```bash
cd ~/luyin-api
git pull
```

**改了代码或 `.env.local` 之后必须重启** `npm run dev`（Ctrl+C 停掉再重新跑），Next.js 不会自动感知这些变化。

## `.env.local` 不用重新配置

密钥（讯飞、百炼）已经配置在 `~/luyin-api/.env.local` 里了，这个文件不会因为 `git pull` 或重启而丢失，正常情况不用管它。只有换新电脑/重新克隆仓库时才需要照着 `.env.local.example` 重新填一份。

## 常见问题

**浏览器显示"无法访问此网站 / ERR_CONNECTION_REFUSED"**
说明 `npm run dev` 没在跑。确认对应终端窗口是不是被关掉了，重新执行 `npm run dev`。

**改了代码但网页没变化，或者报 `Cannot find module './vendor-chunks/next.js'` 之类的错**
构建缓存坏了，清一下重启：

```bash
cd ~/luyin-api
rm -rf .next
npm run dev
```

**报错 `EADDRINUSE` 或者启动一半失败，怀疑端口被占用**

```bash
lsof -ti:3000 | xargs kill -9   # 网页服务用的3000端口
lsof -ti:8001 | xargs kill -9   # 本地识别服务用的8001端口
```

杀掉之后重新启动对应服务。

**点"本地识别"提示连不上本地识别服务**
确认 `local-asr/server.py` 那个窗口还开着、显示的是"本地识别服务已就绪"而不是报错退出。
