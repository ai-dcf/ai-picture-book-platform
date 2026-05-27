"use client";
import React, { createContext, useReducer, useCallback, useRef, useEffect, useState } from 'react';
import {
  PictureBookState,
  ProjectInfo,
  StoryData,
  StoryEntry,
  EmotionCurvePoint,
  CoverData,
  StoryboardData,
  StoryboardPageData,
  AssetItem,
  AssetsData,
  AspectRatio,
  PageItem,
  EditorPageState,
  TextBoxStyle,
  TextBoxLayout,
  StageNumber,
  StageStatus,
  PageStatus,
  AssetStatus,
  ProjectStatus,
  defaultTextBoxStyle,
  defaultTextBoxLayout,
  BASE_IMAGE_HISTORY_LIMIT,
  CANDIDATE_HISTORY_LIMIT,
  BaseImageHistoryEntry,
  CandidateHistoryEntry,
} from '@/types/picturebook';
import { buildUserFriendlyAssetPrompt, buildUserFriendlyAssetPromptFromEntry } from '@/prompts';
import { parseRefTags } from '@/lib/prompt-ref-parser';
import type { ProjectHistoryEntry } from '@/modules/project-history/types';

function buildInitialPages(count: number): PageItem[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    storyText: '',
    pageText: '',
    visualGoal: '',
    storyboardEdited: false,
    characterRefs: [],
    sceneRefs: [],
    prompt: '',
    promptUserEdited: false,
    imageUrl: null,
    pageStatus: 'idle' as PageStatus,
    generating: false,
    imageRefs: [],
    aspectRatio: undefined,
  }));
}

function buildInitialEditorStates(count: number): EditorPageState[] {
  return Array.from({ length: count }, () => ({
    textContent: '',
    style: { ...defaultTextBoxStyle },
    layout: { ...defaultTextBoxLayout },
    confirmed: false,
  }));
}

function buildInitialStoryboard(count: number): StoryboardData {
  return {
    pages: Array.from({ length: count }, (_, i) => ({
      pageIndex: i,
      text: '',
      visualGoal: '',
      userModified: false,
    })),
    generating: false,
  };
}

function buildInitialCover(projectInfo: ProjectInfo): CoverData {
  return {
    title: projectInfo.title || '',
    visualGoal: '',
    userModified: false,
    prompt: '',
    promptUserEdited: false,
    imageUrl: null,
    status: 'idle' as PageStatus,
    generating: false,
    imageRefs: [],
    aspectRatio: projectInfo.aspectRatio,
  };
}

function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const initialStageStatuses: Record<StageNumber, StageStatus> = {
  1: 'in-progress',
  2: 'idle',
  3: 'idle',
  4: 'idle',
  5: 'idle',
};

const initialState: PictureBookState = {
  projectInfo: {
    projectId: '',
    title: '',
    targetAge: 'auto',
    pageCount: 'auto',
    artStyle: 'auto',
    aspectRatio: '3:4',
    saveStatus: 'saved',
    projectStatus: 'draft',
  },
  currentStage: 1,
  stageStatuses: { ...initialStageStatuses },
  story: {
    characters: [],
    storyOutline: '',
    emotionCurve: [],
    scenes: [],
    generating: false,
  },
  storyboard: buildInitialStoryboard(24),
  cover: buildInitialCover({
    projectId: '',
    title: '',
    targetAge: 'auto',
    pageCount: 'auto',
    artStyle: 'auto',
    aspectRatio: '3:4',
    saveStatus: 'saved',
    projectStatus: 'draft',
  }),
  assets: { characters: [], scenes: [] },
  pages: buildInitialPages(24),
  editorStates: buildInitialEditorStates(24),
};

function markCoverReview(cover: CoverData): CoverData {
  if (cover.status === 'generated' || cover.status === 'finalized') {
    return { ...cover, status: 'review' as PageStatus };
  }
  return cover;
}

function applyCascadeForCoreParams(state: PictureBookState): PictureBookState {
  const stageStatuses = { ...state.stageStatuses };
  if (stageStatuses[2] === 'done') stageStatuses[2] = 'invalid';
  if (stageStatuses[3] === 'done') stageStatuses[3] = 'review';
  if (stageStatuses[4] === 'done') stageStatuses[4] = 'review';
  if (stageStatuses[5] !== 'idle') stageStatuses[5] = 'review';

  const pages = state.pages.map(p => {
    if (p.pageStatus === 'generated' || p.pageStatus === 'finalized') {
      return { ...p, pageStatus: 'review' as PageStatus };
    }
    return p;
  });

  return {
    ...state,
    stageStatuses,
    pages,
    cover: markCoverReview(state.cover),
    projectInfo: { ...state.projectInfo, projectStatus: 'review' as ProjectStatus },
  };
}

function applyCascadeForStyleParams(state: PictureBookState): PictureBookState {
  const stageStatuses = { ...state.stageStatuses };
  if (stageStatuses[3] === 'done') stageStatuses[3] = 'review';
  if (stageStatuses[4] !== 'idle') stageStatuses[4] = 'review';
  if (stageStatuses[5] !== 'idle') stageStatuses[5] = 'review';

  const pages = state.pages.map(p => {
    if (p.pageStatus === 'generated' || p.pageStatus === 'finalized') {
      return { ...p, pageStatus: 'review' as PageStatus };
    }
    return p;
  });

  return {
    ...state,
    stageStatuses,
    pages,
    cover: markCoverReview(state.cover),
    projectInfo: { ...state.projectInfo, projectStatus: 'review' as ProjectStatus },
  };
}

function markDownstreamReview(state: PictureBookState, fromStage: StageNumber): PictureBookState {
  const stageStatuses = { ...state.stageStatuses };
  for (let s = fromStage + 1; s <= 5; s++) {
    const sn = s as StageNumber;
    if (stageStatuses[sn] === 'done') {
      stageStatuses[sn] = 'review';
    }
  }

  const pages = state.pages.map(p => {
    if (p.pageStatus === 'generated' || p.pageStatus === 'finalized') {
      return { ...p, pageStatus: 'review' as PageStatus };
    }
    return p;
  });

  return { ...state, stageStatuses, pages, cover: markCoverReview(state.cover) };
}

function rebuildPagesForCount(state: PictureBookState, count: number): PictureBookState {
  return {
    ...state,
    pages: buildInitialPages(count),
    editorStates: buildInitialEditorStates(count),
    storyboard: buildInitialStoryboard(count),
    cover: buildInitialCover(state.projectInfo),
  };
}

function syncPagesFromStoryboardState(state: PictureBookState): PageItem[] {
  return state.pages.map(page => {
    const storyboardPage = state.storyboard.pages[page.index];
    const syncedPageText = storyboardPage?.text || '';
    const syncedVisualGoal = storyboardPage?.visualGoal || '';
    const nextPageText = page.storyboardEdited
      ? (page.pageText || page.storyText || syncedPageText)
      : syncedPageText;
    const nextVisualGoal = page.storyboardEdited
      ? (page.visualGoal || syncedVisualGoal)
      : syncedVisualGoal;
    const nextStoryText = nextPageText;

    let nextPageStatus = page.pageStatus;
    if (
      nextPageStatus === 'idle' &&
      (
        page.characterRefs.length > 0 ||
        page.sceneRefs.length > 0 ||
        nextPageText.trim().length > 0 ||
        nextVisualGoal.trim().length > 0 ||
        page.prompt.trim().length > 0
      )
    ) {
      nextPageStatus = 'pending';
    }

    return {
      ...page,
      storyText: nextStoryText,
      pageText: nextPageText,
      visualGoal: nextVisualGoal,
      pageStatus: nextPageStatus,
    };
  });
}

function markReferencedPagesReview(pages: PageItem[], assetName?: string) {
  return pages.map(page => {
    const uses = assetName && (page.characterRefs.includes(assetName) || page.sceneRefs.includes(assetName));
    if (uses && (page.pageStatus === 'generated' || page.pageStatus === 'finalized')) {
      return { ...page, pageStatus: 'review' as PageStatus };
    }
    return page;
  });
}

function markReferencedCoverReview(cover: CoverData, assetName?: string) {
  if (!assetName) return cover;
  const uses = (cover.imageRefs || []).some(
    ref => ref.assetName === assetName || ref.refLabel === assetName
  );
  return uses ? markCoverReview(cover) : cover;
}

function nextAssetDraftStatus(asset: AssetItem): AssetStatus {
  if (asset.status === 'pending_update') return 'pending_update';
  if (asset.officialImageUrl) return 'official_confirmed';
  return 'candidates_generated';
}

function nextAssetEditedStatus(asset: AssetItem): AssetStatus {
  if (asset.status === 'review') return 'review';
  if (asset.officialImageUrl) return 'pending_update';
  return asset.status;
}

function clearSystemCharacterPrompts(characters: AssetItem[]): AssetItem[] {
  return characters.map(asset =>
    asset.promptUserEdited
      ? asset
      : {
          ...asset,
          prompt: '',
          generating: false,
          generatingPhase: null,
        }
  );
}

type Action =
  | { type: 'SET_SAVE_STATUS'; payload: ProjectInfo['saveStatus'] }
  | { type: 'SET_PROJECT_INFO'; payload: Partial<ProjectInfo> }
  | { type: 'CREATE_DRAFT' }
  | { type: 'SET_STAGE'; payload: StageNumber }
  | { type: 'COMPLETE_STAGE'; payload: StageNumber }
  | { type: 'SET_STORY_GENERATING'; payload: boolean }
  | { type: 'SET_STORY'; payload: Partial<StoryData> }
  | { type: 'UPDATE_CHARACTER_DESC'; payload: { name: string; description: string } }
  | { type: 'UPDATE_SCENE_DESC'; payload: { name: string; description: string } }
  | { type: 'SET_STORYBOARD_GENERATING'; payload: boolean }
  | { type: 'SET_STORYBOARD'; payload: Partial<StoryboardData> }
  | { type: 'UPDATE_STORYBOARD_PAGE'; payload: { pageIndex: number; data: Partial<StoryboardPageData> } }
  | { type: 'SET_COVER'; payload: Partial<CoverData> }
  | { type: 'UPDATE_COVER_STORYBOARD_FIELDS'; payload: { title?: string; visualGoal?: string; userModified?: boolean } }
  | { type: 'UPDATE_COVER_CONFIG'; payload: Partial<CoverData> }
  | { type: 'SET_COVER_GENERATING'; payload: boolean }
  | { type: 'SET_COVER_IMAGE'; payload: { imageUrl: string } }
  | { type: 'SET_COVER_STATUS'; payload: PageStatus }
  | { type: 'INIT_ASSETS' }
  | { type: 'SET_ASSET_GENERATING'; payload: { type: 'characters' | 'scenes'; id: string; generating: boolean; phase: AssetItem['generatingPhase'] } }
  | { type: 'SET_CHARACTER_BASE_IMAGE'; payload: { id: string; imageUrl: string } }
  | { type: 'SET_SCENE_CANDIDATES'; payload: { id: string; candidates: string[] } }
  | { type: 'CONFIRM_CHARACTER_BASE'; payload: { id: string } }
  | { type: 'SET_SCENE_OFFICIAL'; payload: { id: string; index: number } }
  | { type: 'UPDATE_ASSET_ASPECT_RATIO'; payload: { type: 'characters' | 'scenes'; id: string; aspectRatio: ProjectInfo['aspectRatio'] } }
  | { type: 'UPDATE_ASSET_DESCRIPTION'; payload: { type: 'characters' | 'scenes'; id: string; description: string } }
  | { type: 'UPDATE_ASSET_PROMPT'; payload: { type: 'characters' | 'scenes'; id: string; prompt: string; userEdited?: boolean } }
  | { type: 'SET_PAGE_GENERATING'; payload: { index: number; generating: boolean } }
  | { type: 'SET_PAGE_IMAGE'; payload: { index: number; imageUrl: string } }
  | { type: 'SET_PAGE_STATUS'; payload: { index: number; status: PageStatus } }
  | { type: 'UPDATE_PAGE_STORYBOARD_FIELDS'; payload: { index: number; pageText?: string; visualGoal?: string } }
  | { type: 'UPDATE_PAGE_CONFIG'; payload: Partial<PageItem> & { index: number } }
  | { type: 'SYNC_PAGES_FROM_STORYBOARD' }
  | { type: 'SCAN_IMAGE_REFS'; payload: { index: number } }
  | { type: 'CONFIRM_ALL_FINALIZED' }
  | { type: 'UPDATE_EDITOR_STATE'; payload: { pageIndex: number; state: Partial<EditorPageState> } }
  | { type: 'UPDATE_EDITOR_STYLE'; payload: { pageIndex: number; style: Partial<TextBoxStyle> } }
  | { type: 'UPDATE_EDITOR_LAYOUT'; payload: { pageIndex: number; layout: Partial<TextBoxLayout> } }
  | { type: 'CONFIRM_EDITOR_PAGE'; payload: number }
  | { type: 'SELECT_BASE_IMAGE_FROM_HISTORY'; payload: { type: 'characters' | 'scenes'; id: string; historyIndex: number } }
  | { type: 'SELECT_CANDIDATE_FROM_HISTORY'; payload: { id: string; historyIndex: number } }
  | { type: 'LOAD_STATE'; payload: PictureBookState };

export type { Action };

function reducer(state: PictureBookState, action: Action): PictureBookState {
  switch (action.type) {
    case 'LOAD_STATE': {
      const loaded = action.payload;
      const pages = loaded.pages.map(p => ({
        ...p,
        imageRefs: p.imageRefs || [],
        generating: false,
        pageStatus: p.pageStatus === 'generating' ? 'pending' as PageStatus : p.pageStatus,
      }));
      const cover = {
        ...loaded.cover,
        imageRefs: loaded.cover.imageRefs || [],
        generating: false,
        status: loaded.cover.status === 'generating' ? 'pending' as PageStatus : loaded.cover.status,
      };
      const assets: AssetsData = {
        characters: (loaded.assets?.characters || []).map(a => ({
          ...a,
          generating: false,
          generatingPhase: null,
        })),
        scenes: (loaded.assets?.scenes || []).map(a => ({
          ...a,
          generating: false,
          generatingPhase: null,
        })),
      };
      return {
        ...loaded,
        pages,
        cover,
        assets,
        story: { ...loaded.story, generating: false },
        storyboard: { ...loaded.storyboard, generating: false },
      };
    }

    case 'SET_SAVE_STATUS':
      return { ...state, projectInfo: { ...state.projectInfo, saveStatus: action.payload } };

    case 'SET_PROJECT_INFO': {
      const newInfo = { ...state.projectInfo, ...action.payload };
      const coreChanged = action.payload.title !== undefined
        || action.payload.targetAge !== undefined
        || action.payload.pageCount !== undefined;
      const styleChanged = action.payload.artStyle !== undefined
        || action.payload.aspectRatio !== undefined;
      const artStyleChanged = action.payload.artStyle !== undefined
        && action.payload.artStyle !== state.projectInfo.artStyle;

      const nextCoverTitle = action.payload.title !== undefined && !state.cover.userModified
        ? action.payload.title
        : state.cover.title;
      const nextCoverAspectRatio = action.payload.aspectRatio !== undefined && (
        !state.cover.aspectRatio || state.cover.aspectRatio === state.projectInfo.aspectRatio
      )
        ? action.payload.aspectRatio
        : state.cover.aspectRatio;

      let result: PictureBookState = {
        ...state,
        projectInfo: newInfo,
        cover: {
          ...state.cover,
          title: nextCoverTitle,
          aspectRatio: nextCoverAspectRatio,
        },
      };

      if (
        action.payload.pageCount &&
        action.payload.pageCount !== "auto" &&
        action.payload.pageCount !== state.projectInfo.pageCount
      ) {
        result = rebuildPagesForCount(result, action.payload.pageCount);
      }

      if (coreChanged) {
        result = applyCascadeForCoreParams(result);
      } else if (styleChanged) {
        result = applyCascadeForStyleParams(result);
      }

      if (artStyleChanged) {
        result = {
          ...result,
          assets: {
            ...result.assets,
            characters: clearSystemCharacterPrompts(result.assets.characters),
          },
        };
      }

      return result;
    }

    case 'CREATE_DRAFT': {
      const projectId = generateProjectId();
      return {
        ...state,
        projectInfo: {
          ...state.projectInfo,
          projectId,
          saveStatus: 'saved',
        },
        cover: {
          ...state.cover,
        },
      };
    }

    case 'SET_STAGE':
      return { ...state, currentStage: action.payload };

    case 'COMPLETE_STAGE': {
      const completed = action.payload;
      const next = Math.min(completed + 1, 5) as StageNumber;
      const stageStatuses = { ...state.stageStatuses };
      stageStatuses[completed] = 'done';
      if (stageStatuses[next] === 'idle') stageStatuses[next] = 'in-progress';

      let projectStatus: ProjectStatus = state.projectInfo.projectStatus;
      if (completed === 1) projectStatus = 'draft';
      if (completed === 2) projectStatus = 'storyboard_confirmed';
      if (completed === 3) projectStatus = 'assets_confirmed';
      if (completed === 4) projectStatus = 'creating';

      return {
        ...state,
        currentStage: next,
        stageStatuses,
        projectInfo: { ...state.projectInfo, projectStatus },
      };
    }

    case 'SET_STORY_GENERATING':
      return { ...state, story: { ...state.story, generating: action.payload } };

    case 'SET_STORY':
      return { ...state, story: { ...state.story, ...action.payload } };

    case 'UPDATE_CHARACTER_DESC': {
      const characters = state.story.characters.map(c =>
        c.name === action.payload.name
          ? { ...c, description: action.payload.description, userModified: true }
          : c
      );
      let result: PictureBookState = { ...state, story: { ...state.story, characters } };
      if (
        state.stageStatuses[3] !== 'idle' ||
        state.stageStatuses[4] !== 'idle' ||
        state.stageStatuses[5] !== 'idle'
      ) {
        result = markDownstreamReview(result, 2);
      }
      return result;
    }

    case 'UPDATE_SCENE_DESC': {
      const scenes = state.story.scenes.map(s =>
        s.name === action.payload.name
          ? { ...s, description: action.payload.description, userModified: true }
          : s
      );
      let result: PictureBookState = { ...state, story: { ...state.story, scenes } };
      if (
        state.stageStatuses[3] !== 'idle' ||
        state.stageStatuses[4] !== 'idle' ||
        state.stageStatuses[5] !== 'idle'
      ) {
        result = markDownstreamReview(result, 2);
      }
      return result;
    }

    case 'SET_STORYBOARD_GENERATING':
      return { ...state, storyboard: { ...state.storyboard, generating: action.payload } };

    case 'SET_STORYBOARD':
      return { ...state, storyboard: { ...state.storyboard, ...action.payload } };

    case 'UPDATE_STORYBOARD_PAGE': {
      const pages = state.storyboard.pages.map(p =>
        p.pageIndex === action.payload.pageIndex
          ? { ...p, ...action.payload.data, userModified: true }
          : p
      );
      return { ...state, storyboard: { ...state.storyboard, pages } };
    }

    case 'SET_COVER':
      return { ...state, cover: { ...state.cover, ...action.payload } };

    case 'UPDATE_COVER_STORYBOARD_FIELDS': {
      const updated = {
        ...state.cover,
        title: action.payload.title ?? state.cover.title,
        visualGoal: action.payload.visualGoal ?? state.cover.visualGoal,
        userModified: action.payload.userModified ?? true,
      };
      if (state.cover.status === 'generated' || state.cover.status === 'finalized') {
        updated.status = 'review';
      } else if (
        state.cover.status === 'idle' &&
        (
          updated.title.trim().length > 0 ||
          updated.visualGoal.trim().length > 0 ||
          updated.prompt.trim().length > 0
        )
      ) {
        updated.status = 'pending';
      }
      return { ...state, cover: updated };
    }

    case 'UPDATE_COVER_CONFIG': {
      const nextPromptUserEdited =
        action.payload.prompt !== undefined
          ? (action.payload.promptUserEdited ?? true)
          : state.cover.promptUserEdited;
      const updated = {
        ...state.cover,
        ...action.payload,
        promptUserEdited: nextPromptUserEdited,
      };
      if (state.cover.status === 'generated' || state.cover.status === 'finalized') {
        updated.status = 'review';
      } else if (
        state.cover.status === 'idle' &&
        (
          updated.title.trim().length > 0 ||
          updated.visualGoal.trim().length > 0 ||
          updated.prompt.trim().length > 0
        )
      ) {
        updated.status = 'pending';
      }
      return { ...state, cover: updated };
    }

    case 'SET_COVER_GENERATING':
      return {
        ...state,
        cover: {
          ...state.cover,
          generating: action.payload,
          status: action.payload ? 'generating' as PageStatus : state.cover.status,
        },
      };

    case 'SET_COVER_IMAGE':
      return {
        ...state,
        cover: {
          ...state.cover,
          imageUrl: action.payload.imageUrl,
          status: 'generated' as PageStatus,
          generating: false,
        },
      };

    case 'SET_COVER_STATUS':
      return { ...state, cover: { ...state.cover, status: action.payload } };

    case 'INIT_ASSETS': {
      const toCharacterAsset = (entry: StoryEntry, idx: number): AssetItem => ({
        id: `${entry.name}-${idx}`,
        name: entry.name,
        description: entry.description,
        prompt: '',
        promptUserEdited: false,
        status: 'not_generated' as AssetStatus,
        aspectRatio: '9:16' as AspectRatio,
        baseImageUrl: null,
        candidates: [],
        officialImageUrl: null,
        officialIndex: null,
        generating: false,
        generatingPhase: null,
        baseImageHistory: [],
        candidateHistory: [],
      });
      const toSceneAsset = (entry: StoryEntry, idx: number): AssetItem => ({
        id: `${entry.name}-${idx}`,
        name: entry.name,
        description: entry.description,
        prompt: buildUserFriendlyAssetPromptFromEntry('scene', entry, state.projectInfo),
        promptUserEdited: false,
        status: 'not_generated' as AssetStatus,
        aspectRatio: state.projectInfo.aspectRatio,
        baseImageUrl: null,
        candidates: [],
        officialImageUrl: null,
        officialIndex: null,
        generating: false,
        generatingPhase: null,
        baseImageHistory: [],
        candidateHistory: [],
      });
      return {
        ...state,
        assets: {
          characters: state.story.characters.map(toCharacterAsset),
          scenes: state.story.scenes.map(toSceneAsset),
        },
      };
    }

    case 'SET_ASSET_GENERATING': {
      const key = action.payload.type;
      return {
        ...state,
        assets: {
          ...state.assets,
          [key]: state.assets[key].map(a =>
            a.id === action.payload.id
              ? {
                  ...a,
                  generating: action.payload.generating,
                  generatingPhase: action.payload.generating ? action.payload.phase : null,
                }
              : a
          ),
        },
      };
    }

    case 'SET_CHARACTER_BASE_IMAGE': {
      return {
        ...state,
        assets: {
          ...state.assets,
          characters: state.assets.characters.map(a =>
            a.id === action.payload.id
              ? {
                  ...a,
                  baseImageHistory: [
                    ...(a.baseImageUrl
                      ? [{ imageUrl: a.baseImageUrl, timestamp: Date.now() } as BaseImageHistoryEntry]
                      : []),
                    ...a.baseImageHistory,
                  ].slice(0, BASE_IMAGE_HISTORY_LIMIT),
                  baseImageUrl: action.payload.imageUrl,
                  generating: false,
                  generatingPhase: null,
                  status: nextAssetDraftStatus(a),
                }
              : a
          ),
        },
      };
    }

    case 'SET_SCENE_CANDIDATES': {
      return {
        ...state,
        assets: {
          ...state.assets,
          scenes: state.assets.scenes.map(a =>
            a.id === action.payload.id
              ? {
                  ...a,
                  candidateHistory: [
                    ...(a.candidates.length > 0
                      ? [{ candidates: a.candidates, timestamp: Date.now() } as CandidateHistoryEntry]
                      : []),
                    ...a.candidateHistory,
                  ].slice(0, CANDIDATE_HISTORY_LIMIT),
                  candidates: action.payload.candidates,
                  officialIndex: null,
                  generating: false,
                  generatingPhase: null,
                  status: nextAssetDraftStatus(a),
                }
              : a
          ),
        },
      };
    }

    case 'CONFIRM_CHARACTER_BASE': {
      const target = state.assets.characters.find(a => a.id === action.payload.id);
      if (!target?.baseImageUrl) {
        return state;
      }
      const replacedOfficial = Boolean(target.officialImageUrl && target.officialImageUrl !== target.baseImageUrl);
      const characters = state.assets.characters.map(a =>
        a.id === action.payload.id
          ? {
              ...a,
              officialImageUrl: a.baseImageUrl,
              status: 'official_confirmed' as AssetStatus,
            }
          : a
      );
      return {
        ...state,
        assets: { ...state.assets, characters },
        pages: replacedOfficial ? markReferencedPagesReview(state.pages, target.name) : state.pages,
        cover: replacedOfficial ? markReferencedCoverReview(state.cover, target.name) : state.cover,
      };
    }

    case 'SET_SCENE_OFFICIAL': {
      const target = state.assets.scenes.find(a => a.id === action.payload.id);
      const nextOfficialImage = target?.candidates[action.payload.index];
      if (!target || !nextOfficialImage) {
        return state;
      }
      const replacedOfficial = Boolean(target.officialImageUrl && target.officialImageUrl !== nextOfficialImage);
      const scenes = state.assets.scenes.map(a =>
        a.id === action.payload.id
          ? {
              ...a,
              officialIndex: action.payload.index,
              officialImageUrl: nextOfficialImage,
              status: 'official_confirmed' as AssetStatus,
            }
          : a
      );
      return {
        ...state,
        assets: { ...state.assets, scenes },
        pages: replacedOfficial ? markReferencedPagesReview(state.pages, target.name) : state.pages,
        cover: replacedOfficial ? markReferencedCoverReview(state.cover, target.name) : state.cover,
      };
    }

    case 'UPDATE_ASSET_ASPECT_RATIO': {
      const key = action.payload.type;
      return {
        ...state,
        assets: {
          ...state.assets,
          [key]: state.assets[key].map(a => {
            if (a.id !== action.payload.id) return a;
            const hasGeneratedImages = Boolean(
              a.baseImageUrl || a.candidates.length > 0 || a.officialImageUrl
            );
            return {
              ...a,
              aspectRatio: action.payload.aspectRatio,
              status: hasGeneratedImages ? ('review' as AssetStatus) : a.status,
            };
          }),
        },
      };
    }

    case 'UPDATE_ASSET_DESCRIPTION': {
      const key = action.payload.type;
      return {
        ...state,
        assets: {
          ...state.assets,
          [key]: state.assets[key].map(a =>
            a.id === action.payload.id
              ? {
                  ...a,
                  description: action.payload.description,
                  status: nextAssetEditedStatus(a),
                  prompt: key === 'characters'
                    ? a.prompt
                    : a.promptUserEdited
                      ? a.prompt
                      : buildUserFriendlyAssetPrompt({
                          kind: 'scene',
                          name: a.name,
                          description: action.payload.description,
                          projectInfo: { ...state.projectInfo, aspectRatio: a.aspectRatio },
                        }),
                }
              : a
          ),
        },
      };
    }

    case 'UPDATE_ASSET_PROMPT': {
      const key = action.payload.type;
      return {
        ...state,
        assets: {
          ...state.assets,
          [key]: state.assets[key].map(a =>
            a.id === action.payload.id
              ? {
                  ...a,
                  prompt: action.payload.prompt,
                  promptUserEdited: action.payload.userEdited ?? true,
                  status: nextAssetEditedStatus(a),
                }
              : a
          ),
        },
      };
    }

    case 'SET_PAGE_GENERATING': {
      const pages = state.pages.map(p =>
        p.index === action.payload.index
          ? { ...p, generating: action.payload.generating, pageStatus: action.payload.generating ? 'generating' as PageStatus : p.pageStatus }
          : p
      );
      return { ...state, pages };
    }

    case 'SET_PAGE_IMAGE': {
      const pages = state.pages.map(p =>
        p.index === action.payload.index
          ? { ...p, imageUrl: action.payload.imageUrl, pageStatus: 'generated' as PageStatus, generating: false }
          : p
      );
      const editorStates = [...state.editorStates];
      const sbPage = state.storyboard.pages[action.payload.index];
      editorStates[action.payload.index] = {
        ...editorStates[action.payload.index],
        textContent:
          state.pages[action.payload.index].pageText ||
          state.pages[action.payload.index].storyText ||
          sbPage?.text ||
          '',
      };
      return { ...state, pages, editorStates };
    }

    case 'SET_PAGE_STATUS': {
      const pages = state.pages.map(p =>
        p.index === action.payload.index ? { ...p, pageStatus: action.payload.status } : p
      );
      return { ...state, pages };
    }

    case 'UPDATE_PAGE_STORYBOARD_FIELDS': {
      const { index, pageText, visualGoal } = action.payload;
      const pages = state.pages.map(p => {
        if (p.index !== index) return p;
        const updated = {
          ...p,
          pageText: pageText ?? p.pageText,
          storyText: pageText ?? p.storyText,
          visualGoal: visualGoal ?? p.visualGoal,
          storyboardEdited: true,
        };
        if (p.pageStatus === 'generated' || p.pageStatus === 'finalized') {
          updated.pageStatus = 'review';
        } else if (
          p.pageStatus === 'idle' &&
          (
            updated.characterRefs.length > 0 ||
            updated.sceneRefs.length > 0 ||
            updated.pageText.trim().length > 0 ||
            updated.visualGoal.trim().length > 0 ||
            updated.prompt.trim().length > 0
          )
        ) {
          updated.pageStatus = 'pending';
        }
        return updated;
      });
      return { ...state, pages };
    }

    case 'UPDATE_PAGE_CONFIG': {
      const { index, ...rest } = action.payload;
      const pages = state.pages.map(p => {
        if (p.index !== index) return p;
        const nextPromptUserEdited =
          rest.prompt !== undefined ? (rest.promptUserEdited ?? true) : p.promptUserEdited;
        const updated = {
          ...p,
          ...rest,
          promptUserEdited: nextPromptUserEdited,
        };
        if (p.pageStatus === 'generated' || p.pageStatus === 'finalized') {
          updated.pageStatus = 'review';
        } else if (
          p.pageStatus === 'idle' &&
          (
            updated.characterRefs.length > 0 ||
            updated.sceneRefs.length > 0 ||
            updated.pageText.trim().length > 0 ||
            updated.visualGoal.trim().length > 0 ||
            updated.prompt.trim().length > 0
          )
        ) {
          updated.pageStatus = 'pending';
        }
        return updated;
      });
      return { ...state, pages };
    }

    case 'SYNC_PAGES_FROM_STORYBOARD': {
      return { ...state, pages: syncPagesFromStoryboardState(state) };
    }

    case 'SCAN_IMAGE_REFS': {
      const pageIndex = action.payload.index;
      const page = state.pages[pageIndex];
      if (!page) return state;
      const { imageRefs } = parseRefTags(page.prompt, state.assets.characters, state.assets.scenes, page.imageRefs);
      const pages = state.pages.map(p =>
        p.index === pageIndex ? { ...p, imageRefs } : p
      );
      return { ...state, pages };
    }

    case 'CONFIRM_ALL_FINALIZED': {
      const allFinalized = state.pages.every(p => p.pageStatus === 'finalized');
      if (!allFinalized) return state;
      return {
        ...state,
        projectInfo: { ...state.projectInfo, projectStatus: 'exportable' as ProjectStatus },
        stageStatuses: { ...state.stageStatuses, 5: 'done' as StageStatus },
      };
    }

    case 'UPDATE_EDITOR_STATE': {
      const editorStates = [...state.editorStates];
      editorStates[action.payload.pageIndex] = {
        ...editorStates[action.payload.pageIndex],
        ...action.payload.state,
      };
      return { ...state, editorStates };
    }

    case 'UPDATE_EDITOR_STYLE': {
      const editorStates = [...state.editorStates];
      editorStates[action.payload.pageIndex] = {
        ...editorStates[action.payload.pageIndex],
        style: { ...editorStates[action.payload.pageIndex].style, ...action.payload.style },
      };
      return { ...state, editorStates };
    }

    case 'UPDATE_EDITOR_LAYOUT': {
      const editorStates = [...state.editorStates];
      editorStates[action.payload.pageIndex] = {
        ...editorStates[action.payload.pageIndex],
        layout: { ...editorStates[action.payload.pageIndex].layout, ...action.payload.layout },
      };
      return { ...state, editorStates };
    }

    case 'CONFIRM_EDITOR_PAGE': {
      const editorStates = [...state.editorStates];
      editorStates[action.payload] = { ...editorStates[action.payload], confirmed: true };
      const pages = state.pages.map(p =>
        p.index === action.payload ? { ...p, pageStatus: 'finalized' as PageStatus } : p
      );
      const result: PictureBookState = { ...state, editorStates, pages };
      if (!pages.every(p => p.pageStatus === 'finalized')) {
        return result;
      }
      return {
        ...result,
        projectInfo: { ...result.projectInfo, projectStatus: 'exportable' },
      };
    }

    case 'SELECT_BASE_IMAGE_FROM_HISTORY': {
      const { type: assetType, id, historyIndex } = action.payload;
      const key = assetType as 'characters' | 'scenes';
      const targetAsset = state.assets[key].find(a => a.id === id);
      if (!targetAsset || historyIndex < 0 || historyIndex >= targetAsset.baseImageHistory.length) {
        return state;
      }
      const selectedEntry = targetAsset.baseImageHistory[historyIndex];
      const currentBaseImage = targetAsset.baseImageUrl;
      const newHistory = currentBaseImage
        ? [
            { imageUrl: currentBaseImage, timestamp: Date.now() } as BaseImageHistoryEntry,
            ...targetAsset.baseImageHistory.filter((_, i) => i !== historyIndex),
          ].slice(0, BASE_IMAGE_HISTORY_LIMIT)
        : targetAsset.baseImageHistory.filter((_, i) => i !== historyIndex);

      return {
        ...state,
        assets: {
          ...state.assets,
          [key]: state.assets[key].map(a =>
            a.id === id
              ? {
                  ...a,
                  baseImageUrl: selectedEntry.imageUrl,
                  baseImageHistory: newHistory,
                  status: 'candidates_generated' as AssetStatus,
                }
              : a
          ),
        },
      };
    }

    case 'SELECT_CANDIDATE_FROM_HISTORY': {
      const { id, historyIndex } = action.payload;
      const targetAsset = state.assets.scenes.find(a => a.id === id);
      if (!targetAsset || historyIndex < 0 || historyIndex >= targetAsset.candidateHistory.length) {
        return state;
      }
      const selectedEntry = targetAsset.candidateHistory[historyIndex];
      const currentCandidates = targetAsset.candidates;
      const newHistory = currentCandidates.length > 0
        ? [
            { candidates: currentCandidates, timestamp: Date.now() } as CandidateHistoryEntry,
            ...targetAsset.candidateHistory.filter((_, i) => i !== historyIndex),
          ].slice(0, CANDIDATE_HISTORY_LIMIT)
        : targetAsset.candidateHistory.filter((_, i) => i !== historyIndex);

      return {
        ...state,
        assets: {
          ...state.assets,
          scenes: state.assets.scenes.map(a =>
            a.id === id
              ? {
                  ...a,
                  candidates: selectedEntry.candidates,
                  candidateHistory: newHistory,
                  officialIndex: null,
                  status: 'candidates_generated' as AssetStatus,
                }
              : a
          ),
        },
      };
    }

    default:
      return state;
  }
}

interface StudioContextValue {
  state: PictureBookState;
  dispatch: React.Dispatch<Action>;
  triggerSave: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);
export { StudioContext };

async function triggerSaveToServer(state: PictureBookState): Promise<boolean> {
  if (!state.projectInfo.projectId) return false;

  try {
    const response = await fetch(`/api/projects/${state.projectInfo.projectId}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });

    if (!response.ok) {
      console.warn('Server save failed:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Server save unavailable:', error);
    return false;
  }
}

export function StudioProvider({ children, projectId }: { children: React.ReactNode; projectId?: string }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedStateRef = useRef<PictureBookState | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load project from database on mount
  useEffect(() => {
    async function loadProject() {
      if (!projectId) {
        setIsLoading(false);
        setInitialLoadComplete(true);
        return;
      }

      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            dispatch({ type: 'LOAD_STATE', payload: result.data });
          }
        }
      } catch (error) {
        console.warn('Failed to load project from server:', error);
      } finally {
        setIsLoading(false);
        setInitialLoadComplete(true);
      }
    }

    loadProject();
  }, [projectId]);

  const triggerSave = useCallback(() => {
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      dispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
    }, 800);
  }, []);

  useEffect(() => {
    // 仅当项目已经被正式创建（有projectId）时才自动保存
    if (initialLoadComplete && state.projectInfo.projectId && JSON.stringify(state) !== JSON.stringify(lastSavedStateRef.current)) {
      triggerSaveToServer(state);
      lastSavedStateRef.current = state;
    }
  }, [state, initialLoadComplete]);

  // Initialize project if no projectId and no existing project
  // 移除自动创建草稿逻辑，仅当用户点击"创建项目并继续"按钮时才创建项目

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <StudioContext.Provider value={{ state, dispatch, triggerSave }}>
      {children}
    </StudioContext.Provider>
  );
}
