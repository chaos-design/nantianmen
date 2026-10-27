# 首屏 LCP 调优记录

[中文](performance-lcp.md) | 开发手册见 [development-guide.md](development-guide.md)

本文记录 `/workspace`、`/editor/<id>`、`/r/<slug>` 三个首屏页面的 LCP 测量口径、
逐轮改动、前后数据，以及**没有通过验证因而撤回**的尝试。每一轮都只在上一轮已入库
的结果之上继续，所有数字都可以用第 6 节的方式复现。

## 1. 测量口径

仓库自带 `scripts/measure-lcp.mjs`（单端口多轮采样）。它的问题在于「先测基线、
再测优化」时，两次测量之间的机器状态会漂移：同一份代码隔十分钟复测，实测能差
150–250 ms（约 10–15%），小改动会被完全淹没。

因此配了 `scripts/measure-lcp-ab.mjs`：两个端口分别跑改动前 / 改动后的构建，
**每轮 A、B 相邻各测一次**，最后比中位数和配对差。本文的对比数据都来自它。

| 项 | 取值 |
| --- | --- |
| 构建 | `pnpm build` + `next start` 的生产产物 |
| 环境 | `RESUME_DATA_BACKEND=file` + 测试身份（`AUTH_TEST_*`），`NODE_ENV=test` |
| 数据 | `scripts/seed-perf-fixtures.mjs` 生成的固定简历：3 页 A4 + 一张 600×800 人像 |
| 视口 | 1280×720，DPR 1 |
| 网络 | `slow4g`（400 ms / 409 kbps），对比时另有 `fast3g`（150 ms / 1638 kbps） |
| CPU | 4× 降速 |
| 缓存 | 每次采样全新上下文 + `Network.setCacheDisabled` |

**口径的两个已知偏差**，读数字时必须一起看：

- `next start` 只跑 HTTP/1.1（生产走 HTTP/2）。HTTP/1 下每域名 6 条连接，样式表要和
  十几个 JS chunk 分同一条 409 kbps 管道，争用被放大；HTTP/2 有优先级树，样式表和
  首屏图不会被脚本排队拖住。所以本文的数字偏悲观，改动之间的**相对差**仍然可信。
- 慢网把「绘制开销」压到网络等待下面。反过来，在 `fast3g` 或不节流的机器上，CPU
  排在关键路径上的部分占比更高（见 2.3）。

## 2. 本轮改动

### 2.1 公开分享页的放置图改走图片优化器（第一轮，已入库）

`/r/<slug>` 在 slow4g 下的 LCP 元素是 A4 上的放置图，不是文字：源图是用户上传的
原图（测试夹具 600×800 JPEG，51 kB），A4 上只按 500×640 显示；首屏还要下载 24 kB
样式与 70 kB（gzip）JS，同一条 409 kbps 的管道上图片排在最后，5.1 s 才下完。

改动：公开快照的放置图统一走 Next 图片优化器（`/_next/image?url=…&w=…&q=75`），
按放置宽度取固定档位，`<head>` 的 `preload` 用同一个地址，保证预载就是实际请求。
同一个夹具：51 kB JPEG → 21 kB WebP。

只给单一地址、不铺 `srcSet`：先试过 `srcSet`（640w / 1080w）+ `sizes`，本地 e2e
出现「图片元素存在但始终没有 `naturalWidth`」——浏览器挑候选的分支一旦和预载地址
对不上就不请求，收益抵不过这个风险，退回单地址。

### 2.2 编辑器的私有资源按显示宽度转码（本轮）

`/editor/<id>` 的 LCP 元素和分享页一样是 A4 上的放置图，但它走不了公开优化器：
优化器以服务端身份去取源图，拿不到用户会话，私有资源会 401。

改动落在资源路由自己身上：`GET /api/resumes/<id>/assets/<id>?w=<档位>`

- **鉴权不变**：仍然先 `getPrivateAsset(resumeId, assetId, actor)`，转码只是「拿到
  字节之后」的一步，不存在为了转码放宽权限的路径。
- **只用白名单档位**（320 / 480 / 640 / 960 / 1280）。任意宽度都接受等于把一个
  公开的缩放放大器放进服务端；非法值直接回落到原图。
- **不放大**：`resize({ width, withoutEnlargement: true })`。夹具原图只有 600 宽，
  请求 1280 档位时输出仍是 600×800，只是重编码成 WebP。
- **先按 EXIF 摆正**（`rotate()`）：浏览器对原图会自动应用 EXIF 方向，转码之后这层
  兜底就没了，必须在服务端补，否则竖拍照片会躺倒。
- **只转位图**（jpeg / png / webp / avif / heic）。GIF 会在转码里丢掉后续帧，SVG
  本来就是矢量，两者都直接下发原图。
- **sharp 是 optionalDependency**：部署环境装不上原生二进制时 `import` 会失败，
  这里捕获后返回 `null`，路由回落到原图，不会 500。
- **进程内 FIFO 缓存**（96 条，键 = `资源 id @ 档位`）。资源 id 是一次上传生成一次的
  uuid、永不复用，所以不存在「同一 id 换了内容」的失效问题；丢缓存最多多转一次。

客户端跟着改：`src/shared/resume-image.ts` 里的档位表被图片层、预载和路由三处共用
（三处各写一套必然出现「预载地址 ≠ 实际请求」而多下一份）。图片层用**已提交的**
`placement.width` 取档，不用拖拽中的瞬时宽度——后者会在一次缩放手势里变出好几个 URL，
每帧触发重新下载。

实测同一夹具：51,133 B JPEG → 26,628 B WebP（−48%）；按 480 档位是 10,508 B。

### 2.3 工作台标题栏的背景模糊只在滚动后启用（本轮）

`/workspace` 的 LCP 是标题文字，`backdrop-filter: blur(18px)` 挂在 sticky 标题栏上，
未滚动时它背后只是本页顶部的平滑渐变——模糊一个渐变和原图几乎一样，却要多一次全宽
backdrop 采样和一个合成图层。

改动：把 `backdrop-filter` 移到 `.workspace-header[data-scrolled="true"]`。滚动后背后
才是真正的内容，模糊在那一刻才有意义，而那时标题栏早已离开首屏。

验证方式与结论要分开说：

- 视觉：与改动前逐像素比对，`/workspace` 桌面与移动端差异通道 **0.000%**（最大通道差
  2，压缩噪声级），`/r` 完全一致。
- 绘制开销：在同一套节流参数下把 CSS 从内存直接回放（不经过网络），LCP 中位
  **1384 ms → 1072 ms（−312 ms，−23%）**——这 312 ms 就是模糊的绘制成本。
- 但在 slow4g 的真实网络 A/B 里，这点绘制成本被网络等待盖住，**没有测出显著变化**
  （见第 4 节）。所以它没有被算进本轮的提升数据，只在 `fast3g` / 真实 HTTP/2 这类
  「网络不再是绝对瓶颈」的场景里兑现。

## 3. 撤回 / 未通过的尝试

- **`experimental.inlineCss`**：想用它把渲染阻塞的样式表请求彻底去掉。实测 Next 15.5
  的实现在这里把**全站 CSS** 都内联进每个页面：`/workspace` 的 HTML 从 39 kB 涨到
  252 kB，`/editor` 从 128 kB 涨到 451 kB。409 kbps 下光是 HTML 就要 5–9 s，方向
  直接相反，已撤回，`next.config.ts` 保持原样。
- **工作台「新建简历」弹窗按需加载**（上一轮）：拆成独立模块 + `next/dynamic`
  （`ssr: false`），预期把 Radix Dialog 从首屏 chunk 里摘出去。实测 `/workspace`
  首屏 JS 只从 184.0 kB 降到 183.8 kB——Radix 原语同时被工作台其它组件用着，webpack
  仍把它留在共享 chunk 里。净收益 0.2 kB，不值得多三个文件，已撤回。
- **非首屏 A4 分页 `content-visibility: auto`**（上一轮）：A/B 无收益且增加排版抖动。

## 4. 数据对比

### 4.1 本轮（`ab-final`，9 轮配对，slow4g）

| 页面 | 改动前 LCP（中位 / 区间） | 改动后 LCP（中位 / 区间） | 变化 | 配对中位差 |
| --- | --- | --- | --- | --- |
| `/workspace` | 2720 ms（2616–2952） | 2844 ms（2576–3380） | +4.6%（噪声） | +52 ms |
| `/editor/<id>` | 5660 ms（5604–5664） | **3456 ms（3376–3532）** | **−38.9%** | **−2200 ms** |
| `/r/<slug>` | 2948 ms（2872–3112） | 2920 ms（2888–3028） | −0.9%（噪声） | −8 ms |

`/editor` 的前后区间不重叠，配对差 −2200 ms，量级和「51 kB → 26.6 kB」的字节变化
一致，不是抖动。另两个页面本轮没有针对性的字节改动，落在噪声内。

### 4.2 两轮累计（相对 `main` 在本轮开始前的状态）

| 页面 | 起点 | 现在 | 变化 |
| --- | --- | --- | --- |
| `/r/<slug>` | 5152 ms | ~2920 ms | **−43%** |
| `/editor/<id>` | 5660 ms | ~3456 ms | **−39%** |
| `/workspace` | 2720 ms | ~2844 ms | 无变化（见第 5 节的下限分析） |

## 5. `/workspace` 的下限在哪里

这个页面的 LCP 元素是标题文字，形状和另外两个不同：它不加载任何图片，等的是
「HTML + 样式表 + 主线程空闲」。本轮把它的下限测了出来（同样 slow4g / 4× CPU）：

| 场景 | LCP 中位 |
| --- | --- |
| 阻断全部 `_next/static/chunks/*` 请求（只剩 HTML + CSS） | **2060 ms** |
| 正常 | 2732 ms |
| 阻断 85 kB「仅交互需要」的 chunk（Radix 两个 + sonner + 四个杂项） | 2856 ms |

三条结论：

1. **框架 JS 占掉约 670 ms**，而这 184 kB（gzip）里 98.8 kB 是 React / ReactDOM /
   Next 客户端运行时本身，剩下的是 Radix 原语（35 kB）、sonner（10 kB）和页面代码。
   没有「不水合也能首屏」的选项，这部分是架构基线。
2. **逐块拆 JS 不划算**：把 85 kB 的交互型 chunk 全阻断，LCP 反而在噪声内（2856 ms）。
   也就是说这些 chunk 并不是排队卡住样式表的元凶——真正的影响来自**总请求数**和
   主线程解析，而它们在 HTTP/2 下会被优先级树摊平（见第 1 节的口径偏差）。
3. **剩下 2060 ms 是 HTML（8.9 kB gzip）+ 两份样式表（19.8 kB gzip）+ 2 个 RTT +
   绘制**。要再往下压，只能动样式表体积（Tailwind 工具类被全站共享，拆到路由的收益
   只有几 kB）或让它不再阻塞首屏（`inlineCss` 已证明方向相反），两者都不划算。

所以这个页面停在「架构基线 + 内容本身」，没有继续硬凑。`/r` 与 `/editor` 的收益
来自真正可省的字节（图片从 51 kB 降到 21 / 26.6 kB），两者性质不同。

## 6. 复查方式

```bash
pnpm build
# 改动前：把当前 HEAD 复制一份到 /tmp/nm-b 并构建，或用 git stash 前的构建产物
# 两个端口都指向同一份 file 后端与同一批夹具
node scripts/seed-perf-fixtures.mjs http://127.0.0.1:3210

node scripts/measure-lcp-ab.mjs \
  --a http://127.0.0.1:3211 --b http://127.0.0.1:3210 \
  --runs 9 --net slow4g
```

结果落在 `.data/perf/results/lcp-ab-*.json`。单端口多轮采样用
`scripts/measure-lcp.mjs`。

私有资源的转码可以单独验：

```bash
curl -s -o /dev/null -w "%{size_download} %{content_type}\n" \
  "http://127.0.0.1:3210/api/resumes/<resume-id>/assets/<asset-id>"          # 51133 image/jpeg
curl -s -o /dev/null -w "%{size_download} %{content_type}\n" \
  "http://127.0.0.1:3210/api/resumes/<resume-id>/assets/<asset-id>?w=640"    # 26628 image/webp
curl -s -o /dev/null -w "%{size_download} %{content_type}\n" \
  "http://127.0.0.1:3210/api/resumes/<resume-id>/assets/<asset-id>?w=700"    # 51133 image/jpeg（非法档位回落）
```
