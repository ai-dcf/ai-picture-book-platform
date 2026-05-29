export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
}

export interface PromptParams {
  type: 'character' | 'scene' | 'page';
  artStyle: string;
  targetAge: string;
  mood?: string;
  layout?: string;
}

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

const ART_STYLE_MODIFIERS: Record<string, { lighting: string; texture: string; mood: string }> = {
  "水彩温暖风": {
    lighting: "watercolor lighting, soft gradients, luminous washes",
    texture: "watercolor texture, transparent layers, bleeding edges",
    mood: "warm and cozy, gentle and inviting"
  },
  "蜡笔童趣风": {
    lighting: "bright child-friendly lighting, soft daylight, gentle contrast",
    texture: "crayon texture, wax grain, hand-drawn strokes",
    mood: "playful, cheerful, innocent"
  },
  "剪纸拼贴风": {
    lighting: "clean even lighting, low shadow complexity, graphic readability",
    texture: "paper collage texture, cut edges, layered craft material",
    mood: "decorative, lively, handmade"
  },
  "日系清新风": {
    lighting: "fresh natural lighting, airy highlights, soft backlight",
    texture: "clean illustration texture, light brushwork, airy finish",
    mood: "fresh, tender, uplifting"
  },
  "素描淡彩风": {
    lighting: "soft sketch lighting, calm midtones, subtle shading",
    texture: "pencil lines, light wash, paper grain",
    mood: "quiet, gentle, observant"
  },
  "波普大胆风": {
    lighting: "bright flat lighting, graphic contrast, bold visual punch",
    texture: "poster-like surfaces, crisp shapes, pop illustration finish",
    mood: "bold, energetic, playful"
  },
  "水墨东方风": {
    lighting: "soft ink wash lighting, subtle gradients, harmonious balance",
    texture: "ink wash texture, brushstroke details, paper grain",
    mood: "elegant and serene, traditional Eastern aesthetics"
  },
  "极简线条风": {
    lighting: "clean simple lighting, minimal shadow noise, high readability",
    texture: "minimal line texture, smooth flat fills, restrained detail",
    mood: "clean, modern, calm"
  }
};

export class PromptEnhancer {
  addProfessionalTerms(prompt: string, type: 'character' | 'scene' | 'page'): string {
    const basePrompt = prompt;
    const qualityTags = this.getQualityTags();
    const professionalInstructions = this.getProfessionalInstructions(type);
    
    return `${basePrompt}\n\n${professionalInstructions}\n\n${qualityTags}`;
  }

  generateColorPalette(artStyle: string): ColorPalette {
    const palettes: Record<string, ColorPalette> = {
      "水彩温暖风": { primary: "warm pastel", secondary: "soft cream", accent: "gentle coral" },
      "蜡笔童趣风": { primary: "soft wax red", secondary: "sunny yellow", accent: "sky blue" },
      "剪纸拼贴风": { primary: "paper red", secondary: "olive green", accent: "warm cream" },
      "日系清新风": { primary: "fresh mint", secondary: "clear sky", accent: "soft peach" },
      "素描淡彩风": { primary: "soft gray", secondary: "light beige", accent: "pale blue" },
      "波普大胆风": { primary: "bold cyan", secondary: "warm yellow", accent: "vivid red" },
      "水墨东方风": { primary: "ink black", secondary: "light gray", accent: "subtle red seal" },
      "极简线条风": { primary: "off white", secondary: "graphite gray", accent: "soft blue" }
    };

    return palettes[artStyle] || palettes["水彩温暖风"];
  }

  generateLightingDescription(mood: string = 'warm'): string {
    const preset = LIGHTING_PRESETS[mood as keyof typeof LIGHTING_PRESETS] || LIGHTING_PRESETS.soft;
    return preset.description;
  }

  generateCompositionDescription(layout: string = 'golden'): string {
    const preset = COMPOSITION_PRESETS[layout as keyof typeof COMPOSITION_PRESETS] || COMPOSITION_PRESETS.golden;
    return preset.description;
  }

  buildProfessionalPrompt(params: PromptParams, baseContent: string): string {
    const { type, artStyle, targetAge, mood = 'warm', layout = 'golden' } = params;
    const modifiers = ART_STYLE_MODIFIERS[artStyle] || ART_STYLE_MODIFIERS["水彩温暖风"];
    const colorPalette = this.generateColorPalette(artStyle);
    
    const typeHeader = type === 'character' 
      ? '[角色设定图] Character Design Sheet'
      : type === 'scene'
      ? '[场景设定图] Scene Design Sheet'
      : '[绘本插画] Picture Book Illustration';

    return `${typeHeader}

${baseContent}

艺术风格 Artistic Style:
- ${artStyle}
- Target Age: ${targetAge}
- ${modifiers.mood}

专业绘画指导 Professional Painting Instructions:

1. 光影系统 Lighting System:
   - ${this.generateLightingDescription(mood)}
   - ${modifiers.lighting}

2. 色彩方案 Color Palette:
   - 主色调: ${colorPalette.primary}
   - 辅助色: ${colorPalette.secondary}
   - 强调色: ${colorPalette.accent}
   - 色彩和谐: 使用邻近色和互补色点缀

3. 构图规则 Composition:
   - ${this.generateCompositionDescription(layout)}
   - 留白: 上下左右各留15-20%空间
   - 平衡: 视觉重量左右均衡

4. 细节处理 Detail Treatment:
   - 前景: 清晰锐利，细节丰富
   - 中景: 主体清晰，细节适中
   - 背景: 柔和虚化，暗示性细节
   - 边缘: 主次交界处使用软边缘过渡

5. 质感表现 Texture:
   - ${modifiers.texture}
   - 保持儿童绘本的温暖柔和感

质量标准 Quality:
- 8K分辨率，高细节
- 完美的手和脸，避免畸形
- 儿童绘本审美，健康向上
- 构图稳定，色彩统一
- 系列一致：角色造型与风格保持一致（除非内容明确要求变化）
- 无文字，无水印，无Logo，无签名，无边框，无UI元素，无干扰杂物`;
  }

  private getQualityTags(): string {
    return `质量标签 Quality Tags:
- masterpiece, best quality, 8k resolution
- high detail, professional illustration
- perfect anatomy, no deformities
- clean composition, harmonious colors`;
  }

  private getProfessionalInstructions(type: 'character' | 'scene' | 'page'): string {
    const baseInstructions = `专业绘画术语 Professional Painting Terms:
- 光影: soft lighting, ambient light, rim light, diffused light
- 构图: golden ratio, rule of thirds, negative space
- 色彩: color harmony, tonal unity, complementary colors
- 质感: brushstroke texture, edge treatment, detail layers`;

    if (type === 'character') {
      return `${baseInstructions}
- 角色: clear silhouette, distinctive features, consistent design
- 表情: expressive face, natural pose, friendly appearance`;
    }

    if (type === 'scene') {
      return `${baseInstructions}
- 场景: depth perception, atmospheric perspective, spatial balance
- 氛围: mood setting, environmental storytelling`;
    }

    return `${baseInstructions}
- 叙事: visual storytelling, emotional expression, narrative flow`;
  }

  buildUserFriendlyPrompt(params: PromptParams, data: {
    visualGoal?: string;
    sceneName?: string;
    sceneDescription?: string;
    name?: string;
    description?: string;
  }): string {
    const { type, artStyle, targetAge } = params;

    if (type === 'page') {
      const parts = [`${artStyle}风格的儿童绘本画面，适合${targetAge}。`];
      if (data.visualGoal) parts.push(data.visualGoal);
      if (data.sceneName && data.sceneDescription) {
        parts.push(`场景为${data.sceneName}——${data.sceneDescription}`);
      }
      return parts.join(' ');
    } else if (type === 'character') {
      return `${artStyle}风格的儿童绘本角色，适合${targetAge}。${data.name}：${data.description}`;
    } else {
      return `${artStyle}风格的儿童绘本场景，适合${targetAge}。${data.name}：${data.description}`;
    }
  }

  convertUserPromptToProfessional(userPrompt: string, params: PromptParams): string {
    return this.buildProfessionalPrompt(params, userPrompt);
  }
}

export const promptEnhancer = new PromptEnhancer();
