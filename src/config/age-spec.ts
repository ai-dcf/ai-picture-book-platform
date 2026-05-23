import type { TargetAge } from "@/types/picturebook";

export type ConcreteTargetAge = Exclude<TargetAge, "auto">;

export type AgeGroupKey = "toddler" | "preschool" | "early_reader" | "older";

export interface AgeGroupConfig {
  key: AgeGroupKey;
  label: string;
  pageTextPrompt: string;
}

const AGE_GROUP_MAP: Record<ConcreteTargetAge, AgeGroupKey> = {
  "1-3": "toddler",
  "3-5": "preschool",
  "5-7": "early_reader",
  "7-9": "older",
};

export const AGE_GROUP_CONFIGS: Record<AgeGroupKey, AgeGroupConfig> = {
  toddler: {
    key: "toddler",
    label: "1-3 岁低幼认知",
    pageTextPrompt:
      "适配1-3岁婴幼儿：每页文字尽量控制在8字以内，平均4字左右；句子极短，多用日常名词、拟声词和基础动词；鼓励重复句式，便于模仿和记忆；只表达单一动作或直接可理解的信息，避免抽象概念和复杂因果。",
  },
  preschool: {
    key: "preschool",
    label: "3-5 岁儿童绘本",
    pageTextPrompt:
      "适配3-5岁儿童：每页文字控制在10-20字，句子简短清楚；使用常见名词、基础形容词和简单连接词；可以适度重复句式；内容要有清晰顺序和简单问题解决，避免复杂复合句、抽象表达和跳跃叙事。",
  },
  early_reader: {
    key: "early_reader",
    label: "5-7 岁少儿读物",
    pageTextPrompt:
      "适配5-7岁儿童：每页文字控制在20-35字，句子可以稍长但仍需清晰易读；可加入少量对话和较丰富词汇；鼓励完整叙事和明确情节推进；避免过度重复，也避免过于抽象或过长难句。",
  },
  older: {
    key: "older",
    label: "7-9 岁少年读物",
    pageTextPrompt:
      "适配7-9岁儿童：每页文字控制在35-50字，可使用更丰富的描写和稍复杂句式；允许适度抽象词汇，但仍需保持儿童可理解；内容可以包含更完整的情节推进、角色冲突或转折，但避免生硬、晦涩和超龄表达。",
  },
};

const DEFAULT_TARGET_AGE: ConcreteTargetAge = "3-5";

export function normalizeTargetAge(targetAge: TargetAge): ConcreteTargetAge {
  return targetAge === "auto" ? DEFAULT_TARGET_AGE : targetAge;
}

export function getAgeGroupKey(targetAge: ConcreteTargetAge): AgeGroupKey {
  return AGE_GROUP_MAP[targetAge];
}

export function getAgeGroupConfig(targetAge: ConcreteTargetAge): AgeGroupConfig {
  return AGE_GROUP_CONFIGS[AGE_GROUP_MAP[targetAge]];
}

export function getAgeLabel(targetAge: ConcreteTargetAge): string {
  return AGE_GROUP_CONFIGS[AGE_GROUP_MAP[targetAge]].label;
}

export function getPageTextPrompt(targetAge: ConcreteTargetAge): string {
  return AGE_GROUP_CONFIGS[AGE_GROUP_MAP[targetAge]].pageTextPrompt;
}
