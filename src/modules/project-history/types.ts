import type { ProjectInfo, ProjectStatus } from "@/types/picturebook";

export interface ProjectHistoryEntry extends ProjectInfo {
  createdAt: number;
  updatedAt: number;
  thumbnailUrl?: string;
}
