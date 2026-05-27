import type { CoverData, StoryData, StoryboardData } from "@/types/picturebook";
import { extractJSON, parseStoryResponse } from "./story-parser";
import { parseStoryboardResponse, parseCoverResponse } from "./storyboard-parser";
import type { StoryPackCheckReport, StoryPackData, StoryPackMeta } from "@/prompts/builders/story-pack";

function coercePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return i > 0 ? i : fallback;
}

function coerceTargetAge(value: unknown, fallback: string): string {
  const v = String(value || "").trim();
  if (!v) return fallback;
  const match = v.match(/^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/);
  return match ? v.replace(/\s+/g, "") : fallback;
}

export function parseStoryPackGeneratorResponse(raw: string): StoryPackData {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const metaRaw = (parsed.meta || {}) as Record<string, unknown>;
  const pageCount = coercePositiveInt(metaRaw.pageCount, 16);
  const meta: StoryPackMeta = {
    targetAge: coerceTargetAge(metaRaw.targetAge, "3-6") as StoryPackMeta["targetAge"],
    pageCount,
    artStyle: (String(metaRaw.artStyle || "").trim() || "水彩温暖风") as StoryPackMeta["artStyle"],
    rationale: String(metaRaw.rationale || "").trim(),
  };

  const story: StoryData = parseStoryResponse(JSON.stringify(parsed.story || {}));
  const storyboard: StoryboardData = parseStoryboardResponse(
    JSON.stringify(parsed.storyboard || {}),
    pageCount
  );
  const cover: Pick<CoverData, "title" | "visualGoal"> = parseCoverResponse(
    JSON.stringify(parsed.cover || {})
  );

  return { meta, story, storyboard, cover };
}

export function parseStoryPackCheckReport(raw: string): StoryPackCheckReport {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const continuityIssues = Array.isArray(parsed.continuityIssues) ? parsed.continuityIssues : [];
  const densityIssues = Array.isArray(parsed.densityIssues) ? parsed.densityIssues : [];
  const completenessIssues = Array.isArray(parsed.completenessIssues) ? parsed.completenessIssues : [];

  return {
    completenessScore: Number(parsed.completenessScore) || 0,
    completenessIssues: completenessIssues.map((i) => String(i || "")),
    continuityScore: Number(parsed.continuityScore) || 0,
    continuityIssues: continuityIssues.map((i) => ({
      pagePair: String((i as any)?.pagePair || ""),
      issue: String((i as any)?.issue || ""),
    })),
    densityScore: Number(parsed.densityScore) || 0,
    densityIssues: densityIssues.map((i) => ({
      page: Number((i as any)?.page) || 0,
      issue: String((i as any)?.issue || ""),
      suggestion: String((i as any)?.suggestion || ""),
    })),
    overallPass: Boolean(parsed.overallPass),
    summary: String(parsed.summary || ""),
  };
}
