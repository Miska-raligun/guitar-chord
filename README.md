# 吉他和弦练习

一个运行在浏览器里的吉他工具集，无需安装、无需后端、支持离线使用（PWA）。

## 功能

### 和弦识别
麦克风实时采集 → FFT 色度图 → 余弦相似度匹配，显示置信度最高的 Top 3 候选和弦。不依赖任何音频识别服务，全部在浏览器本地运算。

### 和弦浏览
12 个根音 × 63 种和弦类型（major / minor / 7 / maj7 / m7 / sus2 / sus4 / dim / aug / add9 …），展示标准指法图并支持多把位切换。可选四种节奏型（民谣 / 切音 / 古典 / 扫弦）和自定义 BPM，点击播放分解和弦，弦位实时高亮动画。

### 指板探索
6 弦 × 25 品完整指板，横向 / 竖向两种布局。按所选调性高亮根音（琥珀色）、调内音（亮色）、调外音（暗色），并标注唱名（Do / Re / Mi …）和数字音名。点击任意格子发音。

### 编曲台
- 最多 16 小节的和弦进行 + 旋律轨（16 分音符精度）
- 支持 4/4、3/4、6/8、2/4 拍号
- 四种节奏型 + 自定义 BPM，Web Audio API 精确调度，循环播放
- **AI 一键生成**：输入风格描述，调用 OpenAI 兼容接口或 Anthropic 接口生成完整编曲，预览确认后再应用
- 曲库：命名保存到 localStorage，支持导出为 JSON 文件、从文件导入

## 本地运行

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
npm run preview
```

## AI 功能配置

在「编曲台 → AI 创作 → API 配置」中填入：

| 字段 | 说明 |
|------|------|
| Provider | `openai`（兼容接口）或 `anthropic` |
| API Key | 对应平台的密钥 |
| Base URL | OpenAI 填 `https://api.openai.com`，兼容代理填代理地址 |
| Model | 例如 `gpt-4o-mini`、`claude-haiku-4-5-20251001` |

配置只保存在本地浏览器（localStorage），不会上传到任何服务器。API 请求直接从浏览器发出。

## 技术实现

| 模块 | 方案 |
|------|------|
| 前端框架 | Vite + React 18 + TypeScript |
| 样式 | Tailwind CSS v3，深色主题 |
| 和弦数据 | `@tombatossals/chords-db`（756 个指法） |
| 指法图渲染 | `@techies23/react-chords` |
| 音频合成 | 原生 Web Audio API + Karplus-Strong 算法（离线计算，无第三方音频库） |
| 和弦识别 | FFT 色度图（12-bin chromagram）+ 余弦相似度匹配预计算模板 |
| 编曲调度 | Web Audio `currentTime` lookahead 调度器（25 ms 轮询，100 ms 预调度） |
| PWA | `vite-plugin-pwa`，支持离线缓存 |

## 项目结构

```
src/
├── audio/
│   ├── AudioEngine.ts       # 单例 AudioContext
│   ├── chromagram.ts        # FFT → 12-bin 色度图
│   ├── chordDetector.ts     # 色度图 → 余弦匹配 → ChordMatch[]
│   └── karplusStrong.ts     # Karplus-Strong 弦乐合成
├── data/
│   └── chordTemplates.ts    # 预计算 756 个和弦模板
├── hooks/
│   ├── useRecognizer.ts     # 麦克风 → 实时识别
│   ├── useArpeggio.ts       # 分解和弦播放调度
│   ├── useChordDb.ts        # 和弦数据库访问
│   ├── useSequencer.ts      # 编曲台核心调度器
│   ├── useAiCompose.ts      # AI 生成（OpenAI / Anthropic）
│   └── useSavedCompositions.ts  # 曲库 CRUD + 导入导出
├── components/
│   ├── layout/              # Header、TabBar
│   ├── recognize/           # 识别 Tab
│   ├── browse/              # 浏览 Tab
│   ├── fretboard/           # 指板 Tab
│   ├── compose/             # 编曲台 Tab
│   └── ui/                  # 通用图标
└── types/
    ├── audio.ts             # ChordMatch、ChordSlot、SequencerState …
    └── compose.ts           # ApiConfig、SavedComposition …
```
