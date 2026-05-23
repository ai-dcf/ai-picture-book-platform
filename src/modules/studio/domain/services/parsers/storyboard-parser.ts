import type { StoryboardData, StoryboardPageData } from "@/types/picturebook";
import { extractJSON } from "./story-parser";

export interface StoryboardOutlinePageDraft {
  pageIndex: number;
  text: string;
  visualSummary: string;
}

export interface StoryboardVisualGoalDraft {
  pageIndex: number;
  visualGoal: string;
}

export function parseStoryboardResponse(raw: string, pageCount: number): StoryboardData {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json);

  const pages: StoryboardPageData[] = (parsed.pages || [])
    .slice(0, pageCount)
    .map((p: Record<string, unknown>, i: number) => ({
      pageIndex: i,
      text: String(p.text || ""),
      visualGoal: String(p.visualGoal || ""),
      userModified: false,
    }));

  while (pages.length < pageCount) {
    pages.push({
      pageIndex: pages.length,
      text: "",
      visualGoal: "",
      userModified: false,
    });
  }

  return { pages, generating: false };
}

export function parseStoryboardOutlineResponse(raw: string, pageCount: number): StoryboardOutlinePageDraft[] {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json);

  const pages: StoryboardOutlinePageDraft[] = (parsed.pages || [])
    .slice(0, pageCount)
    .map((p: Record<string, unknown>, i: number) => ({
      pageIndex: i,
      text: String(p.text || ""),
      visualSummary: String(p.visualSummary || ""),
    }));

  while (pages.length < pageCount) {
    pages.push({
      pageIndex: pages.length,
      text: "",
      visualSummary: "",
    });
  }

  return pages;
}

export function parseStoryboardVisualGoalBatchResponse(
  raw: string,
  pageIndexes: number[]
): StoryboardVisualGoalDraft[] {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json);

  const pageMap = new Map<number, string>();
  for (const p of parsed.pages || []) {
    const idx = Number(p.pageIndex);
    if (pageIndexes.includes(idx) && typeof p.visualGoal === "string") {
      pageMap.set(idx, p.visualGoal);
    }
  }

  return pageIndexes
    .filter((idx) => pageMap.has(idx))
    .map((idx) => ({
      pageIndex: idx,
      visualGoal: pageMap.get(idx)!,
    }));
}
