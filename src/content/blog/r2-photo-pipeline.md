---
title: "R2 之后，给照片一条更直的水路"
description: "一次把 NAS 图床迁到 R2，又把多余发布脚本和图片派生管线删掉的短记。"
date: 2026-06-26
updated: 2026-06-26
tags:
  - note
  - infra
  - gallery
cover: https://file.getschwifty.me/2026/06/1782475604803-1jg2wd3d.webp
coverAlt: 深色终端界面与 Linux 桌面壁纸。
draft: false
---

以前把 NAS 直接暴露成图床，看起来很像“我有自己的海底机房”。真正跑起来之后，它更像一根没有缓冲层的潜水管：图片慢，隧道偶尔断，页面也会跟着失去呼吸。

Rapture 需要的是另一种结构：图片 URL 稳定，元数据清楚，发布链路尽量短。于是我把公开图片放到 R2，让站点继续保持静态，把 NAS 留在更适合它的位置。

## 迁移之后

新的约定很简单：`src` 就是唯一图片地址。列表、搜索、feed、详情页和 FULL FRAME 都从同一个字段读取，不再维护第二套图片字段，也不再让本地脚本替我生成内容。

这条规则减少了很多“看起来聪明但实际用不到”的维护成本。内容入口只剩 Markdown 和 frontmatter，站点负责展示，图床负责可访问。

### 一张图片，一条路径

现在一张照片进入相册时，我只需要在 Obsidian 或编辑器里维护一个条目：

```md
---
title: "Frame title"
location: "Shanghai"
date: 2026-06-26
src: "https://file.getschwifty.me/rapture/gallery/frame.webp"
width: 1600
height: 1067
tone: "cyan rain under brass light"
draft: false
---
```

## 给未来的自己

不要把个人站做成一套沉重后台。它最迷人的地方，是仍然像一本可以被 Git 追踪的手账：Markdown 是内容，R2 是橱窗，Vercel 是灯，浏览器只是把它们照亮。

Rapture 不需要知道我的所有设备在哪里。它只需要在访客抵达时，把水压、文字和光稳定地交出来。
