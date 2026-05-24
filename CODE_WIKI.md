# Animated Image Creator — Code Wiki

---

## 目录

1. [项目概述](#1-项目概述)
2. [项目结构](#2-项目结构)
3. [整体架构](#3-整体架构)
4. [运行与构建](#4-运行与构建)
5. [依赖关系](#5-依赖关系)
6. [入口文件详解](#6-入口文件详解)
7. [类型与常量模块](#7-类型与常量模块)
8. [工具模块](#8-工具模块)
   - [8.1 format.ts](#81-formatts)
   - [8.2 apng-detector.ts](#82-apng-detectorts)
   - [8.3 apng-parser.ts](#83-apng-parserts)
   - [8.4 render-frames.ts](#84-render-framests)
   - [8.5 webp-assembler.ts](#85-webp-assemblerts)
9. [组件模块](#9-组件模块)
   - [9.1 App.tsx —— 主应用组件](#91-apptsx--主应用组件)
   - [9.2 EditModal.tsx —— 帧编辑器](#92-editmodaltsx--帧编辑器)
   - [9.3 ErrorBoundary.tsx —— 错误边界](#93-errorboundarytsx--错误边界)
10. [自定义 Hooks](#10-自定义-hooks)
11. [样式系统](#11-样式系统)
12. [配置文件](#12-配置文件)
13. [数据流全景](#13-数据流全景)
14. [关键设计决策](#14-关键设计决策)
15. [工程化规范](#15-工程化规范)

---

## 1. 项目概述

**Animated Image Creator** 是一个纯前端的 Web 应用，允许用户在浏览器中将静态图片（PNG/JPG/WebP）合成为 **APNG（动态PNG）** 和 **WebP动画** 文件。所有图像处理完全在客户端进行，无需上传到任何服务器，保证隐私安全。

### 核心能力

| 能力 | 说明 |
|------|------|
| 图片导入 | 支持拖拽/点击上传 PNG、JPG、WebP、APNG 文件 |
| APNG 导出 | 生成高质量无损动态PNG，可调节压缩等级 (0-9) |
| WebP 导出 | 生成高效压缩的动画 WebP，可调节质量 (10%-100%) |
| 帧编辑 | 对每帧独立调整平移、缩放 (0.01x-20x)、旋转 (-180°~180°) |
| 智能对齐 | 自动以 Cover 模式缩放帧，填满画布无黑边 |
| 帧排序 | 拖拽调整帧顺序 |
| 主题切换 | 日间/暗黑双模式 |
| APNG 导入 | 解析已有 APNG 文件并提取各帧 |
| 错误容错 | Error Boundary 捕获渲染异常，显示友好回退界面 |
| 代码质量 | ESLint 零警告、TypeScript strict 模式、零 `any` 类型 |

---

## 2. 项目结构

```
Animated-Image-Creator/
├── index.html                     # HTML 入口 (SPA 挂载点)
├── package.json                   # 项目元数据与依赖声明
├── eslint.config.js               # ESLint v10 flat config
├── vite.config.ts                 # Vite 构建配置
├── tsconfig.json                  # TypeScript 编译配置 (主)
├── tsconfig.node.json             # TypeScript 编译配置 (Vite 专用)
├── .editorconfig                  # 编辑器代码风格统一
├── .gitignore                     # Git 忽略规则
├── .gitattributes                 # Git 属性
├── README.md                      # 项目说明文档
├── log.md                         # 开发日志 (changelog)
└── src/
    ├── main.tsx                   # React 应用入口 (挂载 ErrorBoundary)
    ├── App.tsx                    # 主应用组件 (~468行)
    ├── App.css                    # 组件样式、主题变量、动画
    ├── index.css                  # 全局基础样式
    ├── constants.ts               # 全局命名常量
    ├── vite-env.d.ts              # Vite + upng-js 类型声明
    ├── types/
    │   └── frame.ts               # Frame 和 EditModalProps 接口
    ├── components/
    │   ├── EditModal.tsx           # 帧编辑模态框 (React.memo)
    │   └── ErrorBoundary.tsx       # React Error Boundary
    ├── hooks/
    │   └── useTheme.ts            # 主题切换 Hook
    ├── utils/
    │   ├── format.ts              # formatSize 文件大小格式化
    │   ├── apng-detector.ts       # isAnimatedPNG APNG 检测
    │   ├── apng-parser.ts         # parseAPNG APNG 帧提取
    │   ├── render-frames.ts       # APNG/WebP 共享帧渲染管道
    │   └── webp-assembler.ts      # WebP 容器二进制组装器
    └── images/
        └── pre.png                # 项目预览图
```

---

## 3. 整体架构

```
┌────────────────────────────────────────────────────┐
│                     index.html                     │
│                 <div id="root">                    │
└─────────────────┬──────────────────────────────────┘
                  │ ReactDOM.createRoot()
                  ▼
┌────────────────────────────────────────────────────┐
│                  src/main.tsx                      │
│      <React.StrictMode> → <ErrorBoundary>         │
│                              └→ <App />            │
└─────────────────┬──────────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────────────────────┐
│                    src/App.tsx                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │               App Component (~468行)              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐     │ │
│  │  │ Dropzone │  │Controls  │  │ FrameGrid │     │ │
│  │  │  区域    │  │  操作栏  │  │  帧网格   │     │ │
│  │  └──────────┘  └──────────┘  └─────┬─────┘     │ │
│  │                                     │           │ │
│  │                              ┌──────▼──────┐    │ │
│  │                              │ EditModal   │    │ │
│  │                              │ (独立组件)  │    │ │
│  │                              └─────────────┘    │ │
│  │  ┌──────────────────────────────────────┐       │ │
│  │  │         ResultSection (结果区)        │       │ │
│  │  └──────────────────────────────────────┘       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │              工具 & 类型 & 常量                     │ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ UPNG(upng-js)│  │webp-assembler│              │ │
│  │  │ APNG 编解码  │  │WebP 容器组装 │              │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │render-frames │  │apng-detector │              │ │
│  │  │共享渲染管道  │  │  APNG 检测   │              │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │apng-parser   │  │   format.ts  │              │ │
│  │  │APNG 帧提取   │  │  文件大小格式化│             │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  │  ┌──────────────┐                                │ │
│  │  │ constants.ts │  types/frame.ts                │ │
│  │  │  命名常量    │   接口定义                       │ │
│  │  └──────────────┘                                │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │           ErrorBoundary (容错层)                   │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

**架构特点：**
- **纯前端 SPA**：无后端服务，所有计算在浏览器 Canvas API 上完成
- **双向格式支持**：APNG 和 WebP 两种输出格式共享同一帧渲染管道，仅编码路径不同
- **模块化拆分**：工具函数、类型定义、UI 组件、状态逻辑分别独立管理
- **容错机制**：ErrorBoundary 包裹整个应用，子组件异常不会导致白屏
- **类型安全**：零 `any` 类型，全部接口有精确 TypeScript 声明

---

## 4. 运行与构建

### 环境要求

- Node.js 16+
- npm

### 安装与开发

```bash
git clone https://github.com/UNLINEARITY/Animated-Image-Creator.git
cd Animated-Image-Creator
npm install
npm run dev    # 启动开发服务器 → http://localhost:5173
```

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器，支持 HMR |
| `npm run build` | TypeScript 类型检查 (`tsc`) + Vite 生产构建 |
| `npm run preview` | 预览生产构建结果 |
| `npm run lint` | ESLint 代码质量检查（零警告通过） |
| `npm run deploy` | 构建并部署到 GitHub Pages (`gh-pages` 分支) |

### 构建产物

执行 `npm run build` 后，产物输出到 `dist/` 目录。Vite 配置中 `base: './'` 确保资源使用相对路径，适配 GitHub Pages 等静态托管。典型产物大小：JS ~238 KB (gzip ~77 KB)，CSS ~16 KB (gzip ~3.4 KB)。

---

## 5. 依赖关系

### 运行时依赖 (dependencies)

| 包名 | 版本 | 用途 |
|------|------|------|
| `react` | ^18.2.0 | UI 框架，函数组件 + Hooks |
| `react-dom` | ^18.2.0 | React DOM 渲染 |
| `upng-js` | ^2.1.0 | PNG/APNG 编解码库 |
| `lucide-react` | ^0.562.0 | SVG 图标组件库 |

### 开发依赖 (devDependencies)

| 包名 | 版本 | 用途 |
|------|------|------|
| `typescript` | ^5.2.2 | TypeScript 编译器 |
| `vite` | ^5.2.0 | 构建工具与开发服务器 |
| `@vitejs/plugin-react` | ^4.2.1 | Vite 的 React JSX 转换插件 |
| `@types/react` | ^18.2.66 | React 类型定义 |
| `@types/react-dom` | ^18.2.22 | ReactDOM 类型定义 |
| `eslint` | ^9.0.0 | 代码质量检查 (flat config) |
| `@typescript-eslint/eslint-plugin` | ^8.0.0 | TypeScript ESLint 规则 |
| `@typescript-eslint/parser` | ^8.0.0 | TypeScript ESLint 解析器 |
| `eslint-plugin-react-hooks` | ^5.0.0 | React Hooks 规则 |
| `eslint-plugin-react-refresh` | ^0.4.0 | Vite React Refresh 规则 |
| `gh-pages` | ^6.3.0 | 一键部署到 GitHub Pages |

### 模块依赖图

```
App.tsx
├── react (useState, useRef, useCallback, useEffect)
├── upng-js (UPNG.encode)
├── lucide-react (Upload, Trash2, Clock, Download, ...)
├── ./components/EditModal (React.memo 组件)
├── ./hooks/useTheme (主题切换)
├── ./utils/format (formatSize)
├── ./utils/apng-detector (isAnimatedPNG)
├── ./utils/apng-parser (parseAPNG)
├── ./utils/render-frames (createFrameRenderContext, renderFrameToCanvas)
├── ./utils/webp-assembler (assembleWebP)
├── ./types/frame (Frame 接口)
├── ./constants (DEFAULT_GLOBAL_DELAY, FRAME_ANIMATION_DELAY_STEP, ...)
└── ./App.css

EditModal.tsx
├── react (useRef, useState, useCallback, useEffect, useLayoutEffect)
├── lucide-react (X, ZoomIn, Minus, Plus, RefreshCw, RotateCcw)
├── ../types/frame (EditModalProps)
├── ../constants (ZOOM_MIN, ZOOM_MAX, ZOOM_WHEEL_SENSITIVITY, EDIT_MODAL_PADDING)
└── ../App.css

ErrorBoundary.tsx (零外部依赖，纯 React 类组件)

useTheme.ts (零外部依赖，仅 react hooks)

webp-assembler.ts (零外部依赖，纯 JS 二进制操作)
render-frames.ts (仅依赖 ../types/frame)
format.ts (零外部依赖)
apng-detector.ts (零外部依赖)
apng-parser.ts (依赖 upng-js, ../types/frame)
```

---

## 6. 入口文件详解

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="..." />
    <link rel="icon" href="data:image/svg+xml,..." />
    <title>Animated Image Creator</title>
  </head>
  <body>
    <noscript>JavaScript is required...</noscript>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- `<div id="root">` — React 应用的挂载容器
- `<script type="module">` — ESM 方式加载入口文件
- `<meta name="description">` — SEO 优化
- `<noscript>` — JavaScript 禁用时的友好提示
- favicon 使用内联 SVG emoji (🎬)

### `src/main.tsx`

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
```

- React 18 `createRoot` API
- `ErrorBoundary` 包裹 `<App />` 提供容错保护
- `React.StrictMode` 启用开发时的额外检查

### `src/index.css`

精简后的全局基础样式（已移除与 App.css 冲突的 `color-scheme` 和 `@media (prefers-color-scheme)` 规则）：
- 设置 `font-family` 为 Inter 系列
- 重置 body margin/padding
- 确保 `#root` 全宽全高

---

## 7. 类型与常量模块

### `src/types/frame.ts`

```typescript
export interface Frame {
  id: string;          // 唯一标识 (随机生成)
  file: File;          // 原始图片文件对象
  previewUrl: string;  // 帧缩略图 Blob URL
  delay: number;       // 帧延时 (毫秒)
  width: number;       // 图片原始宽度
  height: number;      // 图片原始高度
  offsetX: number;     // X 轴平移偏移
  offsetY: number;     // Y 轴平移偏移
  scale: number;       // 缩放比例 (默认 1)
  rotation: number;    // 旋转角度 (度数)
  fileSize: number;    // 文件大小 (字节)
  fileType: string;    // 文件类型标签 (PNG/JPG/WEBP)
}

export interface EditModalProps {
  frame: Frame;
  baseWidth: number;
  baseHeight: number;
  onSave: (id: string, x: number, y: number, scale: number, rotation: number) => void;
  onClose: () => void;
}
```

### `src/constants.ts`

所有 Magic Number 集中管理为命名常量：

| 常量 | 值 | 用途 |
|------|-----|------|
| `ZOOM_MIN` | 0.01 | 最小缩放比例 |
| `ZOOM_MAX` | 20 | 最大缩放比例 |
| `ZOOM_WHEEL_SENSITIVITY` | 0.001 | 鼠标滚轮缩放灵敏度 |
| `ROTATION_STEP` | 90 | 旋转步进角度 |
| `FRAME_ANIMATION_DELAY_STEP` | 0.05 | 帧入场动画间隔 (秒) |
| `DEFAULT_GLOBAL_DELAY` | 100 | 默认全局延时 (ms) |
| `DEFAULT_APNG_COMPRESSION` | 0 | 默认 APNG 压缩等级 |
| `DEFAULT_WEBP_QUALITY` | 0.9 | 默认 WebP 质量 |
| `EDIT_MODAL_PADDING` | 40 | 编辑器 Canvas 内边距 |
| `OPACITY_DRAG` | 0.4 | 拖拽中帧卡片透明度 |
| `GRID_SIZE` | 15 | 棋盘格背景格子大小 |

### `src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />

declare module 'upng-js' {
  interface UPNGFrame {
    delay: number;
  }

  interface UPNGDecoded {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: UPNGFrame[];
    tabs: Record<string, Uint8Array>;
  }

  export interface UPNG {
    encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number, dels?: number[]): ArrayBuffer;
    decode(buffer: ArrayBuffer): UPNGDecoded;
    toRGBA8(out: UPNGDecoded): ArrayBuffer[];
  }

  const upng: UPNG;
  export default upng;
}
```

- 所有类型精确声明，**零 `any` 类型**
- `UPNGDecoded` 接口完整描述 `decode()` 返回值结构
- `UPNGFrame` 接口定义帧的 `delay` 属性

---

## 8. 工具模块

### 8.1 `format.ts`

**文件位置**: [src/utils/format.ts](file:///c:/Users/28529/Documents/GitHub/Animated-Image-Creator/src/utils/format.ts)

```typescript
export const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
```

将字节数转换为人类可读格式 (B/KB/MB/GB)。

### 8.2 `apng-detector.ts`

**文件位置**: [src/utils/apng-detector.ts](file:///c:/Users/28529/Documents/GitHub/Animated-Image-Creator/src/utils/apng-detector.ts)

```typescript
export async function isAnimatedPNG(file: File): Promise<boolean>
```

检测 PNG 文件是否为 APNG：
1. 验证 PNG 文件签名 (`0x89504E47` + `0x0D0A1A0A`)
2. 扫描 PNG chunk 结构，在 `IDAT` chunk 之前查找 `acTL` (Animation Control) chunk
3. 找到 `acTL` → APNG；先遇到 `IDAT` → 普通 PNG
4. 搜索范围限制在前 10000 字节内

### 8.3 `apng-parser.ts`

**文件位置**: [src/utils/apng-parser.ts](file:///c:/Users/28529/Documents/GitHub/Animated-Image-Creator/src/utils/apng-parser.ts)

```typescript
export async function parseAPNG(file: File): Promise<Frame[]>
```

解析 APNG 文件并提取所有帧：
1. 调用 `UPNG.decode(buffer)` 解码 APNG
2. 使用 `UPNG.toRGBA8(decoded)` 获取所有帧的 RGBA 数据
3. 对每帧：通过 `ImageData` → Canvas → `toBlob('image/png')` 转换为 PNG Blob
4. 构建 `Frame[]` 数组，保留原始宽高和延时信息

### 8.4 `render-frames.ts`

**文件位置**: [src/utils/render-frames.ts](file:///c:/Users/28529/Documents/GitHub/Animated-Image-Creator/src/utils/render-frames.ts)

APNG 和 WebP 生成流程的**共享渲染管道**，消除 ~90% 重复代码：

#### `createFrameRenderContext(frames: Frame[]): Promise<FrameRenderResult>`

创建帧渲染上下文：
1. `Promise.all` 并行加载所有帧为 `ImageBitmap`
2. 以第一帧尺寸创建 Canvas
3. 返回 `{ canvas, ctx, imageBitmaps, width, height }`

#### `renderFrameToCanvas(ctx, img, frame, width, height): void`

将单帧渲染到 Canvas：
1. `clearRect` 清空画布
2. 应用变换：`translate(cx, cy)` → `rotate(angle)` → `scale(s, s)` → `drawImage(-w/2, -h/2)`
3. 变换顺序确保以图片中心为原点进行旋转和缩放

### 8.5 `webp-assembler.ts`

**文件位置**: [src/utils/webp-assembler.ts](file:///c:/Users/28529/Documents/GitHub/Animated-Image-Creator/src/utils/webp-assembler.ts)

零外部依赖的 WebP 容器二进制构造器，按 [WebP 容器规范](https://developers.google.com/speed/webp/docs/riff_container) 组装。

#### 内部函数

| 函数 | 说明 |
|------|------|
| `uint24(num)` | 编码 3 字节 Little-Endian 整数 |
| `uint32(num)` | 编码 4 字节 Little-Endian 整数 |
| `parseWebP(buffer)` | 解析单帧 WebP 的 Chunk 结构；包含 RIFF 头部验证 |

#### `assembleWebP(frames, width, height): Promise<Blob>`

**核心导出函数**：

**输入**: `{ image: Blob, duration: number }[]`, `width`, `height`

**处理流程**:
1. **输入验证**: 检查空帧数组、无效尺寸
2. **VP8X Chunk**: 扩展头 (ANIMATION + ALPHA flags，画布尺寸)
3. **ANIM Chunk**: 全局动画控制 (透明背景，无限循环)
4. **帧并行解析**: `Promise.all` 并行读取所有帧的 ArrayBuffer 并解析 WebP chunk
5. **ANMF Chunks 顺序组装**: 每帧包裹在 ANMF chunk 中（含偏移、帧尺寸、延时、Flags）
6. **RIFF 容器封装**: 所有部分包裹在 RIFF 容器中

**优化特性**:
- 帧解析并行化（`Promise.all`），顺序组装
- padding 字节复用预定义的 `PADDING_BYTE` 常量
- 编码有效 chunk 数量为零时抛出错误

---

## 9. 组件模块

### 9.1 `App.tsx` —— 主应用组件

**文件位置**: [src/App.tsx](file:///c:/Users/28529/Documents/GitHub/Animated-Image-Creator/src/App.tsx)

应用主组件，约 **468 行**（优化前 853 行）。负责核心业务逻辑和 UI 编排。

#### 组件树

```
<App>
├── <header>
│   ├── 标题 + 副标题
│   ├── GitHub 链接 (lucide-react Github icon)
│   └── 主题切换按钮
├── <div.dropzone>                         文件上传区 + 隐藏 <input>
├── <div.controls-bar> (条件渲染)
│   ├── Global Delay 设置
│   ├── Clear All / Smart Align 按钮
│   └── APNG / WebP 生成按钮
├── <div.frame-list> (条件渲染)
│   └── <div.frame-item> × N             可拖拽帧卡片
├── <EditModal> (条件渲染 + null守卫)      帧编辑器
└── <div.result-section> (条件渲染 + IIFE null守卫)
    ├── 动画预览图
    ├── 压缩/质量滑块
    ├── 文件名编辑
    └── 下载按钮
```

#### 状态管理

| 状态变量 | 类型 | 默认值 | 说明 |
|----------|------|--------|------|
| `frames` | `Frame[]` | `[]` | 所有帧数据 |
| `isDraggingFile` | `boolean` | `false` | 文件拖拽状态 |
| `globalDelay` | `number` | `DEFAULT_GLOBAL_DELAY` | 全局帧延时 |
| `generatedApng` | `string \| null` | `null` | APNG Blob URL |
| `generatedWebP` | `string \| null` | `null` | WebP Blob URL |
| `isGenerating` | `boolean` | `false` | 生成中状态 |
| `editingFrame` | `string \| null` | `null` | 编辑中的帧 ID |
| `draggedFrameId` | `string \| null` | `null` | 拖拽排序中的帧 ID |
| `theme` | `'light' \| 'dark'` | 来自 useTheme hook | 当前主题 |
| `exportFileName` | `string` | `"animation"` | 导出文件名 |
| `resultSize` | `string \| null` | `null` | 生成文件大小 |
| `apngCompression` | `number` | `DEFAULT_APNG_COMPRESSION` | APNG 压缩等级 |
| `webpQuality` | `number` | `DEFAULT_WEBP_QUALITY` | WebP 质量 |

#### 关键函数

| 函数 | 说明 |
|------|------|
| `normalizeBaseFrame(frames)` | 独立辅助函数：将 `frames[0]` 的变换参数归零 (scale=1, offset=0, rotation=0) |
| `handleFiles(fileList)` | 文件上传核心入口：检测 APNG → 调用 parseAPNG；普通图片 → createImageBitmap → 构建 Frame |
| `handleSmartAlign()` | Cover 模式智能对齐非基准帧 |
| `generateAPNG()` | 使用 `createFrameRenderContext` + `renderFrameToCanvas`，UPNG.encode 编码，finally 释放 ImageBitmap |
| `generateWebP()` | 同上共享管道，canvas.toBlob('webp') + assembleWebP，finally 释放 ImageBitmap |
| `removeFrame(id)` | 移除帧并 revoke ObjectURL，调用 normalizeBaseFrame |
| 拖拽排序函数 | HTML5 Drag & Drop 帧重排，调用 normalizeBaseFrame |

#### 安全守卫

- EditModal 渲染使用 IIFE + null 检查：`frames.find(f => f.id === editingFrame)` 可能返回 undefined
- 结果区域使用 IIFE 提取 `src` 变量，`<img>` 和 `<a download>` 均使用同一安全引用
- 组件卸载时 `useEffect` cleanup 遍历 `frames` 释放所有 `URL.revokeObjectURL`

### 9.2 `EditModal.tsx` —— 帧编辑器

**文件位置**: [src/components/EditModal.tsx](file:///c:/Users/28529/Documents/GitHub/Animated-Image-Creator/src/components/EditModal.tsx)

独立的帧编辑模态框组件，使用 **`React.memo`** 包裹以避免不必要的重渲染。

**Props**:
```typescript
interface EditModalProps {
  frame: Frame;        // 要编辑的帧
  baseWidth: number;   // 基准画布宽度
  baseHeight: number;  // 基准画布高度
  onSave: (id, x, y, scale, rotation) => void;
  onClose: () => void;
}
```

**内部状态**: offset (平移)、scale (缩放)、rotation (旋转)、isDragging、imageBitmap、canvasSize、viewScale

**交互机制**:
1. **鼠标拖拽 (Pan)**: `mousedown` → `mousemove` 计算偏移
2. **滚轮缩放**: Canvas `wheel` 事件，灵敏度由 `ZOOM_WHEEL_SENSITIVITY` 控制，范围 `ZOOM_MIN`~`ZOOM_MAX`
3. **滑块控制**: Zoom 和 Rotate 范围滑块 + 步进按钮
4. **绘制逻辑 (`draw()`)**:
   - HiDPI 渲染 (`devicePixelRatio`)
   - 棋盘格背景 → 变换绘制图片 → evenodd 填充镂空遮罩 → 蓝色画布边框 + 十字参考线
5. **可访问性**: Canvas `aria-label="Frame position editor"`，关闭按钮 `aria-label="Close editor"`

### 9.3 `ErrorBoundary.tsx` —— 错误边界

**文件位置**: [src/components/ErrorBoundary.tsx](file:///c:/Users/28529/Documents/GitHub/Animated-Image-Creator/src/components/ErrorBoundary.tsx)

React 类组件错误边界：

- `getDerivedStateFromError(error)` — 捕获错误，更新 state
- `componentDidCatch(error, errorInfo)` — 记录错误日志
- 错误发生时渲染友好回退 UI (错误信息 + Reload Page 按钮)
- 正常时渲染 `this.props.children`

---

## 10. 自定义 Hooks

### `useTheme.ts`

**文件位置**: [src/hooks/useTheme.ts](file:///c:/Users/28529/Documents/GitHub/Animated-Image-Creator/src/hooks/useTheme.ts)

```typescript
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  return { theme, toggleTheme };
}
```

封装主题状态管理：通过设置 `<html data-theme>` 属性触发 CSS 变量切换。

---

## 11. 样式系统

### `src/App.css`

约 870 行的组件样式文件，使用 CSS 自定义属性 (CSS Variables) 实现主题切换。

#### 主题变量体系

```css
:root { /* 日间主题 */
  --bg-primary: #f8f9fa;    --text-primary: #212529;
  --accent-color: #4c6ef5;  --border-color: #dee2e6;
  /* ... 20+ 变量 */
}
[data-theme='dark'] { /* 暗黑主题 */
  --bg-primary: #101113;    --text-primary: #e9ecef;
  --accent-color: #5c7cfa;  --border-color: #2c2e33;
  /* ... 覆写 */
}
```

#### 动画关键帧

| 动画名 | 用途 |
|--------|------|
| `fadeIn` | 容器渐入 |
| `fadeInUp` | 从下方 20px 上移渐入 |
| `fadeInScale` | 从 0.9 缩放渐入 |
| `slideInRight` | 从右侧滑入 |
| `bounceIn` | 弹性缩放入场 (Base Badge) |
| `shimmer` | 光泽扫过效果 (标题) |
| `float` | 上下浮动 (上传图标) |
| `ripple` | 波纹扩散 (按钮点击) |
| `spin` | 旋转 (加载器，仅定义一次) |
| `glow` | 发光脉冲 (Base Frame) |

#### 主要 CSS 类

| 类名 | 对应 UI 元素 |
|------|-------------|
| `.container` | 主容器，max-width 1000px |
| `.header` | 顶部标题栏 |
| `.dropzone` | 文件拖拽上传区域 |
| `.controls-bar` | 全局控制栏 |
| `.frame-list` | 帧网格 (CSS Grid, auto-fill) |
| `.frame-item` | 单帧卡片 |
| `.frame-item.base-frame` | 基准帧 (蓝色边框 + glow 动画) |
| `.modal-overlay` | 模态框遮罩 (backdrop-filter blur) |
| `.modal-content` | 模态框内容 (95vw × 92vh) |
| `.result-section` | 生成结果展示区 |
| `.btn-primary / .btn-danger / .btn-secondary` | 按钮变体 |

### `src/index.css`

精简的全局基础样式：字体设置、body 重置、`#root` 全宽全高容器。

---

## 12. 配置文件

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // 相对路径，适配 GitHub Pages
})
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- `forceConsistentCasingInFileNames: true` — 跨平台文件名大小写一致性检查
- `strict: true` — 所有严格类型检查
- `moduleResolution: "bundler"` — 适配 Vite 模块解析

### `eslint.config.js`

ESLint v10 flat config 格式，包含：
- TypeScript 推荐规则 (`@typescript-eslint/recommended`)
- React Hooks 规则 (`react-hooks/recommended`)
- React Refresh 规则
- `no-console: warn`（仅允许 `console.warn`/`console.error`）
- `@typescript-eslint/no-unused-vars: error`（`_` 前缀参数豁免）
- 合适的浏览器全局变量声明

### `.editorconfig`

2 空格缩进、UTF-8、LF 换行、文件末尾空行。

---

## 13. 数据流全景

```
用户拖拽/选择文件
       │
       ▼
handleFiles(fileList)
       │
       ├── 检测 APNG? ──Yes──► parseAPNG(file)
       │                     UPNG.decode() + UPNG.toRGBA8()
       │                     Canvas → toBlob() → Frame[]
       │
       └── 普通图片 ─────────► createImageBitmap()
                              构建 Frame{file, previewUrl, delay, ...}
       │
       ▼
setFrames(prev → normalizeBaseFrame([...prev, ...newFrames]))
       │
       │ (用户可选: SmartAlign, 拖拽排序, EditModal 调整)
       │
       ▼
┌──────────────────────────────────────────────┐
│         用户点击 "APNG" 或 "WebP"             │
└───────┬──────────────────────┬───────────────┘
        │                      │
        ▼                      ▼
 generateAPNG()          generateWebP()
        │                      │
 createFrameRenderContext(frames)  ← 共享渲染管道
   → Promise.all(createImageBitmap)
   → 创建 Canvas + ctx
        │                      │
 for each frame:          for each frame:
   renderFrameToCanvas()     renderFrameToCanvas()
   ctx.getImageData()        canvas.toBlob('webp')
        │                      │
  UPNG.encode()            assembleWebP()
        │                      │
  Blob → URL              Blob → URL
        │                      │
  imageBitmaps.forEach(.close())  ← 内存释放
        │                      │
        └──────────┬───────────┘
                   ▼
        setGeneratedApng / setGeneratedWebP
                   │
                   ▼
        <div.result-section> 展示预览 + 下载
```

---

## 14. 关键设计决策

### 14.1 Base Frame 保护

第一帧 (`frames[0]`) 定义为 "Base Frame"，其变换参数始终归零 (`scale=1, offsetX=0, offsetY=0, rotation=0`)。所有修改 frames 的操作 (`handleFiles`、`removeFrame`、`handleSortOver`) 都通过统一的 `normalizeBaseFrame()` 函数强制执行此约束，避免代码重复。

### 14.2 APNG/WebP 双格式互斥 + 共享渲染管道

`generatedApng` 和 `generatedWebP` 互斥——生成一种格式时，另一种结果被清空。但两者的帧渲染逻辑完全相同，通过 `render-frames.ts` 中的 `createFrameRenderContext()` 和 `renderFrameToCanvas()` 实现共享。差异仅在编码阶段：APNG 使用 `UPNG.encode()` + `ctx.getImageData()`，WebP 使用 `canvas.toBlob('webp')` + `assembleWebP()`。

### 14.3 Canvas 渲染管线

帧变换的标准渲染顺序：`translate(cx, cy)` → `rotate(angle)` → `scale(s, s)` → `drawImage(-w/2, -h/2)`。确保以图片中心为原点进行旋转和缩放，偏移量相对于画布中心计算。

### 14.4 ImageBitmap 内存管理

1. `generateAPNG()` / `generateWebP()` 中所有 `ImageBitmap` 在 try 块末尾显式调用 `.close()` 释放 GPU 内存
2. 即使生成过程中抛出异常，`.close()` 仍通过 `try/catch` 安全包裹确保资源释放
3. 组件卸载时 `useEffect` cleanup 遍历所有帧调用 `URL.revokeObjectURL()` 释放 ObjectURL

### 14.5 Smart Align 的 Cover 策略

采样 Cover 模式（取 `scaleX` 和 `scaleY` 的**最大值**）而非 Contain 模式。图片可能被裁切，但保证画布完全填满、无黑边。

### 14.6 EditModal HiDPI 处理

Canvas 内部分辨率 ×`devicePixelRatio`，CSS 尺寸保持逻辑尺寸。确保 Retina/高 DPI 屏幕上渲染清晰，且性能和内存开销可控。

### 14.7 运行时安全守卫

所有非空断言替换为防御式编程：
- EditModal 渲染前检查帧是否仍存在于列表中
- 结果区域渲染前提取输出 URL 为独立变量，`<img>` 和 `<a download>` 共用安全引用
- ErrorBoundary 捕获渲染异常，展示友好回退 UI

### 14.8 WebP 帧解析并行化

`assembleWebP()` 所有帧的 `arrayBuffer()` 读取和 `parseWebP()` 解析使用 `Promise.all` 并行执行，仅在 Chunk 组装阶段保持顺序。在 100+ 帧场景下可显著提升性能。

---

## 15. 工程化规范

### 质量门禁

| 门禁 | 命令 | 要求 |
|------|------|------|
| TypeScript 类型检查 | `npx tsc --noEmit` | 零错误 |
| ESLint | `npm run lint` | 零错误零警告 |
| 生产构建 | `npm run build` | 成功 |

### 代码风格

- 2 空格缩进（`.editorconfig`）
- `console.log` 禁止，`console.error`/`console.warn` 允许
- Magic numbers 集中在 `constants.ts`
- 接口定义集中在 `types/` 目录
- 纯工具函数不依赖 React 运行时，便于单元测试
- 组件使用 `React.memo` 优化重复渲染
