import type {
  EmotionCurvePoint,
  StoryData,
  StoryEntry,
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

export function parseStoryResponse(raw: string): StoryData {
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

  const result: StoryData = {
    characters,
    storyOutline: parsed.storyOutline || "",
    emotionCurve,
    scenes,
    generating: false,
  };

  return result;
}
