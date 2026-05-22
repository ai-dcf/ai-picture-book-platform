import { NextResponse } from "next/server";
import { runPromptValidationSuite } from "@/prompts/testing/prompt-evaluator";

export const runtime = "nodejs";

export async function POST() {
  try {
    const report = await runPromptValidationSuite();
    return NextResponse.json({ success: true, data: report }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PROMPT_VALIDATION_FAILED",
          message: error instanceof Error ? error.message : "提示词验证失败",
        },
      },
      { status: 500 }
    );
  }
}
