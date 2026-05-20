import type { AssetItem, ImageRef } from '@/types/picturebook';

const REF_TAG_PATTERN = /\$\{([^}]+)\}/g;

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

export function parseRefTags(
  text: string,
  characters: AssetItem[],
  scenes: AssetItem[]
): ParseRefTagsResult {
  const tags: ParsedRefTag[] = [];
  const imageRefs: ImageRef[] = [];
  const unmatchedNames: string[] = [];
  const seenAssetIds = new Set<string>();

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
        const imageUrl = asset.officialImageUrl || '';
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
  characters: AssetItem[],
  scenes: AssetItem[]
): string {
  return text.replace(REF_TAG_PATTERN, (fullMatch, name: string) => {
    const asset = findAssetByName(name, characters, scenes);
    if (!asset) return fullMatch;
    const desc = asset.description || '按既定设定保持一致';
    return `${asset.name}（${desc}）`;
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

    const tag = `\${${name}}`;
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
      const imageUrl = asset.officialImageUrl || '';
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
  const tag = `\${${name}}`;
  return text.split(tag).join('');
}

export function findUnreferencedAssets(
  text: string,
  characterRefs: string[],
  sceneRefs: string[],
  characters: AssetItem[],
  scenes: AssetItem[]
): { characters: AssetItem[]; scenes: AssetItem[] } {
  const existingTags = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(REF_TAG_PATTERN.source, 'g');
  while ((match = re.exec(text)) !== null) {
    existingTags.add(match[1]);
  }

  const unreferencedCharacters = characterRefs
    .filter(name => !existingTags.has(name))
    .map(name => characters.find(c => c.name === name))
    .filter((a): a is AssetItem => Boolean(a && a.officialImageUrl));

  const unreferencedScenes = sceneRefs
    .filter(name => !existingTags.has(name))
    .map(name => scenes.find(s => s.name === name))
    .filter((a): a is AssetItem => Boolean(a && a.officialImageUrl));

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
    .filter((a): a is AssetItem => Boolean(a && a.officialImageUrl))
    .map(a => ({
      assetId: a.id,
      assetName: a.name,
      assetType,
      imageUrl: a.officialImageUrl!,
    }));
}
