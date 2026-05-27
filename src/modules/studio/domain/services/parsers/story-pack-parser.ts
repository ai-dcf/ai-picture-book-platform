import type {
  ArtStyle,
  CoverData,
  PageCount,
  StoryData,
  StoryboardData,
  TargetAge,
} from "@/types/picturebook";
import { extractJSON, parseStoryResponse } from "./story-parser";
import { parseStoryboardResponse, parseCoverResponse } from "./storyboard-parser";
import type { StoryPackCheckReport, StoryPackData, StoryPackMeta } from "@/prompts/builders/story-pack";

const TARGET_AGE_CHOICES: TargetAge[] = ["1-3", "3-5", "5-7", "7-9"];
const PAGE_COUNT_CHOICES: Array<Exclude<PageCount, "auto">> = [8, 12, 16, 24, 32];
const ART_STYLE_CHOICES: ArtStyle[] = [
  "水彩温暖风",
  "蜡笔童趣风",
  "剪纸拼贴风",
  "日系清新风",
  "素描淡彩风",
  "波普大胆风",
  "水墨东方风",
  "极简线条风",
];

function coerceTargetAge(value: unknown): TargetAge {
  const v = String(value || "").trim() as TargetAge;
  return TARGET_AGE_CHOICES.includes(v) ? v : "3-5";
}

function coercePageCount(value: unknown): Exclude<PageCount, "auto"> {
  const n = Number(value);
  return (PAGE_COUNT_CHOICES as number[]).includes(n) ? (n as Exclude<PageCount, "auto">) : 16;
}

function coerceArtStyle(value: unknown): ArtStyle {
  const v = String(value || "").trim() as ArtStyle;
  return ART_STYLE_CHOICES.includes(v) ? v : "水彩温暖风";
}

export function parseStoryPackGeneratorResponse(raw: string): StoryPackData {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const metaRaw = (parsed.meta || {}) as Record<string, unknown>;
  const meta: StoryPackMeta = {
    targetAge: coerceTargetAge(metaRaw.targetAge),
    pageCount: coercePageCount(metaRaw.pageCount),
    artStyle: coerceArtStyle(metaRaw.artStyle),
    rationale: String(metaRaw.rationale || "").trim(),
  };

  const story: StoryData = parseStoryResponse(JSON.stringify(parsed.story || {}));
  const storyboard: StoryboardData = parseStoryboardResponse(
    JSON.stringify(parsed.storyboard || {}),
    meta.pageCount
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
