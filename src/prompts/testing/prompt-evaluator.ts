import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAssetPrompt, buildPagePrompt, buildPromptRuleBundle } from "@/prompts";
import type { PromptCustomParams } from "@/prompts";
import { generateAssetImage } from "@/modules/studio/application/use-cases/generate-asset-image";
import { generatePageImage } from "@/modules/studio/application/use-cases/generate-page-image";
import { generateStory } from "@/modules/studio/application/use-cases/generate-story";
import { generateStoryboard } from "@/modules/studio/application/use-cases/generate-storyboard";
import type {
  AssetItem,
  AssetsData,
  PageItem,
  ProjectInfo,
  StoryData,
  StoryEntry,
  StoryboardPageData,
} from "@/types/picturebook";
import { PROMPT_VALIDATION_CASES, type PromptValidationCase } from "@/prompts/testing/sample-cases";

interface CaseArtifact {
  caseId: string;
  caseName: string;
  projectInfo: ProjectInfo;
  customParams: PromptCustomParams;
  story: StoryData;
  storyboardPages: StoryboardPageData[];
  assets: AssetsData;
  pages: Array<{
    index: number;
    prompt: string;
    imageUrl: string;
    imageRefCount: number;
  }>;
  metrics: {
    consistency: number;
    styleFidelity: number;
    compliance: number;
  };
  notes: string[];
}

export interface PromptValidationReport {
  generatedAt: string;
  validationMode: string;
  cases: CaseArtifact[];
  summary: {
    averageConsistency: number;
    averageStyleFidelity: number;
    averageCompliance: number;
  };
  reportPaths: {
    json: string;
    markdown: string;
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function createCharacterAsset(entry: StoryEntry, index: number): AssetItem {
  return {
    id: `character-${index}-${entry.name}`,
    name: entry.name,
    description: entry.description,
    prompt: "",
    promptUserEdited: false,
    status: "not_generated",
    aspectRatio: "9:16",
    baseImageUrl: null,
    candidates: [],
    officialImageUrl: null,
    officialIndex: null,
    generating: false,
    generatingPhase: null,
    baseImageHistory: [],
    candidateHistory: [],
  };
}

function createSceneAsset(entry: StoryEntry, index: number, projectInfo: ProjectInfo): AssetItem {
  return {
    id: `scene-${index}-${entry.name}`,
    name: entry.name,
    description: entry.description,
    prompt: "",
    promptUserEdited: false,
    status: "not_generated",
    aspectRatio: projectInfo.aspectRatio,
    baseImageUrl: null,
    candidates: [],
    officialImageUrl: null,
    officialIndex: null,
    generating: false,
    generatingPhase: null,
    baseImageHistory: [],
    candidateHistory: [],
  };
}

function createPageItem(page: StoryboardPageData, projectInfo: ProjectInfo): PageItem {
  return {
    index: page.pageIndex,
    storyText: page.text,
    pageText: page.text,
    visualGoal: page.visualGoal,
    storyboardEdited: false,
    characterRefs: [],
    sceneRefs: [],
    prompt: "",
    promptUserEdited: false,
    imageUrl: null,
    imageHistory: [],
    pageStatus: "idle",
    generating: false,
    imageRefs: [],
    aspectRatio: projectInfo.aspectRatio,
  };
}

function collectReferencedEntries(
  story: StoryData,
  _storyboardPages: StoryboardPageData[],
  projectInfo: ProjectInfo
): AssetsData {
  return {
    characters: story.characters
      .map((entry, index) => createCharacterAsset(entry, index)),
    scenes: story.scenes
      .map((entry, index) => createSceneAsset(entry, index, projectInfo)),
  };
}

function buildCaseMetrics(
  projectInfo: ProjectInfo,
  customParams: PromptCustomParams,
  assets: AssetsData,
  pages: Array<{ prompt: string; imageRefCount: number }>
): CaseArtifact["metrics"] {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const pagePromptCorpus = pages.map((page) => page.prompt).join("\n");

  const consistencyHits = [
    assets.characters.every((asset) => Boolean(asset.officialImageUrl)),
    assets.scenes.every((asset) => Boolean(asset.officialImageUrl)),
    pages.every((page) => page.imageRefCount > 0 || assets.characters.length === 0 && assets.scenes.length === 0),
    pagePromptCorpus.includes("连续性规则"),
    pagePromptCorpus.includes("角色细节 Character Details") || assets.characters.length === 0,
  ].filter(Boolean).length;

  const styleHits = [
    pagePromptCorpus.includes(rules.style.styleLabel),
    rules.style.colorRules.every((rule) => pagePromptCorpus.includes(rule)),
    rules.style.textureRules.every((rule) => pagePromptCorpus.includes(rule)),
    pages.every((page) => page.prompt.includes(`受众 Audience: ${rules.context.targetAge}`)),
    pages.every((page) => page.prompt.includes(`模型参数 Model Tags: ${rules.model.parameterTags.join("; ")}`)),
  ].filter(Boolean).length;

  const complianceHits = [
    pagePromptCorpus.includes("合规规则"),
    rules.compliance.negativeRules.every((rule) => pagePromptCorpus.includes(rule)),
    rules.compliance.positiveRules.every((rule) => pagePromptCorpus.includes(rule)),
    rules.model.negativePrompt.length > 0,
    rules.compliance.negativePrompt.length > 0,
  ].filter(Boolean).length;

  return {
    consistency: round((consistencyHits / 5) * 5),
    styleFidelity: round((styleHits / 5) * 5),
    compliance: round((complianceHits / 5) * 5),
  };
}

function buildMarkdownReport(report: PromptValidationReport): string {
  const lines = [
    "# 绘本提示词验证报告",
    "",
    `- 生成时间：${report.generatedAt}`,
    `- 验证模式：${report.validationMode}`,
    `- 一致性均分：${report.summary.averageConsistency}`,
    `- 风格还原度均分：${report.summary.averageStyleFidelity}`,
    `- 合规性均分：${report.summary.averageCompliance}`,
    "",
  ];

  for (const artifact of report.cases) {
    lines.push(`## ${artifact.caseName}`);
    lines.push("");
    lines.push(`- 题材：${artifact.customParams.genre || "通用儿童绘本"}`);
    lines.push(`- 项目设定：${artifact.projectInfo.targetAge} / ${artifact.projectInfo.artStyle} / ${artifact.projectInfo.aspectRatio}`);
    lines.push(`- 一致性：${artifact.metrics.consistency}`);
    lines.push(`- 风格还原度：${artifact.metrics.styleFidelity}`);
    lines.push(`- 合规性：${artifact.metrics.compliance}`);
    lines.push(`- 备注：${artifact.notes.join("；")}`);
    lines.push("");
    lines.push("### 页面结果");
    lines.push("");
    for (const page of artifact.pages) {
      lines.push(`- 第 ${page.index + 1} 页：refs=${page.imageRefCount}，image=${page.imageUrl.slice(0, 120)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function persistReport(report: Omit<PromptValidationReport, "reportPaths">) {
  const projectRoot = process.env.INIT_CWD || process.cwd();
  const reportDir = path.join(projectRoot, "docs", "superpowers", "reports");
  await mkdir(reportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(reportDir, `${timestamp}-picture-book-prompt-validation.json`);
  const markdownPath = path.join(reportDir, `${timestamp}-picture-book-prompt-validation.md`);
  const fullReport: PromptValidationReport = {
    ...report,
    reportPaths: {
      json: jsonPath,
      markdown: markdownPath,
    },
  };

  await writeFile(jsonPath, JSON.stringify(fullReport, null, 2), "utf8");
  await writeFile(markdownPath, buildMarkdownReport(fullReport), "utf8");
  console.info("[提示词验证] 报告已写入", { projectRoot, jsonPath, markdownPath });
  return fullReport;
}

async function persistProgress(cases: CaseArtifact[]) {
  const projectRoot = process.env.INIT_CWD || process.cwd();
  const reportDir = path.join(projectRoot, "docs", "superpowers", "reports");
  await mkdir(reportDir, { recursive: true });
  const progressPath = path.join(reportDir, "picture-book-prompt-validation-progress.json");
  await writeFile(
    progressPath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        completedCases: cases.length,
        cases,
      },
      null,
      2
    ),
    "utf8"
  );
  console.info("[提示词验证] 进度已写入", { progressPath, completedCases: cases.length });
}

async function runSingleCase(validationCase: PromptValidationCase): Promise<CaseArtifact> {
  const storyResult = await generateStory(validationCase.projectInfo, validationCase.customParams);
  if (!storyResult.success || !storyResult.data) {
    throw new Error(`[${validationCase.name}] 故事生成失败: ${storyResult.error?.message || "未知错误"}`);
  }

  const storyboardResult = await generateStoryboard(
    storyResult.data,
    validationCase.projectInfo,
    validationCase.customParams
  );
  if (!storyboardResult.success || !storyboardResult.data) {
    throw new Error(`[${validationCase.name}] 分镜生成失败: ${storyboardResult.error?.message || "未知错误"}`);
  }

  const storyboardPages = storyboardResult.data.pages.slice(0, validationCase.pagesToRender);
  const assets = collectReferencedEntries(storyResult.data, storyboardPages, validationCase.projectInfo);

  for (const asset of [...assets.characters, ...assets.scenes]) {
    const imageResult = await generateAssetImage(asset, validationCase.projectInfo, validationCase.customParams);
    if (!imageResult.success || !imageResult.data) {
      throw new Error(`[${validationCase.name}] 资产生成失败 ${asset.name}: ${imageResult.error?.message || "未知错误"}`);
    }
    asset.officialImageUrl = imageResult.data;
    asset.baseImageUrl = imageResult.data;
    asset.officialIndex = 0;
    asset.status = "official_confirmed";
    asset.prompt = buildAssetPrompt({
      kind: asset.id.startsWith("scene-") ? "scene" : "character",
      name: asset.name,
      description: asset.description,
      projectInfo: {
        ...validationCase.projectInfo,
        aspectRatio: asset.aspectRatio,
      },
      customParams: validationCase.customParams,
    });
  }

  const pageArtifacts: CaseArtifact["pages"] = [];
  for (const storyboardPage of storyboardPages) {
    const page = createPageItem(storyboardPage, validationCase.projectInfo);
    const promptResult = buildPagePrompt({
      pageIndex: page.index,
      page,
      storyboardPage,
      assets,
      projectInfo: validationCase.projectInfo,
      customParams: validationCase.customParams,
    });
    const imageResult = await generatePageImage(
      page,
      assets,
      validationCase.projectInfo,
      storyboardPage,
      validationCase.customParams
    );
    if (!imageResult.success || !imageResult.data) {
      throw new Error(`[${validationCase.name}] 页面生成失败 P${page.index + 1}: ${imageResult.error?.message || "未知错误"}`);
    }

    pageArtifacts.push({
      index: page.index,
      prompt: promptResult.prompt,
      imageUrl: imageResult.data,
      imageRefCount: promptResult.imageRefs.length,
    });
  }

  const metrics = buildCaseMetrics(validationCase.projectInfo, validationCase.customParams, assets, pageArtifacts);
  const notes = [
    "已在真实模型链路下完成故事、分镜、资产和页面生成",
    "当前自动评分基于提示词命中率、参考图连续性和合规参数覆盖率",
    "最终画面审美仍建议在产品侧进行人工抽检",
  ];

  return {
    caseId: validationCase.id,
    caseName: validationCase.name,
    projectInfo: validationCase.projectInfo,
    customParams: validationCase.customParams,
    story: storyResult.data,
    storyboardPages,
    assets,
    pages: pageArtifacts,
    metrics,
    notes,
  };
}

export async function runPromptValidationSuite(): Promise<PromptValidationReport> {
  const artifacts: CaseArtifact[] = [];

  for (const validationCase of PROMPT_VALIDATION_CASES) {
    artifacts.push(await runSingleCase(validationCase));
    await persistProgress(artifacts);
  }

  const report = await persistReport({
    generatedAt: new Date().toISOString(),
    validationMode: "真实模型生成 + 工程规则自动评分",
    cases: artifacts,
    summary: {
      averageConsistency: round(
        artifacts.reduce((sum, item) => sum + item.metrics.consistency, 0) / artifacts.length
      ),
      averageStyleFidelity: round(
        artifacts.reduce((sum, item) => sum + item.metrics.styleFidelity, 0) / artifacts.length
      ),
      averageCompliance: round(
        artifacts.reduce((sum, item) => sum + item.metrics.compliance, 0) / artifacts.length
      ),
    },
  });

  return report;
}
