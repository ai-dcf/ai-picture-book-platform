import type { ProjectInfo, ProjectStatus, StageNumber } from "@/types/picturebook";

export interface ProjectHistoryEntry extends ProjectInfo {
  currentStage: StageNumber;
  createdAt: number;
  updatedAt: number;
  thumbnailUrl?: string;
}
