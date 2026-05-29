# 图片提示词专业化提升方案

**日期**: 2026-05-13
**状态**: 设计完成
**负责人**: AI Assistant

---

## 一、改进目标

将现有的图片提示词从**基础描述**提升为**专业绘画指导**，包含：

1. **专业绘画术语**：光影、构图、色彩等专业概念
2. **AI 图像生成最佳实践**：质量标签、风格修饰词
3. **水墨风格适配**：符合我们 UI 的东方美学理念

---

## 二、当前提示词分析

### 现有提示词示例

**角色提示词**：
```
角色设定图，主体：小兔子。
描述：一只善良可爱的小兔子，穿着蓝色背带裤。
绘本风格：水彩温暖风，目标年龄：3-6，画面比例：3:4。
突出角色外形、服饰、表情与辨识度，画面干净完整，适合后续全书复用，保持儿童绘本审美与一致性。
```

**页面提示词**：
```
绘本第 1 页插画，风格：水彩温暖风，目标年龄：3-6，画面比例：3:4。
本页正文：小兔子在森林里玩耍。
画面目标：展现小兔子的可爱形象。
角色引用：小兔子。角色细节：小兔子：一只善良可爱的小兔子，穿着蓝色背带裤。
场景引用：森林。场景细节：森林：一片生机勃勃的大森林。
请输出适合儿童绘本的完整单页插画，主体明确，构图稳定，色彩统一，保留故事情绪与阅读节奏。
```

### 问题点

1. **缺少专业绘画术语**：无光影、构图等专业指导
2. **缺少质量修饰词**：无高分辨率、专业等标签
3. **缺少细节指令**：无笔触、纹理等具体指导
4. **格式不够结构化**：所有内容混在一起

---

## 三、改进方案

### 3.1 添加专业绘画术语

**光影术语**：
- 软光 (soft lighting)
- 氛围光 (ambient light)
- 边缘光 (rim light)
- 散射光 (diffused light)

**构图术语**：
- 黄金分割 (golden ratio)
- 三分法 (rule of thirds)
- 对角线构图 (diagonal composition)
- 对称构图 (symmetrical composition)

**色彩术语**：
- 互补色 (complementary colors)
- 邻近色 (analogous colors)
- 色彩和谐 (color harmony)
- 色调统一 (tonal unity)

**绘画术语**：
- 边缘处理 (edge treatment)
- 笔触质感 (brushstroke texture)
- 细节层次 (detail layers)
- 虚实关系 (sharp-soft relationship)

### 3.2 改进后的提示词示例

**角色提示词**：
```
[角色设定图] Character Design Sheet

主体 Subject: 小兔子
描述 Description: 一只善良可爱的小白兔，穿着蓝色背带裤，大眼睛，微笑表情

艺术风格 Artistic Style:
- 绘本插画风格 children's book illustration
- ${projectInfo.artStyle}
- 目标年龄 Target Age: ${projectInfo.targetAge}

专业绘画指导 Professional Painting Instructions:
1. 光影 Lighting: 柔和的散射光，避免硬阴影，温暖氛围
2. 色彩 Color: 使用邻近色系，蓝色与绿色呼应，色彩和谐统一
3. 构图 Composition: 角色居中偏上，占画面60%，留白充足
4. 细节 Details: 清晰边缘处理，柔软笔触质感，绒毛细节暗示而非明示

一致性 Consistency: 保持全书角色风格统一，边缘清晰易识别，适合儿童绘本审美
```

**页面提示词**：
```
[绘本插画] Picture Book Illustration - Page ${pageIndex + 1}

基本信息 Basic Info:
- 风格 Style: ${projectInfo.artStyle}
- 年龄 Target: ${projectInfo.targetAge}
- 比例 Aspect Ratio: ${projectInfo.aspectRatio}

故事情节 Story Content:
${storyText}

画面目标 Visual Goal:
${visualGoal}

角色 Character:
${characterRefs.map(ref => `- ${ref}: ${getAssetDescription(ref)}`).join('\n')}

场景 Scene:
${sceneRefs.map(ref => `- ${ref}: ${getAssetDescription(ref)}`).join('\n')}

专业绘画指令 Professional Painting Instructions:

1. 光影系统 Lighting System:
   - 主光源：柔和的顶光，避免硬阴影
   - 氛围光：温暖的散射光填充阴影
   - 边缘光：角色轮廓使用淡金色边缘光强调
   - 投影：柔和的短投影，增加立体感

2. 色彩方案 Color Palette:
   - 主色调：${primaryColorScheme}
   - 辅助色：${secondaryColorScheme}
   - 强调色：${accentColor}
   - 色彩和谐：使用邻近色和互补色点缀

3. 构图规则 Composition:
   - 黄金分割：主体放置在黄金分割点
   - 视觉引导：使用线条引导视线
   - 留白：上下左右各留15-20%空间
   - 平衡：视觉重量左右均衡

4. 细节处理 Detail Treatment:
   - 前景：清晰锐利，细节丰富
   - 中景：主体清晰，细节适中
   - 背景：柔和虚化，暗示性细节
   - 边缘：主次交界处使用软边缘过渡

5. 质感表现 Texture:
   - 主体：清晰笔触，质感细腻
   - 背景：水彩晕染效果，轻薄透明
   - 整体：保持儿童绘本的温暖柔和感

质量标准 Quality:
- 8K分辨率，高细节
- 完美的手和脸，避免畸形
- 儿童绘本审美，健康向上
- 构图稳定，色彩统一
```

---

## 四、实施计划

### 4.1 创建提示词优化服务

**新文件**: `src/lib/prompt-enhancer.ts`

```typescript
// 提示词增强器
export class PromptEnhancer {
  // 添加专业绘画术语
  addProfessionalTerms(prompt: string, type: 'character' | 'scene' | 'page'): string

  // 生成光影描述
  generateLightingDescription(mood: string): string

  // 生成构图描述
  generateCompositionDescription(layout: string): string

  // 生成色彩方案
  generateColorPalette(artStyle: string): ColorPalette

  // 生成完整提示词
  buildProfessionalPrompt(params: PromptParams): string
}
```

### 4.2 修改现有提示词构建函数

**修改文件**: `src/modules/studio/domain/services/prompt/asset-page-prompts.ts`

- 集成 PromptEnhancer
- 使用增强后的提示词
- 保持向后兼容

---

## 五、技术细节

### 5.1 光影预设

```typescript
const LIGHTING_PRESETS = {
  soft: {
    name: "柔和光",
    description: "soft lighting, diffused light, no harsh shadows, warm ambient fill"
  },
  warm: {
    name: "温暖光",
    description: "warm golden light, sunrise/sunset tones, cozy atmosphere"
  },
  bright: {
    name: "明亮光",
    description: "bright natural light, clear shadows, high contrast, cheerful"
  }
};
```

### 5.2 构图预设

```typescript
const COMPOSITION_PRESETS = {
  golden: {
    name: "黄金分割",
    description: "golden ratio composition, subject at golden points, balanced negative space"
  },
  thirds: {
    name: "三分法则",
    description: "rule of thirds, subject on intersection points, dynamic composition"
  },
  centered: {
    name: "中心构图",
    description: "centered composition, symmetrical balance, stable and focused"
  }
};
```

### 5.3 艺术风格预设

```typescript
const ART_STYLE_MODIFIERS = {
  "水彩温暖风": {
    lighting: "watercolor lighting, soft gradients, luminous washes",
    texture: "watercolor texture, transparent layers, bleeding edges",
    mood: "warm and cozy, gentle and inviting"
  },
  "写实插画": {
    lighting: "professional studio lighting, detailed shadows, high fidelity",
    texture: "realistic texture, fine details, photographic quality",
    mood: "lifelike and engaging, professional illustration"
  }
};
```

---

## 六、预期效果

### 6.1 图片质量提升

| 方面 | 改进前 | 改进后 |
|------|--------|--------|
| 光影 | 基础描述 | 专业的三层光影系统 |
| 构图 | 无指导 | 黄金分割+三分法 |
| 色彩 | 简单描述 | 专业色彩理论应用 |
| 质感 | 无指导 | 笔触、纹理详细指导 |

### 6.2 一致性提升

- 全书角色风格统一
- 跨页面色彩和谐
- 光影系统连贯

### 6.3 专业性提升

- 使用专业绘画术语
- 应用 AI 图像生成最佳实践
- 符合水墨风格设计理念

---

## 七、验收标准

1. ✅ 所有提示词包含专业绘画术语
2. ✅ 光影、构图、色彩三要素完整
3. ✅ 保持向后兼容
4. ✅ 生成图片质量明显提升
5. ✅ 不影响现有功能

---

## 八、后续优化方向

1. **提示词模板系统**：支持多种预设模板
2. **AI 提示词优化**：使用 AI 自动优化提示词
3. **风格迁移**：支持更多艺术风格
4. **参数可视化**：UI 调整光影、构图参数
