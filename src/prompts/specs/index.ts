import { buildPromptContext } from "@/prompts/context";
import { getComplianceSpec } from "@/prompts/specs/compliance-spec";
import { getContinuitySpec } from "@/prompts/specs/continuity-spec";
import { getGenreSpec } from "@/prompts/specs/genre-spec";
import { getModelSpec } from "@/prompts/specs/model-spec";
import { getStyleSpec } from "@/prompts/specs/style-spec";
import type { ProjectInfo } from "@/types/picturebook";
import type { PromptCustomParams, PromptRuleBundle } from "@/prompts/types";

export function buildPromptRuleBundle(
  projectInfo: ProjectInfo,
  customParams: PromptCustomParams = {}
): PromptRuleBundle {
  const context = buildPromptContext(projectInfo, customParams);

  return {
    context,
    customParams,
    style: getStyleSpec(context.artStyle),
    genre: getGenreSpec(context.genre),
    continuity: getContinuitySpec(),
    compliance: getComplianceSpec(customParams),
    model: getModelSpec(context.aspectRatio),
  };
}
