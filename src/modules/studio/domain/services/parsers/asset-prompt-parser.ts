import type { AssetPromptResult } from "@/types/picturebook";
import { extractJSON } from "./story-parser";

type AssetPromptField = "appearanceDescription" | "sceneDescription";
type ExtendedAssetPromptField = AssetPromptField | "visualDescription";

function sanitizePromptText(text: unknown): string {
  return String(text || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseAssetPromptBatchResponse(
  raw: string,
  fieldName: ExtendedAssetPromptField
): Array<AssetPromptResult & { rawPrompt: string }> {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json) as Record<string, unknown> | Array<Record<string, unknown>>;
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.prompts)
      ? (parsed.prompts as Array<Record<string, unknown>>)
      : [];

  return items
    .map(item => {
      const id = String(item.id || "").trim();
      const rawPrompt = sanitizePromptText(item[fieldName]);
      if (!id || !rawPrompt) return null;
      return { id, prompt: rawPrompt, rawPrompt };
    })
    .filter((item): item is AssetPromptResult & { rawPrompt: string } => Boolean(item));
}
