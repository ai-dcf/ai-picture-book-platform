import { NextRequest, NextResponse } from "next/server";
import { getModelsConfig, loadRawModelsConfig, readModelsConfigYaml } from "@/server/loaders/model-loader";
import { ensureModelsInitialized, reloadModelsConfig, getEnabledTextModels, getEnabledImageModels } from "@/server/services/model-init";
import { resolve } from "path";
import { writeFileSync } from "fs";

export async function GET() {
  try {
    ensureModelsInitialized();
    const config = getModelsConfig();
    const rawConfig = loadRawModelsConfig();
    return NextResponse.json({
      textModels: config.textModels,
      imageModels: config.imageModels,
      rawConfig,
      yamlContent: readModelsConfigYaml(),
      enabledTextModels: getEnabledTextModels(),
      enabledImageModels: getEnabledImageModels(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const yamlContent = body?.yamlContent;

    if (typeof yamlContent !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "PARAM_INVALID", message: "yamlContent must be a string" } },
        { status: 400 }
      );
    }

    const yamlPath = resolve(process.cwd(), "config/models.yaml");
    writeFileSync(yamlPath, yamlContent, "utf-8");

    reloadModelsConfig();

    const config = getModelsConfig();
    return NextResponse.json({
      success: true,
      textModels: config.textModels,
      imageModels: config.imageModels,
      enabledTextModels: getEnabledTextModels(),
      enabledImageModels: getEnabledImageModels(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
