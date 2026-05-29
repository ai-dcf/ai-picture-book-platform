import type { ComplianceRuleSet, PromptCustomParams, PromptSafetyLevel } from "@/prompts/types";

function getSafetyLevel(customParams: PromptCustomParams): PromptSafetyLevel {
  return customParams.safetyLevel || "strict";
}

export function getComplianceSpec(customParams: PromptCustomParams = {}): ComplianceRuleSet {
  const safetyLevel = getSafetyLevel(customParams);

  const positiveRules = [
    "内容必须适龄、温和、积极、健康，符合儿童绘本阅读场景",
    "画面应突出安全感、亲和力和清晰叙事，不制造持续压迫与焦虑",
    "文化表达需稳妥、自然，不堆砌符号，不使用不明来源的混搭文化元素",
  ];

  const negativeRules = [
    "不得出现恐怖、血腥、肢解、惊吓、成人化、性暗示、政治煽动、宗教极端、歧视性内容",
    "不得出现不适龄服饰、姿态、表情和身体比例夸张带来的不适感",
    "不得生成文字、水印、Logo、签名、边框、UI 截图感元素",
  ];

  if (safetyLevel === "strict") {
    positiveRules.push("如存在冲突，优先保证适龄安全与儿童友好，再考虑戏剧张力");
    negativeRules.push("不得将危险行为、灾难场景或高风险动作表现得刺激、酷炫或值得模仿");
  }

  if (customParams.extraComplianceRules?.length) {
    positiveRules.push(...customParams.extraComplianceRules);
  }

  return {
    positiveRules,
    negativeRules,
    negativePrompt: [
      "text",
      "watermark",
      "logo",
      "signature",
      "frame",
      "border",
      "UI",
      "deformed",
      "disfigured",
      "extra limbs",
      "extra fingers",
      "missing fingers",
      "bad hands",
      "bad anatomy",
      "blurry",
      "lowres",
      "noise",
      "jpeg artifacts",
      "scary",
      "gore",
      "violence",
      "horror",
      "sexualized",
      "disturbing expression",
      "unsafe behavior glamorization",
    ],
  };
}
