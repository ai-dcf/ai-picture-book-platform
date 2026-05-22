import type { TargetAge } from "@/types/picturebook";
import type { VisualRuleSet } from "@/prompts/types";

const AGE_LABELS: Record<Exclude<TargetAge, "auto">, string> = {
  "0-3": "0-3 岁低幼认知",
  "3-6": "3-6 岁儿童绘本",
  "6-9": "6-9 岁少儿读物",
  "9-12": "9-12 岁少年读物",
};

export function getAgeVisualSpec(targetAge: Exclude<TargetAge, "auto">): VisualRuleSet {
  const common = {
    colorRules: [
      "使用适合儿童视觉发育的柔和主色，不使用高攻击性荧光撞色",
      "主色与辅助色保持清晰区分，避免整页颜色混杂成一团",
    ],
    textSafeAreaRules: [
      "默认预留底部 15-20% 文本安全区，主体不要压入该区域",
      "文本安全区应保持相对干净，避免高对比细节和关键动作落入其中",
    ],
  };

  switch (targetAge) {
    case "0-3":
      return {
        targetAgeLabel: AGE_LABELS[targetAge],
        ageGuidance: [
          "单页只保留 1 个明确视觉焦点，强调大形体和高识别轮廓",
          "角色表情必须清晰友好，动作简单明确，避免复杂叙事并置",
        ],
        colorRules: [
          ...common.colorRules,
          "颜色使用低刺激、偏奶油感或柔和蜡笔系，不使用阴森深暗大面积压色",
        ],
        compositionRules: [
          "构图以稳定、居中或弱动态构图为主，减少复杂透视",
          "背景弱化，避免堆砌次要元素影响识别",
        ],
        detailRules: [
          "限制背景元素数量，保证婴幼儿一眼可辨认主体",
          "减少复杂纹理和密集花纹，避免画面噪声过载",
        ],
        textSafeAreaRules: common.textSafeAreaRules,
      };
    case "3-6":
      return {
        targetAgeLabel: AGE_LABELS[targetAge],
        ageGuidance: [
          "允许 1-2 个辅助元素参与叙事，但主体仍需压倒性清晰",
          "强调肢体动作与表情，帮助儿童快速理解情绪和故事推进",
        ],
        colorRules: [
          ...common.colorRules,
          "使用柔和、温暖、可亲近的色彩体系，可加入少量高亮点缀增强趣味",
        ],
        compositionRules: [
          "以中景、近景和稳定全景为主，确保情节可读性优先于炫技镜头",
          "前中后景关系要清晰，但不要让景深过于复杂",
        ],
        detailRules: [
          "场景细节可适度丰富，但每页仍需保持单一叙事中心",
          "道具与背景元素应服务主情节，不要喧宾夺主",
        ],
        textSafeAreaRules: common.textSafeAreaRules,
      };
    case "6-9":
      return {
        targetAgeLabel: AGE_LABELS[targetAge],
        ageGuidance: [
          "允许更完整的空间层次和探索感，适合承载轻科普与轻冒险内容",
          "可引入更明显的镜头变化，但仍需保证阅读流向清晰",
        ],
        colorRules: [
          ...common.colorRules,
          "可使用更丰富的邻近色与互补点缀，但整体需保持风格统一",
        ],
        compositionRules: [
          "支持中景、大全景与局部特写交替使用，构建更完整的故事节奏",
          "允许环境叙事增强，但主体必须仍为构图核心",
        ],
        detailRules: [
          "提升场景信息密度，但要按前景/中景/背景分层呈现",
          "适度增加道具、空间和动作细节，增强探索性",
        ],
        textSafeAreaRules: common.textSafeAreaRules,
      };
    case "9-12":
      return {
        targetAgeLabel: AGE_LABELS[targetAge],
        ageGuidance: [
          "允许更复杂的环境叙事、象征性构图与更强的故事推进感",
          "可支撑经典改编、成长冒险和科普说明等更高信息密度场景",
        ],
        colorRules: [
          ...common.colorRules,
          "可使用更成熟的色彩组织方式，但必须避免阴郁压抑与成人化审美倾向",
        ],
        compositionRules: [
          "支持更强的视角变化与纵深组织，但阅读路径必须清晰",
          "可通过光影与构图强化情绪转折，但不制造压迫与惊悚感",
        ],
        detailRules: [
          "允许更丰富的背景与象征细节，但必须与叙事相关",
          "角色动作与环境状态应更自然、写实、可追踪",
        ],
        textSafeAreaRules: common.textSafeAreaRules,
      };
  }
}
