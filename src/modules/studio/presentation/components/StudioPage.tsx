"use client";

import { useStudio } from "@/modules/studio/presentation/hooks/use-studio";
import { useModelConfig } from "@/modules/model-config/presentation/hooks/use-model-config";
import TopBar from "@/modules/studio/presentation/components/TopBar";
import ProjectProgress from "@/modules/studio/presentation/components/ProjectProgress";
import { ModelConfigBanner } from "@/modules/studio/presentation/components/ModelConfigBanner";
import Stage1Init from "@/modules/studio/presentation/components/stages/Stage1Init";
import Stage2Story from "@/modules/studio/presentation/components/stages/Stage2Story";
import Stage4Assets from "@/modules/studio/presentation/components/stages/Stage4Assets";
import Stage5Pages from "@/modules/studio/presentation/components/stages/Stage5Pages";
import Stage6Finalize from "@/modules/studio/presentation/components/stages/Stage6Finalize";

function StageContent() {
  const { state } = useStudio();
  const stage = state.currentStage;

  return (
    <div className="flex-1 min-h-0 animate-fade-in">
      {stage === 1 && <Stage1Init />}
      {stage === 2 && <Stage2Story />}
      {stage === 3 && <Stage4Assets />}
      {stage === 4 && <Stage5Pages />}
      {stage === 5 && <Stage6Finalize />}
    </div>
  );
}

export default function StudioPage() {
  const { state } = useStudio();
  const { config } = useModelConfig();
  const isFullWidth = state.currentStage === 4 || state.currentStage === 5;

  const hasTextModel = (config.textModels.enabledOrder?.length ?? 0) > 0;
  const hasImageModel = (config.imageModels.enabledOrder?.length ?? 0) > 0;
  const needsBanner = !hasTextModel || !hasImageModel;

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      {state.currentStage > 1 && <ProjectProgress />}
      {needsBanner && state.currentStage > 1 && (
        <div className="px-2 sm:px-4 pt-2">
          <ModelConfigBanner missingText={!hasTextModel} missingImage={!hasImageModel} />
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        {isFullWidth ? (
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <StageContent />
          </main>
        ) : (
          <main className="flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto p-3 sm:p-6 h-full flex flex-col">
              <StageContent />
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
