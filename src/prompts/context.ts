import type { AspectRatio, ArtStyle, PageCount, ProjectInfo, TargetAge } from "@/types/picturebook";
import type { PromptContext, PromptCustomParams } from "@/prompts/types";

function normalizeTargetAge(targetAge: TargetAge): Exclude<TargetAge, "auto"> {
  return targetAge === "auto" ? "3-6" : targetAge;
}

function normalizeArtStyle(artStyle: ArtStyle): Exclude<ArtStyle, "auto"> {
  return artStyle === "auto" ? "水彩温暖风" : artStyle;
}

function normalizePageCount(pageCount: PageCount): Exclude<PageCount, "auto"> {
  return pageCount === "auto" ? 16 : pageCount;
}

function normalizeAspectRatio(aspectRatio: AspectRatio): AspectRatio {
  return aspectRatio || "16:9";
}

export function buildPromptContext(
  projectInfo: ProjectInfo,
  customParams: PromptCustomParams = {}
): PromptContext {
  return {
    title: projectInfo.title || "待定",
    targetAge: normalizeTargetAge(projectInfo.targetAge),
    artStyle: normalizeArtStyle(projectInfo.artStyle),
    aspectRatio: normalizeAspectRatio(projectInfo.aspectRatio),
    pageCount: normalizePageCount(projectInfo.pageCount),
    genre: customParams.genre,
    tone: customParams.tone,
    educationalGoal: customParams.educationalGoal,
    culturalTone: customParams.culturalTone,
    customRequirements: customParams.extraVisualRules,
  };
}
