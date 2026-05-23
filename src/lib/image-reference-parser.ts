import type { AssetItem, StoryboardPageData, PageItem } from '@/types/picturebook';

export type ImageReferenceType = 
  | 'character' 
  | 'scene' 
  | 'numbered' 
  | 'named';

export interface ParsedReference {
  type: ImageReferenceType;
  raw: string;
  identifier: string;
  resolvedAssetId?: string;
  resolvedAssetName?: string;
  startIndex: number;
  endIndex: number;
}

export interface ReferenceResolution {
  reference: ParsedReference;
  resolved: boolean;
  asset?: AssetItem;
  error?: string;
}

export interface ParseResult {
  text: string;
  references: ParsedReference[];
  characterRefs: string[];
  sceneRefs: string[];
}

const REFERENCE_PATTERNS = {
  numbered: /\[图片(\d+)\]/g,
  characterNamed: /\[角色[:：]?([^\]]+)\]/g,
  sceneNamed: /\[场景[:：]?([^\]]+)\]/g,
  characterBracket: /【([^】]+)】/g,
  characterSquare: /\[([^\]]+)\]/g,
};

export function parseTextReferences(text: string): ParseResult {
  const references: ParsedReference[] = [];
  const characterRefs: string[] = [];
  const sceneRefs: string[] = [];

  let match: RegExpExecArray | null;
  const patterns = [
    { type: 'numbered' as const, regex: REFERENCE_PATTERNS.numbered, groupIndex: 1 },
    { type: 'character' as const, regex: REFERENCE_PATTERNS.characterNamed, groupIndex: 1 },
    { type: 'scene' as const, regex: REFERENCE_PATTERNS.sceneNamed, groupIndex: 1 },
  ];

  for (const { type, regex, groupIndex } of patterns) {
    const re = new RegExp(regex.source, 'g');
    while ((match = re.exec(text)) !== null) {
      const identifier = match[groupIndex];
      const ref: ParsedReference = {
        type,
        raw: match[0],
        identifier,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      };
      references.push(ref);

      if (type === 'character' && !characterRefs.includes(identifier)) {
        characterRefs.push(identifier);
      } else if (type === 'scene' && !sceneRefs.includes(identifier)) {
        sceneRefs.push(identifier);
      }
    }
  }

  return {
    text,
    references,
    characterRefs,
    sceneRefs,
  };
}

export function resolveReferences(
  text: string,
  characters: AssetItem[],
  scenes: AssetItem[]
): { resolvedText: string; resolutions: ReferenceResolution[] } {
  const parseResult = parseTextReferences(text);
  const resolutions: ReferenceResolution[] = [];
  let resolvedText = text;

  for (const ref of parseResult.references) {
    let asset: AssetItem | undefined;
    let resolved = false;
    let error: string | undefined;

    switch (ref.type) {
      case 'character':
        asset = characters.find(
          c => c.name === ref.identifier || c.id === ref.identifier
        );
        if (asset) {
          resolved = true;
        } else {
          error = `Character "${ref.identifier}" not found`;
        }
        break;

      case 'scene':
        asset = scenes.find(
          s => s.name === ref.identifier || s.id === ref.identifier
        );
        if (asset) {
          resolved = true;
        } else {
          error = `Scene "${ref.identifier}" not found`;
        }
        break;

      case 'numbered':
        const index = parseInt(ref.identifier, 10) - 1;
        const allAssets = [...characters, ...scenes];
        if (index >= 0 && index < allAssets.length) {
          asset = allAssets[index];
          resolved = true;
        } else {
          error = `Image index ${ref.identifier} out of range`;
        }
        break;

      default:
        error = `Unknown reference type: ${ref.type}`;
    }

    const resolution: ReferenceResolution = {
      reference: ref,
      resolved,
      asset,
      error,
    };
    resolutions.push(resolution);

    if (resolved && asset) {
      resolvedText = resolvedText.replace(
        ref.raw,
        `【${asset.name}】`
      );
    }
  }

  return { resolvedText, resolutions };
}

export function extractCharacterNames(text: string): string[] {
  const parseResult = parseTextReferences(text);
  return parseResult.characterRefs;
}

export function extractSceneNames(text: string): string[] {
  const parseResult = parseTextReferences(text);
  return parseResult.sceneRefs;
}

export function normalizeReference(ref: string): string {
  return ref
    .replace(/^\[图片\s*/i, '')
    .replace(/^\[角色[:：]?\s*/i, '')
    .replace(/^\[场景[:：]?\s*/i, '')
    .replace(/\]$/, '')
    .trim();
}

export function formatReference(
  type: ImageReferenceType,
  identifier: string
): string {
  switch (type) {
    case 'character':
      return `[角色:${identifier}]`;
    case 'scene':
      return `[场景:${identifier}]`;
    case 'numbered':
      return `[图片${identifier}]`;
    default:
      return `[${identifier}]`;
  }
}

export function buildReferenceList(
  characters: AssetItem[],
  scenes: AssetItem[]
): { characters: string[]; scenes: string[] } {
  return {
    characters: characters.map(c => formatReference('character', c.name)),
    scenes: scenes.map(s => formatReference('scene', s.name)),
  };
}

export function matchReferencesInPrompt(
  prompt: string,
  characters: AssetItem[],
  scenes: AssetItem[]
): {
  matchedCharacters: AssetItem[];
  matchedScenes: AssetItem[];
  unmatchedNames: string[];
} {
  const parseResult = parseTextReferences(prompt);
  const matchedCharacters: AssetItem[] = [];
  const matchedScenes: AssetItem[] = [];
  const unmatchedNames: string[] = [];

  for (const charName of parseResult.characterRefs) {
    const char = characters.find(
      c => c.name === charName || c.id === charName
    );
    if (char && !matchedCharacters.find(c => c.id === char.id)) {
      matchedCharacters.push(char);
    } else if (!char) {
      unmatchedNames.push(charName);
    }
  }

  for (const sceneName of parseResult.sceneRefs) {
    const scene = scenes.find(
      s => s.name === sceneName || s.id === sceneName
    );
    if (scene && !matchedScenes.find(s => s.id === scene.id)) {
      matchedScenes.push(scene);
    } else if (!scene) {
      unmatchedNames.push(sceneName);
    }
  }

  return { matchedCharacters, matchedScenes, unmatchedNames };
}

export function injectCharacterRefs(
  text: string,
  characterNames: string[]
): string {
  if (characterNames.length === 0) return text;

  const existingRefs = extractCharacterNames(text);
  const newRefs = characterNames.filter(
    name => !existingRefs.includes(name)
  );

  if (newRefs.length === 0) return text;

  const refString = newRefs
    .map(name => formatReference('character', name))
    .join(' ');

  return `${text} ${refString}`;
}

export function injectSceneRefs(text: string, sceneNames: string[]): string {
  if (sceneNames.length === 0) return text;

  const existingRefs = extractSceneNames(text);
  const newRefs = sceneNames.filter(name => !existingRefs.includes(name));

  if (newRefs.length === 0) return text;

  const refString = newRefs
    .map(name => formatReference('scene', name))
    .join(' ');

  return `${text} ${refString}`;
}

export function removeReferences(
  text: string,
  options?: {
    type?: ImageReferenceType;
    identifier?: string;
  }
): string {
  if (!options) {
    return text.replace(/\[图片\d+\]|\[角色[：:]?[^\]]+\]|\[场景[：:]?[^\]]+\]/g, '').trim();
  }

  if (options.type === 'character') {
    return text.replace(/\[角色[：:]?[^\]]+\]/g, '').trim();
  }
  if (options.type === 'scene') {
    return text.replace(/\[场景[：:]?[^\]]+\]/g, '').trim();
  }
  if (options.type === 'numbered') {
    return text.replace(/\[图片\d+\]/g, '').trim();
  }

  return text;
}

export function validatePageReferences(
  page: PageItem,
  characters: AssetItem[],
  scenes: AssetItem[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const charName of page.characterRefs) {
    const exists = characters.some(
      c => c.name === charName || c.id === charName
    );
    if (!exists) {
      errors.push(`Character "${charName}" referenced but not found`);
    }
  }

  for (const sceneName of page.sceneRefs) {
    const exists = scenes.some(
      s => s.name === sceneName || s.id === sceneName
    );
    if (!exists) {
      errors.push(`Scene "${sceneName}" referenced but not found`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
