import type { AspectRatio, ArtStyle, PageCount, ProjectInfo, TargetAge } from "@/types/picturebook";
import type { PromptCustomParams, PromptGenre } from "@/prompts/types";

export interface PromptValidationCase {
  id: string;
  name: string;
  projectInfo: ProjectInfo;
  customParams: PromptCustomParams;
  pagesToRender: number;
}

function createProjectInfo(params: {
  id: string;
  title: string;
  targetAge: Exclude<TargetAge, "auto">;
  artStyle: Exclude<ArtStyle, "auto">;
  aspectRatio: AspectRatio;
  pageCount?: Exclude<PageCount, "auto">;
}): ProjectInfo {
  return {
    projectId: `validation_${params.id}`,
    title: params.title,
    targetAge: params.targetAge,
    artStyle: params.artStyle,
    aspectRatio: params.aspectRatio,
    pageCount: params.pageCount || 8,
    saveStatus: "saved",
    projectStatus: "draft",
  };
}

function createCustomParams(genre: PromptGenre, educationalGoal?: string): PromptCustomParams {
  return {
    genre,
    educationalGoal,
    safetyLevel: "strict",
  };
}

export const PROMPT_VALIDATION_CASES: PromptValidationCase[] = [
  {
    id: "case-a",
    name: "原创童话 / 3-6 / 水彩温暖风 / 16:9",
    projectInfo: createProjectInfo({
      id: "case-a",
      title: "会发光的小种子和森林里的春天",
      targetAge: "3-6",
      artStyle: "水彩温暖风",
      aspectRatio: "16:9",
    }),
    customParams: createCustomParams("原创童话", "帮助孩子理解分享、耐心与成长"),
    pagesToRender: 4,
  },
  {
    id: "case-b",
    name: "科普启蒙 / 6-9 / 极简线条风 / 3:4",
    projectInfo: createProjectInfo({
      id: "case-b",
      title: "四季为什么会变化",
      targetAge: "6-9",
      artStyle: "极简线条风",
      aspectRatio: "3:4",
    }),
    customParams: createCustomParams("科普启蒙", "帮助孩子理解地球公转与四季变化"),
    pagesToRender: 4,
  },
  {
    id: "case-c",
    name: "经典改编 / 6-9 / 水墨东方风 / 16:9",
    projectInfo: createProjectInfo({
      id: "case-c",
      title: "守信的小桥边",
      targetAge: "6-9",
      artStyle: "水墨东方风",
      aspectRatio: "16:9",
    }),
    customParams: {
      ...createCustomParams("经典改编", "帮助孩子理解守信与承担"),
      culturalTone: "东方古典、含蓄、留白克制",
      adaptationPolicy: "保留经典伦理内核，避免沉重惩罚感",
    },
    pagesToRender: 4,
  },
  {
    id: "case-d",
    name: "冒险成长 / 9-12 / 日系清新风 / 9:16",
    projectInfo: createProjectInfo({
      id: "case-d",
      title: "风筝邮差穿越雾谷",
      targetAge: "9-12",
      artStyle: "日系清新风",
      aspectRatio: "9:16",
    }),
    customParams: createCustomParams("冒险成长", "帮助孩子理解勇气、协作与解决问题"),
    pagesToRender: 4,
  },
  {
    id: "case-e",
    name: "低幼认知启蒙 / 0-3 / 蜡笔童趣风 / 1:1",
    projectInfo: createProjectInfo({
      id: "case-e",
      title: "圆圆和方方找朋友",
      targetAge: "0-3",
      artStyle: "蜡笔童趣风",
      aspectRatio: "1:1",
    }),
    customParams: createCustomParams("低幼认知启蒙", "帮助孩子认识形状、表情和基础社交"),
    pagesToRender: 4,
  },
];
