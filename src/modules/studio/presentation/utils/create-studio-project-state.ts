"use client";

import type {
  ArtStyle,
  CoverData,
  EditorPageState,
  PageCount,
  PageItem,
  PictureBookState,
  ProjectInfo,
  StageStatus,
  TargetAge,
} from "@/types/picturebook";
import { defaultTextBoxLayout, defaultTextBoxStyle } from "@/types/picturebook";

const DEFAULT_PAGE_COUNT = 24;

function resolveInitialPageCount(pageCount: PageCount): number {
  return pageCount === "auto" ? DEFAULT_PAGE_COUNT : pageCount;
}

function buildInitialPages(count: number): PageItem[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    storyText: "",
    pageText: "",
    visualGoal: "",
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
    aspectRatio: undefined,
  }));
}

function buildInitialEditorStates(count: number): EditorPageState[] {
  return Array.from({ length: count }, () => ({
    textContent: "",
    style: { ...defaultTextBoxStyle },
    layout: { ...defaultTextBoxLayout },
    confirmed: false,
  }));
}

function buildInitialCover(projectInfo: ProjectInfo): CoverData {
  return {
    title: projectInfo.title,
    visualGoal: "",
    userModified: false,
    prompt: "",
    promptUserEdited: false,
    imageUrl: null,
    imageHistory: [],
    status: "idle",
    generating: false,
    imageRefs: [],
    aspectRatio: projectInfo.aspectRatio,
  };
}

export function createStudioProjectState({
  projectId,
  title,
  targetAge,
  pageCount,
  artStyle,
}: {
  projectId: string;
  title: string;
  targetAge: TargetAge;
  pageCount: PageCount;
  artStyle: ArtStyle;
}): PictureBookState {
  const projectInfo: ProjectInfo = {
    projectId,
    title,
    targetAge,
    pageCount,
    artStyle,
    aspectRatio: "3:4",
    saveStatus: "saved",
    projectStatus: "draft",
  };

  const initialPageCount = resolveInitialPageCount(pageCount);
  const stageStatuses: Record<1 | 2 | 3 | 4 | 5, StageStatus> = {
    1: "done",
    2: "in-progress",
    3: "idle",
    4: "idle",
    5: "idle",
  };

  return {
    projectInfo,
    currentStage: 2,
    stageStatuses,
    story: {
      characters: [],
      storyOutline: "",
      scenes: [],
      generating: false,
    },
    storyboard: {
      pages: Array.from({ length: initialPageCount }, (_, index) => ({
        pageIndex: index,
        text: "",
        visualGoal: "",
        userModified: false,
      })),
      generating: false,
    },
    cover: buildInitialCover(projectInfo),
    assets: {
      characters: [],
      scenes: [],
    },
    pages: buildInitialPages(initialPageCount),
    editorStates: buildInitialEditorStates(initialPageCount),
  };
}
