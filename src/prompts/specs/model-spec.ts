import type { AspectRatio } from "@/types/picturebook";
import type { ModelRuleSet } from "@/prompts/types";

const SIZE_HINTS: Record<AspectRatio, string> = {
  "3:4": "768x1024",
  "9:16": "768x1366",
  "16:9": "1366x768",
  "1:1": "1024x1024",
};

export function getModelSpec(aspectRatio: AspectRatio): ModelRuleSet {
  return {
    sizeHint: SIZE_HINTS[aspectRatio],
    parameterTags: [
      `aspect-ratio=${aspectRatio}`,
      `recommended-size=${SIZE_HINTS[aspectRatio]}`,
      "seed=stable-by-project-and-page",
      "reference-images=preferred-when-available",
      "text-safe-area=required",
    ],
    negativePrompt: [
      "text",
      "watermark",
      "logo",
      "signature",
      "frame",
      "border",
      "UI",
      "deformed",
      "bad anatomy",
      "bad hands",
      "lowres",
      "jpeg artifacts",
    ],
  };
}
