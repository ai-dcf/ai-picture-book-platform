import JSZip from 'jszip';
import type { AspectRatio, CoverData, EditorPageState, PageItem } from '@/types/picturebook';

const EXPORT_LONG_SIDE = 2048;
const EXPORT_TITLE_MAX_LENGTH = 24;

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

interface ExportPageInput {
  page: Pick<PageItem, 'index' | 'imageUrl' | 'aspectRatio'>;
  editorState?: Pick<EditorPageState, 'textContent' | 'style' | 'layout'>;
  projectTitle?: string;
}

interface ExportCoverInput {
  cover: Pick<CoverData, 'title' | 'visualGoal' | 'imageUrl' | 'aspectRatio'>;
  projectTitle?: string;
}

interface ExportAllPagesInput {
  cover?: Pick<CoverData, 'title' | 'visualGoal' | 'imageUrl' | 'aspectRatio'>;
  pages: Pick<PageItem, 'index' | 'imageUrl' | 'aspectRatio'>[];
  editorStates: Pick<EditorPageState, 'textContent' | 'style' | 'layout'>[];
  projectTitle?: string;
}

interface ExportAllPagesResult {
  coverIncluded: boolean;
  coverFailed: boolean;
  coverSkipped: boolean;
  successPages: number[];
  failedPages: number[];
  skippedPages: number[];
  archiveFileName?: string;
}

function sanitizeFileName(value?: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'picturebook';
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, '-');
}

function getSafeTitleSegment(value?: string) {
  const sanitized = sanitizeFileName(value);
  if (sanitized === 'picturebook') return sanitized;
  return sanitized.slice(0, EXPORT_TITLE_MAX_LENGTH).replace(/[-_.\s]+$/g, '') || 'picturebook';
}

function getPageFileName(projectTitle: string | undefined, pageIndex: number) {
  const safeTitle = getSafeTitleSegment(projectTitle);
  const sequence = String(pageIndex + 1).padStart(2, '0');
  return `${sequence}-${safeTitle}-第${pageIndex + 1}页.png`;
}

function getCoverFileName(projectTitle: string | undefined) {
  const safeTitle = getSafeTitleSegment(projectTitle);
  return `00-${safeTitle}-封面.png`;
}

function getArchiveFileName(projectTitle: string | undefined) {
  const safeTitle = getSafeTitleSegment(projectTitle);
  return safeTitle === 'picturebook' ? 'picturebook-export.zip' : `${safeTitle}-绘本导出.zip`;
}

function isSameOriginUrl(src: string) {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(src, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

function resolveExportImageUrl(src: string) {
  if (!src) return src;
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (src.startsWith('/')) return src;
  if (isSameOriginUrl(src)) return src;
  if (/^https?:\/\//i.test(src)) {
    return `/api/image-proxy?url=${encodeURIComponent(src)}`;
  }
  return src;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const resolvedSrc = resolveExportImageUrl(src);
    if (!resolvedSrc.startsWith('data:') && !resolvedSrc.startsWith('blob:') && !isSameOriginUrl(resolvedSrc)) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ExportError('当前图片源不支持导出'));
    image.src = resolvedSrc;
  });
}

function getCanvasSize(aspectRatio: AspectRatio | undefined) {
  switch (aspectRatio) {
    case '3:4':
      return { width: Math.round(EXPORT_LONG_SIDE * 3 / 4), height: EXPORT_LONG_SIDE };
    case '9:16':
      return { width: Math.round(EXPORT_LONG_SIDE * 9 / 16), height: EXPORT_LONG_SIDE };
    case '1:1':
      return { width: EXPORT_LONG_SIDE, height: EXPORT_LONG_SIDE };
    case '16:9':
    default:
      return { width: EXPORT_LONG_SIDE, height: Math.round(EXPORT_LONG_SIDE * 9 / 16) };
  }
}

async function renderImageToCanvas(input: ExportPageInput | ExportCoverInput) {
  const item = 'page' in input ? input.page : input.cover;
  if (!item.imageUrl) {
    if ('page' in input) {
      throw new ExportError(`第 ${input.page.index + 1} 页缺少插画，无法导出`);
    }
    throw new ExportError('封面缺少插画，无法导出');
  }

  const image = await loadImage(item.imageUrl);
  const { width, height } = getCanvasSize(item.aspectRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new ExportError('浏览器不支持画布导出');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new ExportError('导出失败，请稍后重试'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function exportSinglePage(input: ExportPageInput) {
  const blob = await renderPageToBlob(input);
  const fileName = getPageFileName(input.projectTitle, input.page.index);
  downloadBlob(blob, fileName);
}

async function exportSingleCover(input: ExportCoverInput) {
  const blob = await renderPageToBlob(input);
  const fileName = getCoverFileName(input.projectTitle);
  downloadBlob(blob, fileName);
}

async function renderPageToBlob(input: ExportPageInput | ExportCoverInput) {
  const canvas = await renderImageToCanvas(input);
  return canvasToBlob(canvas);
}

export async function exportPageAsPng(input: ExportPageInput | ExportCoverInput) {
  if ('page' in input) {
    await exportSinglePage(input);
    return;
  }
  await exportSingleCover(input);
}

export async function exportAllPagesAsZip(input: ExportAllPagesInput): Promise<ExportAllPagesResult> {
  const result: ExportAllPagesResult = {
    coverIncluded: false,
    coverFailed: false,
    coverSkipped: false,
    successPages: [],
    failedPages: [],
    skippedPages: [],
  };
  const zip = new JSZip();

  if (input.cover) {
    if (!input.cover.imageUrl) {
      result.coverSkipped = true;
    } else {
      try {
        const blob = await renderPageToBlob({
          cover: input.cover,
          projectTitle: input.projectTitle,
        });
        zip.file(getCoverFileName(input.projectTitle), blob);
        result.coverIncluded = true;
        await new Promise(resolve => window.setTimeout(resolve, 120));
      } catch {
        result.coverFailed = true;
      }
    }
  }

  for (const page of input.pages) {
    if (!page.imageUrl) {
      result.skippedPages.push(page.index);
      continue;
    }

    try {
      const blob = await renderPageToBlob({
        page,
        editorState: input.editorStates[page.index],
        projectTitle: input.projectTitle,
      });
      zip.file(getPageFileName(input.projectTitle, page.index), blob);
      result.successPages.push(page.index);
      await new Promise(resolve => window.setTimeout(resolve, 120));
    } catch {
      result.failedPages.push(page.index);
    }
  }

  if (!result.successPages.length) {
    return result;
  }

  const archiveFileName = getArchiveFileName(input.projectTitle);
  const archiveBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(archiveBlob, archiveFileName);
  result.archiveFileName = archiveFileName;

  return result;
}
