import type { ArtStyle, PageCount, ProjectConfigRecommendation, TargetAge } from "@/types/picturebook";
import { ART_STYLES, PAGE_COUNTS, TARGET_AGES } from "@/types/picturebook";
import { extractJSON } from "./story-parser";

const ART_STYLE_ALIASES: Record<string, Exclude<ArtStyle, "auto">> = {
  "温暖手绘水彩风格": "水彩温暖风",
  "温暖水彩风": "水彩温暖风",
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validTargetAges(): Array<Exclude<TargetAge, "auto">> {
  return TARGET_AGES.filter((v): v is Exclude<TargetAge, "auto"> => v !== "auto");
}

function validPageCounts(): Array<Exclude<PageCount, "auto">> {
  return PAGE_COUNTS.filter((v): v is Exclude<PageCount, "auto"> => v !== "auto");
}

function validArtStyles(): Array<Exclude<ArtStyle, "auto">> {
  return ART_STYLES.filter((v): v is Exclude<ArtStyle, "auto"> => v !== "auto");
}

function parseRecommendedPageCount(value: unknown): Exclude<PageCount, "auto"> | null {
  if (typeof value === "number") return validPageCounts().includes(value as any) ? (value as any) : null;
  const text = normalizeText(value);
  if (!text) return null;
  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  return validPageCounts().includes(num as any) ? (num as any) : null;
}

export function parseProjectConfigRecommendResponse(raw: string): ProjectConfigRecommendation {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const result: ProjectConfigRecommendation = {};

  const targetAge = normalizeText(parsed.recommendedTargetAge);
  if (targetAge && validTargetAges().includes(targetAge as any)) {
    result.recommendedTargetAge = targetAge as Exclude<TargetAge, "auto">;
  }

  const pageCount = parseRecommendedPageCount(parsed.recommendedPageCount);
  if (pageCount) {
    result.recommendedPageCount = pageCount;
  }

  const artStyleRaw = normalizeText(parsed.recommendedArtStyle);
  const artStyle = artStyleRaw ? (ART_STYLE_ALIASES[artStyleRaw] || artStyleRaw) : null;
  if (artStyle && validArtStyles().includes(artStyle as any)) {
    result.recommendedArtStyle = artStyle as Exclude<ArtStyle, "auto">;
  }

  return result;
}

