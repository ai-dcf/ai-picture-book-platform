import type { StoryboardData, StoryboardPageData, PageTurnMotivation } from "@/types/picturebook";
import { extractJSON } from "./story-parser";

export function parseStoryboardResponse(raw: string, pageCount: number): StoryboardData {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json);

  const validMotivations = new Set<string>(["suspense", "emotion", "discovery", "none"]);

  const pages: StoryboardPageData[] = (parsed.pages || [])
    .slice(0, pageCount)
    .map((p: Record<string, unknown>, i: number) => ({
      pageIndex: i,
      text: String(p.text || ""),
      visualGoal: String(p.visualGoal || ""),
      pageTurnMotivation: (validMotivations.has(String(p.pageTurnMotivation))
        ? String(p.pageTurnMotivation)
        : "none") as PageTurnMotivation,
      characterRefs: Array.isArray(p.characterRefs)
        ? p.characterRefs.map(String)
        : [],
      sceneRefs: Array.isArray(p.sceneRefs) ? p.sceneRefs.map(String) : [],
      userModified: false,
    }));

  while (pages.length < pageCount) {
    pages.push({
      pageIndex: pages.length,
      text: "",
      visualGoal: "",
      pageTurnMotivation: "none" as PageTurnMotivation,
      characterRefs: [],
      sceneRefs: [],
      userModified: false,
    });
  }

  return { spreads: [], pages, generating: false };
}
