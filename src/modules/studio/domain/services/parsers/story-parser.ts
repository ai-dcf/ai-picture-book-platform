import type {
  ArtStyle,
  EmotionCurvePoint,
  PageCount,
  StoryData,
  StoryEntry,
  TargetAge,
} from "@/types/picturebook";

export function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }

  return text.trim();
}

export function parseStoryResponse(raw: string): StoryData & {
  recommendedTargetAge?: TargetAge;
  recommendedArtStyle?: ArtStyle;
  recommendedPageCount?: PageCount;
} {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json);

  const characters: StoryEntry[] = (parsed.characters || []).map(
    (c: Record<string, string>) => ({
      name: c.name || "未命名角色",
      description: c.description || "",
      userModified: false,
    })
  );

  const scenes: StoryEntry[] = (parsed.scenes || []).map(
    (s: Record<string, string>) => ({
      name: s.name || "未命名场景",
      description: s.description || "",
      userModified: false,
    })
  );

  const emotionCurve: EmotionCurvePoint[] = (parsed.emotionCurve || []).map(
    (e: Record<string, unknown>) => ({
      label: String(e.label || ""),
      emotion: String(e.emotion || "平静"),
      intensity: Number(e.intensity) || 0,
      isTurningPoint: Boolean(e.isTurningPoint),
    })
  );

  const result: StoryData & {
    recommendedTargetAge?: TargetAge;
    recommendedArtStyle?: ArtStyle;
    recommendedPageCount?: PageCount;
  } = {
    oneLineStory: parsed.oneLineStory || "",
    characters,
    storyOutline: parsed.storyOutline || "",
    emotionCurve,
    scenes,
    generating: false,
  };

  // 提取推荐参数
  if (parsed.recommendedTargetAge && parsed.recommendedTargetAge !== "auto") {
    result.recommendedTargetAge = parsed.recommendedTargetAge as Exclude<TargetAge, "auto">;
  }
  if (parsed.recommendedArtStyle && parsed.recommendedArtStyle !== "auto") {
    result.recommendedArtStyle = parsed.recommendedArtStyle as Exclude<ArtStyle, "auto">;
  }
  if (parsed.recommendedPageCount && parsed.recommendedPageCount !== "auto") {
    result.recommendedPageCount = parsed.recommendedPageCount as Exclude<PageCount, "auto">;
  }

  return result;
}
