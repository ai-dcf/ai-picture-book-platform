"use client";

import { useStudio } from "@/modules/studio/presentation/hooks/use-studio";
import { useModelConfig } from "@/modules/model-config/presentation/hooks/use-model-config";
import TopBar from "@/components/studio/TopBar";
import LeftSidebar from "@/components/studio/LeftSidebar";
import { ModelConfigBanner } from "@/components/studio/ModelConfigBanner";
import Stage1Init from "@/components/studio/stages/Stage1Init";
import Stage2Story from "@/components/studio/stages/Stage2Story";
import Stage3Storyboard from "@/components/studio/stages/Stage3Storyboard";
import Stage4Assets from "@/components/studio/stages/Stage4Assets";
import Stage5Pages from "@/components/studio/stages/Stage5Pages";
import Stage6Finalize from "@/components/studio/stages/Stage6Finalize";

function StageContent() {
  const { state } = useStudio();
  const stage = state.currentStage;

  return (
    <div className="flex-1 min-h-0 animate-fade-in">
      {stage === 1 && <Stage1Init />}
      {stage === 2 && <Stage2Story />}
      {stage === 3 && <Stage3Storyboard />}
      {stage === 4 && <Stage4Assets />}
      {stage === 5 && <Stage5Pages />}
      {stage === 6 && <Stage6Finalize />}
    </div>
  );
}

export default function StudioPage() {
  const { state } = useStudio();
  const { config } = useModelConfig();
  const isFullWidth = state.currentStage === 5 || state.currentStage === 6;

  const hasTextModel = (config.textModels.enabledOrder?.length ?? 0) > 0;
  const hasImageModel = (config.imageModels.enabledOrder?.length ?? 0) > 0;
  const needsBanner = !hasTextModel || !hasImageModel;

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      {needsBanner && state.currentStage > 1 && (
        <div className="px-2 sm:px-4 pt-2">
          <ModelConfigBanner missingText={!hasTextModel} missingImage={!hasImageModel} />
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <LeftSidebar />
        {isFullWidth ? (
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <StageContent />
          </main>
        ) : (
          <main className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-3 sm:p-6 h-full flex flex-col">
              <StageContent />
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
