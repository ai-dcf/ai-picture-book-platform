# AI 绘本工作室 UI 重构设计文档

**日期**: 2026-05-13
**状态**: 设计完成
**负责人**: AI Assistant

---

## 一、摘要

本设计文档描述如何将 AI 绘本工作室的 UI 重构为独特的**东方水墨风格**，拒绝传统 AI 项目的"蓝色渐变+科技感"设计，打造具有传统文化底蕴的现代化界面。

**设计核心原则**：
- 极简留白，简约不简单
- 水墨笔触感交互
- 书法字体与古典配色
- 现代功能与传统美学融合

---

## 二、设计理念

### 2.1 为什么选择水墨风格？

1. **文化契合**：绘本创作本身具有浓厚的文化属性，水墨风格能增强用户的创作情感
2. **差异化定位**：市场上 AI 产品多为蓝色科技风，水墨风格能脱颖而出
3. **情感共鸣**：水墨的柔和、诗意特质与绘本创作的温馨、创意氛围高度契合
4. **减少 AI 感**：避免传统 AI 产品的"冷冰冰"感觉，让用户感到温暖和亲近

### 2.2 设计愿景

> "让 AI 绘本创作如同在一张宣纸上挥毫泼墨，既有现代科技的便捷，又有传统文化的温度。"

---

## 三、色彩体系

### 3.1 主色调

| 颜色名称 | 色值 | 用途 |
|---------|------|------|
| 宣纸白 | #FAFAF8 | 主背景色 |
| 淡墨灰 | #F5F5F3 | 卡片背景 |
| 墨色 | #1A1A1A | 主要文字 |
| 淡墨 | #4A4A4A | 次要文字 |
| 水墨灰 | #8A8A8A | 占位符、提示文字 |

### 3.2 强调色

| 颜色名称 | 色值 | 用途 |
|---------|------|------|
| 朱红 | #C53D43 | 主要操作、强调元素 |
| 淡朱 | #E8D5D5 | 朱红背景hover状态 |
| 青墨 | #7BA3A8 | 次要强调、图标 |
| 淡青 | #E8F0F2 | 青墨背景 |

### 3.3 功能色

| 颜色名称 | 色值 | 用途 |
|---------|------|------|
| 成功绿 | #4A7C59 | 成功状态 |
| 警告橙 | #C9803D | 警告状态 |
| 错误红 | #C53D43 | 错误状态 |

### 3.4 CSS 变量定义

```css
:root {
  /* 主色系 - 水墨灰白 */
  --background: 40 10% 98%;      /* #FAFAF8 - 宣纸白 */
  --foreground: 0 0% 10%;       /* #1A1A1A - 墨色 */
  --card: 40 8% 97%;            /* #F7F7F5 - 淡宣纸 */
  --card-foreground: 0 0% 10%;  /* 墨色 */

  /* 强调色 - 朱红印章 */
  --primary: 356 58% 54%;       /* #C53D43 - 朱红 */
  --primary-foreground: 0 0% 100%;

  /* 次要色 - 青墨 */
  --accent: 185 20% 60%;       /* #7BA3A8 - 青墨 */
  --accent-foreground: 0 0% 100%;

  /* 辅助色 */
  --muted: 40 8% 94%;          /* 淡墨灰 */
  --muted-foreground: 0 0% 45%;/* 水墨灰 */

  /* 边框和输入 */
  --border: 40 8% 88%;          /* 淡墨边框 */
  --input: 40 8% 88%;
  --ring: 356 58% 54%;         /* 朱红环 */

  /* 状态色 */
  --status-confirmed: 145 35% 40%;  /* 成功绿 */
  --status-generated: 210 50% 50%;  /* 生成蓝 */
  --status-review: 356 45% 55%;     /* 审查橙 */
  --status-pending: 40 10% 60%;     /* 待处理灰 */

  /* 渐变和阴影 */
  --gradient-hero: linear-gradient(135deg, #FAFAF8 0%, #F0F0EE 100%);
  --gradient-ink: linear-gradient(135deg, #1A1A1A 0%, #4A4A4A 100%);
  --shadow-subtle: 0 2px 8px rgba(26, 26, 26, 0.04);
  --shadow-elevated: 0 8px 32px rgba(26, 26, 26, 0.08);
}
```

---

## 四、字体系统

### 4.1 字体选择

| 字体用途 | 字体名称 | 说明 |
|---------|---------|------|
| 标题/Logo | Ma Shan Zheng (Google Fonts) | 马善政毛笔字体 |
| 正文 | Noto Serif SC | 思源宋体，优雅易读 |
| 辅助文字 | Noto Sans SC | 思源黑体，简洁现代 |
| 英文/数字 | Cormorant Garamond | 优雅衬线体 |

### 4.2 字体使用规范

```css
/* 标题字体 */
h1, h2, h3, .font-display {
  font-family: 'Ma Shan Zheng', cursive;
  font-weight: 400;
}

/* 正文字体 */
body, p, span, .font-body {
  font-family: 'Noto Serif SC', serif;
  font-weight: 400;
  line-height: 1.8;
}

/* 辅助字体 */
.caption, .label, .meta {
  font-family: 'Noto Sans SC', sans-serif;
  font-weight: 400;
}
```

### 4.3 字号体系

| 级别 | 字号 | 行高 | 用途 |
|------|------|------|------|
| Hero | 48-64px | 1.2 | 首页大标题 |
| H1 | 36-48px | 1.3 | 页面标题 |
| H2 | 24-30px | 1.4 | 区块标题 |
| H3 | 20-24px | 1.5 | 卡片标题 |
| Body | 16px | 1.8 | 正文内容 |
| Small | 14px | 1.6 | 辅助说明 |
| Caption | 12px | 1.5 | 标签、注释 |

---

## 五、视觉元素

### 5.1 水墨笔触效果

**毛笔笔触分隔线**
```css
.divider-ink {
  position: relative;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #4A4A4A 20%,
    #1A1A1A 50%,
    #4A4A4A 80%,
    transparent 100%
  );
}

.divider-ink::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 30%;
  width: 40%;
  height: 5px;
  background: radial-gradient(
    ellipse at center,
    rgba(26, 26, 26, 0.1) 0%,
    transparent 70%
  );
}
```

**水墨晕染边框**
```css
.border-ink {
  border: 1px solid rgba(26, 26, 26, 0.08);
  position: relative;
}

.border-ink::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(26, 26, 26, 0.05) 0%,
    transparent 50%,
    rgba(26, 26, 26, 0.03) 100%
  );
  pointer-events: none;
}
```

### 5.2 印章风格按钮

**朱红印章按钮**
```css
.btn-seal {
  background: var(--primary);
  color: white;
  padding: 12px 28px;
  border-radius: 4px;
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 18px;
  letter-spacing: 0.1em;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.btn-seal::before {
  content: '';
  position: absolute;
  inset: 2px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.btn-seal:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(197, 61, 67, 0.3);
}
```

**水墨描边按钮**
```css
.btn-ink-outline {
  background: transparent;
  border: 2px solid var(--foreground);
  color: var(--foreground);
  padding: 10px 24px;
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  position: relative;
  transition: all 0.3s ease;
}

.btn-ink-outline::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1px solid rgba(26, 26, 26, 0.1);
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.btn-ink-outline:hover {
  background: var(--foreground);
  color: var(--background);
}

.btn-ink-outline:hover::after {
  opacity: 1;
}
```

### 5.3 卡片设计

**宣纸质感卡片**
```css
.card-ink {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  position: relative;
  transition: all 0.3s ease;
}

.card-ink::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.02;
  pointer-events: none;
  border-radius: inherit;
}

.card-ink:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-elevated);
}
```

### 5.4 背景纹理

**宣纸背景**
```css
.bg-paper {
  background-color: #FAFAF8;
  background-image:
    radial-gradient(
      ellipse at 20% 30%,
      rgba(26, 26, 26, 0.02) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 80% 70%,
      rgba(26, 26, 26, 0.01) 0%,
      transparent 40%
    );
}
```

### 5.5 图标风格

**水墨图标特点**：
- 简洁的线条
- 柔和的圆角
- 单色或双色设计
- 使用 Lucide Icons，stroke-width 调整为 1.5px

```css
.icon-ink {
  width: 24px;
  height: 24px;
  stroke-width: 1.5;
  stroke: currentColor;
}
```

---

## 六、页面布局

### 6.1 首页（HeroPage）

**设计要点**：
- 大量留白，中心对齐
- 书法大字标题
- 水墨晕染装饰线条
- 项目卡片采用宣纸质感

**布局示例**：
```
┌─────────────────────────────────────────┐
│                                         │
│           AI 绘本工作室                 │  ← 书法大字
│                                         │
│    用人工智能的力量，将你的想象变成精美的绘本 │
│                                         │
│         ─────── 水墨分隔线 ───────      │
│                                         │
│   ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐│
│   │ 新建 │  │项目1 │  │项目2 │  │项目3 ││
│   │     │  │     │  │     │  │     ││
│   └─────┘  └─────┘  └─────┘  └─────┘│
│                                         │
└─────────────────────────────────────────┘
```

### 6.2 工作室页面

**设计要点**：
- 左侧边栏采用深墨色
- 内容区域使用宣纸白
- 顶部导航使用水墨描边
- 阶段指示器使用印章风格

### 6.3 编辑器页面

**设计要点**：
- 干净的画布区域
- 工具栏使用水墨描边
- 预览区域使用宣纸质感
- 缩略图使用书签样式

---

## 七、动画与交互

### 7.1 水墨晕染效果

**Hover 动画**
```css
.hover-ink-blur {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.hover-ink-blur:hover {
  box-shadow: 0 0 24px rgba(26, 26, 26, 0.08);
  transform: translateY(-2px);
}
```

**水墨扩散动画**
```css
@keyframes ink-spread {
  0% {
    transform: scale(0.95);
    opacity: 0;
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-ink-spread {
  animation: ink-spread 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 7.2 页面过渡

```css
.page-transition {
  animation: fade-slide-in 0.4s ease-out;
}

@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 7.3 加载状态

**水墨加载动画**
```css
.loading-ink {
  position: relative;
  width: 40px;
  height: 40px;
}

.loading-ink::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin-ink 1s ease-in-out infinite;
}

@keyframes spin-ink {
  to {
    transform: rotate(360deg);
  }
}
```

---

## 八、组件重构清单

### 8.1 需要修改的组件

| 组件 | 优先级 | 修改要点 |
|------|--------|---------|
| `globals.css` | P0 | 重构所有CSS变量 |
| `tailwind.config.ts` | P0 | 添加新的字体和颜色配置 |
| `HeroPage.tsx` | P1 | 重构首页布局和样式 |
| `StudioPage.tsx` | P1 | 重构工作室页面 |
| `EditorCanvas.tsx` | P1 | 重构编辑器画布 |
| `TopBar.tsx` | P2 | 水墨风格导航栏 |
| 所有 Card 组件 | P2 | 宣纸质感卡片 |
| 所有 Button 组件 | P2 | 印章风格按钮 |
| 输入框组件 | P3 | 水墨描边样式 |

### 8.2 新增样式文件

| 文件 | 说明 |
|------|------|
| `src/styles/ink-effects.css` | 水墨笔触特效 |
| `src/styles/paper-texture.css` | 宣纸纹理背景 |
| `src/styles/seal-button.css` | 印章风格按钮 |

---

## 九、实施计划

### 阶段一：基础样式重构（P0）
1. 重构 `globals.css` 颜色变量
2. 更新 `tailwind.config.ts` 配置
3. 添加 Google Fonts 字体
4. 测试基础样式

### 阶段二：核心组件重构（P1）
1. 重构首页 HeroPage
2. 重构工作室页面
3. 重构编辑器页面
4. 确保功能正常

### 阶段三：细节优化（P2）
1. 优化按钮样式
2. 优化卡片样式
3. 添加动画效果
4. 细节打磨

### 阶段四：测试与优化（P3）
1. 功能测试
2. 响应式测试
3. 性能优化
4. 最终调整

---

## 十、验收标准

### 10.1 视觉验收

- ✅ 所有页面使用统一的宣纸白背景
- ✅ 标题使用书法字体
- ✅ 主要操作按钮使用朱红色
- ✅ 边框使用淡墨灰色
- ✅ 无明显的 AI 科技感元素

### 10.2 功能验收

- ✅ 所有功能正常工作
- ✅ 响应式布局正常
- ✅ 动画流畅无卡顿
- ✅ 无控制台错误

### 10.3 体验验收

- ✅ 整体感觉温暖、亲近
- ✅ 与传统 AI 产品有明显差异
- ✅ 保持现代应用的易用性

---

## 十一、参考资源

### 字体资源
- Ma Shan Zheng: https://fonts.google.com/specimen/Ma+Shan+Zheng
- Noto Serif SC: https://fonts.google.com/noto/specimen/Noto+Serif+SC
- Cormorant Garamond: https://fonts.google.com/specimen/Cormorant+Garamond

### 设计灵感
- 故宫博物院官网配色
- 中国传统水墨画
- 日式极简设计
- 传统印章艺术

---

## 附录：CSS 变量快速参考

```css
:root {
  /* 核心色 */
  --background: 40 10% 98%;
  --foreground: 0 0% 10%;
  --primary: 356 58% 54%;
  --accent: 185 20% 60%;

  /* 功能色 */
  --muted: 40 8% 94%;
  --muted-foreground: 0 0% 45%;
  --border: 40 8% 88%;

  /* 状态色 */
  --status-confirmed: 145 35% 40%;
  --status-generated: 210 50% 50%;
  --status-review: 356 45% 55%;

  /* 字体 */
  --font-display: 'Ma Shan Zheng', cursive;
  --font-body: 'Noto Serif SC', serif;
  --font-sans: 'Noto Sans SC', sans-serif;

  /* 阴影 */
  --shadow-sm: 0 2px 8px rgba(26, 26, 26, 0.04);
  --shadow-md: 0 8px 24px rgba(26, 26, 26, 0.08);
  --shadow-lg: 0 16px 48px rgba(26, 26, 26, 0.12);
}
```
