import type { AssetItem, ImageRef } from '@/types/picturebook';

const REF_TAG_PATTERN = /@([^\s@]+)/g;
const NUMBERED_REF_PATTERN = /#\((图片\d+)\)/g;

export interface ParsedRefTag {
  name: string;
  startIndex: number;
  endIndex: number;
  matched: boolean;
  asset?: AssetItem;
}

export interface ParseRefTagsResult {
  tags: ParsedRefTag[];
  imageRefs: ImageRef[];
  unmatchedNames: string[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseRefTags(
  text: string,
  characters: AssetItem[],
  scenes: AssetItem[],
  knownImageRefs: ImageRef[] = []
): ParseRefTagsResult {
  const tags: ParsedRefTag[] = [];
  const imageRefs: ImageRef[] = [];
  const unmatchedNames: string[] = [];
  const seenAssetIds = new Set<string>();
  const numberedRefMap = new Map(
    knownImageRefs
      .filter(ref => ref.refLabel || ref.refToken)
      .flatMap(ref => {
        const entries: Array<[string, ImageRef]> = [];
        if (ref.refLabel) entries.push([ref.refLabel, ref]);
        if (ref.refToken) entries.push([ref.refToken, ref]);
        return entries;
      })
  );

  let match: RegExpExecArray | null;
  const re = new RegExp(REF_TAG_PATTERN.source, 'g');

  while ((match = re.exec(text)) !== null) {
    const name = match[1];
    const asset = findAssetByName(name, characters, scenes);

    const tag: ParsedRefTag = {
      name,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      matched: !!asset,
      asset,
    };
    tags.push(tag);

    if (asset) {
      if (!seenAssetIds.has(asset.id)) {
        seenAssetIds.add(asset.id);
        const imageUrl = asset.officialImageUrl || asset.baseImageUrl || '';
        if (imageUrl) {
          imageRefs.push({
            assetId: asset.id,
            assetName: asset.name,
            assetType: characters.includes(asset) ? 'character' : 'scene',
            imageUrl,
          });
        }
      }
    } else {
      if (!unmatchedNames.includes(name)) {
        unmatchedNames.push(name);
      }
    }
  }

  const numberedRe = new RegExp(NUMBERED_REF_PATTERN.source, 'g');
  while ((match = numberedRe.exec(text)) !== null) {
    const label = match[1];
    const ref = numberedRefMap.get(label) || numberedRefMap.get(match[0]);
    if (!ref) {
      if (!unmatchedNames.includes(label)) {
        unmatchedNames.push(label);
      }
      continue;
    }
    if (!seenAssetIds.has(ref.assetId)) {
      seenAssetIds.add(ref.assetId);
      imageRefs.push(ref);
    }
  }

  return { tags, imageRefs, unmatchedNames };
}

function findAssetByName(
  name: string,
  characters: AssetItem[],
  scenes: AssetItem[]
): AssetItem | undefined {
  return (
    characters.find(c => c.name === name) ||
    scenes.find(s => s.name === name)
  );
}

export function replaceRefTagsWithDescription(
  text: string,
  imageRefs: ImageRef[]
): string {
  const assetIndexMap = new Map<string, number>();
  const numberedRefMap = new Map<string, ImageRef>();
  imageRefs.forEach((ref, index) => {
    assetIndexMap.set(ref.assetName, index + 1); // 序号从1开始
    if (ref.refLabel) numberedRefMap.set(ref.refLabel, ref);
    if (ref.refToken) numberedRefMap.set(ref.refToken, ref);
  });

  const withNamedRefs = text.replace(REF_TAG_PATTERN, (fullMatch, name: string) => {
    const index = assetIndexMap.get(name);
    if (index === undefined) return fullMatch;
    return `${name}（参考图片${index}）`;
  });

  return withNamedRefs.replace(NUMBERED_REF_PATTERN, (fullMatch, label: string) => {
    const ref = numberedRefMap.get(label) || numberedRefMap.get(fullMatch);
    if (!ref) return fullMatch;
    return `${ref.assetName}（${label}）`;
  });
}

export function injectRefTags(
  text: string,
  names: string[],
  characters: AssetItem[],
  scenes: AssetItem[]
): { text: string; imageRefs: ImageRef[] } {
  let result = text;
  const imageRefs: ImageRef[] = [];
  const seenAssetIds = new Set<string>();

  for (const name of names) {
    const asset = findAssetByName(name, characters, scenes);
    if (!asset) continue;

    const tag = `@${name}`;
    if (result.includes(tag)) continue;

    const firstIndex = result.indexOf(name);
    if (firstIndex === -1) {
      result = `${result} ${tag}`;
    } else {
      const insertPos = firstIndex + name.length;
      result = result.slice(0, insertPos) + tag + result.slice(insertPos);
    }

    if (!seenAssetIds.has(asset.id)) {
      seenAssetIds.add(asset.id);
      const imageUrl = asset.officialImageUrl || asset.baseImageUrl || '';
      if (imageUrl) {
        imageRefs.push({
          assetId: asset.id,
          assetName: asset.name,
          assetType: characters.includes(asset) ? 'character' : 'scene',
          imageUrl,
        });
      }
    }
  }

  return { text: result, imageRefs };
}

export function removeRefTag(text: string, name: string): string {
  const tag = `@${name}`;
  return text.split(tag).join('');
}

export function removeImageRefToken(text: string, ref: ImageRef): string {
  if (ref.refToken) {
    return text.split(ref.refToken).join('').replace(/\s{2,}/g, ' ').trim();
  }
  return removeRefTag(text, ref.assetName).replace(/\s{2,}/g, ' ').trim();
}

export function findUnreferencedAssets(
  text: string,
  characterRefs: string[],
  sceneRefs: string[],
  characters: AssetItem[],
  scenes: AssetItem[],
  knownImageRefs: ImageRef[] = []
): { characters: AssetItem[]; scenes: AssetItem[] } {
  const existingTags = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(REF_TAG_PATTERN.source, 'g');
  while ((match = re.exec(text)) !== null) {
    existingTags.add(match[1]);
  }
  const numberedRe = new RegExp(NUMBERED_REF_PATTERN.source, 'g');
  while ((match = numberedRe.exec(text)) !== null) {
    const refLabel = match[1];
    const refToken = match[0];
    const numberedRef = knownImageRefs.find(
      ref => ref.refLabel === refLabel || ref.refToken === refToken
    );
    if (numberedRef) {
      existingTags.add(numberedRef.assetName);
    }
  }

  const unreferencedCharacters = characterRefs
    .filter(name => !existingTags.has(name))
    .map(name => characters.find(c => c.name === name))
    .filter((a): a is AssetItem => Boolean(a && (a.officialImageUrl || a.baseImageUrl)));

  const unreferencedScenes = sceneRefs
    .filter(name => !existingTags.has(name))
    .map(name => scenes.find(s => s.name === name))
    .filter((a): a is AssetItem => Boolean(a && (a.officialImageUrl || a.baseImageUrl)));

  return {
    characters: unreferencedCharacters,
    scenes: unreferencedScenes,
  };
}

export function buildImageRefsFromAssets(
  assetNames: string[],
  assets: AssetItem[],
  assetType: 'character' | 'scene'
): ImageRef[] {
  return assetNames
    .map(name => assets.find(a => a.name === name))
    .filter((a): a is AssetItem => Boolean(a && (a.officialImageUrl || a.baseImageUrl)))
    .map(a => ({
      assetId: a.id,
      assetName: a.name,
      assetType,
      imageUrl: a.officialImageUrl || a.baseImageUrl!,
    }));
}

function replaceAllNamedOccurrences(text: string, assetName: string, refToken: string): string {
  const pattern = new RegExp(`${escapeRegExp(assetName)}(?!\\s*${escapeRegExp(refToken)})`, 'g');
  return text.replace(pattern, `${assetName} ${refToken}`);
}

function sortAssetNamesByPromptOrder(prompt: string, names: string[]): string[] {
  return names
    .map(name => ({ name, index: prompt.indexOf(name) }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map(item => item.name);
}

export function annotatePromptWithNumberedRefs(
  prompt: string,
  candidateImageRefs: ImageRef[],
  orderedAssetNames: string[]
): { prompt: string; imageRefs: ImageRef[] } {
  const orderedNames = sortAssetNamesByPromptOrder(prompt, orderedAssetNames);
  let nextPrompt = prompt;
  const imageRefs: ImageRef[] = [];

  orderedNames.forEach((assetName, index) => {
    const matchedRef = candidateImageRefs.find(ref => ref.assetName === assetName);
    if (!matchedRef) return;
    const refLabel = `图片${index + 1}`;
    const refToken = `#(${refLabel})`;
    nextPrompt = replaceAllNamedOccurrences(nextPrompt, assetName, refToken);
    imageRefs.push({
      ...matchedRef,
      refLabel,
      refToken,
    });
  });

  return { prompt: nextPrompt, imageRefs };
}
