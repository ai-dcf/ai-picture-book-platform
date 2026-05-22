import type { GenreRuleSet, PromptGenre } from "@/prompts/types";

const DEFAULT_GENRE: GenreRuleSet = {
  genreLabel: "通用儿童绘本",
  storyRules: ["故事应具有清晰起承转合，适合儿童阅读节奏", "价值观积极温和，避免制造持续性焦虑"],
  storyboardRules: ["分镜应突出每页单一主动作和明确翻页动机", "画面推进要服务情绪与故事理解"],
  visualRules: ["视觉表达应服务叙事，不为了堆砌细节而削弱可读性"],
  complianceRules: ["默认遵循适龄、安全、易理解的儿童绘本标准"],
};

const GENRE_SPECS: Record<PromptGenre, GenreRuleSet> = {
  "原创童话": {
    genreLabel: "原创童话",
    storyRules: ["强调想象力、情绪转折和温暖寓意", "角色成长与情感变化应清晰、自然"],
    storyboardRules: ["分镜应突出童话氛围、惊喜感和发现感", "场景变化可富于幻想，但逻辑上仍要可追踪"],
    visualRules: ["允许更强的奇幻元素，但必须保持儿童友好与视觉柔和"],
    complianceRules: ["避免黑暗、惊悚、压抑的奇幻表达"],
  },
  "经典改编": {
    genreLabel: "经典改编",
    storyRules: ["保留经典故事的核心精神，不做完全失真的颠覆", "语言表达适龄化，但不过度幼稚化"],
    storyboardRules: ["关键桥段必须被识别出来，视觉呈现要尊重原作气质", "改编应突出可理解性和现代儿童阅读友好性"],
    visualRules: ["视觉再创作可更新审美，但不要破坏作品核心识别符号"],
    complianceRules: ["避免文化符号误用、服饰逻辑混乱和时代质感严重错位"],
  },
  "科普启蒙": {
    genreLabel: "科普启蒙",
    storyRules: ["叙事应兼顾知识点准确性与儿童可理解性", "知识表达要简洁，不堆砌术语"],
    storyboardRules: ["页面结构要突出主体知识点，画面服务理解而非纯装饰", "每页应有明确的学习焦点"],
    visualRules: ["优先清晰、直观、结构化表达，适度降低背景装饰干扰"],
    complianceRules: ["避免伪科学、误导性结构、危险行为美化和错误因果暗示"],
  },
  "冒险成长": {
    genreLabel: "冒险成长",
    storyRules: ["强调挑战、探索、克服困难和情绪成长", "冲突可以存在，但必须适龄、可化解"],
    storyboardRules: ["镜头推进应强化节奏感与行动逻辑，避免无意义跳切", "冒险场景需要有清晰风险边界和安全感回收"],
    visualRules: ["允许更强动势和空间切换，但必须保持角色清晰与阅读安全感"],
    complianceRules: ["避免将危险、暴力、恐怖作为卖点进行强化表现"],
  },
  "低幼认知启蒙": {
    genreLabel: "低幼认知启蒙",
    storyRules: ["强调重复、节奏、识别和简单因果关系", "故事应服务于认知学习，而不是复杂情节铺陈"],
    storyboardRules: ["每页只突出一个认知目标，避免同时传递多组信息", "动作和表情必须清楚直观"],
    visualRules: ["元素精简、轮廓明确、色块友好，优先主体识别而非细节表现"],
    complianceRules: ["绝不引入会造成低幼儿童误解和惊吓的画面元素"],
  },
};

export function getGenreSpec(genre?: PromptGenre): GenreRuleSet {
  if (!genre) return DEFAULT_GENRE;
  return GENRE_SPECS[genre];
}
