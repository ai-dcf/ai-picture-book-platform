import JSZip from 'jszip';
import type { EditorPageState, PageItem } from '@/types/picturebook';

const EXPORT_SIZE = 2048;
const FONT_FAMILY = "'Noto Serif SC', serif";

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

interface ExportPageInput {
  page: Pick<PageItem, 'index' | 'imageUrl'>;
  editorState: Pick<EditorPageState, 'textContent' | 'style' | 'layout'>;
  projectTitle?: string;
}

interface ExportAllPagesInput {
  pages: Pick<PageItem, 'index' | 'imageUrl'>[];
  editorStates: Pick<EditorPageState, 'textContent' | 'style' | 'layout'>[];
  projectTitle?: string;
}

interface ExportAllPagesResult {
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

function getPageFileName(projectTitle: string | undefined, pageIndex: number) {
  const safeTitle = sanitizeFileName(projectTitle);
  const sequence = String(pageIndex + 1).padStart(2, '0');
  return `${sequence}-${safeTitle}-第${pageIndex + 1}页.png`;
}

function getArchiveFileName(projectTitle: string | undefined) {
  const safeTitle = sanitizeFileName(projectTitle);
  return safeTitle === 'picturebook' ? 'picturebook-export.zip' : `${safeTitle}-绘本导出.zip`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ExportError('当前图片源不支持导出'));
    image.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }

    let currentLine = '';
    for (const char of paragraph) {
      const nextLine = currentLine + char;
      if (ctx.measureText(nextLine).width <= maxWidth || !currentLine) {
        currentLine = nextLine;
      } else {
        lines.push(currentLine);
        currentLine = char;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

function drawTextBox(ctx: CanvasRenderingContext2D, input: ExportPageInput) {
  const { layout, style, textContent } = input.editorState;
  if (!textContent.trim()) return;

  const x = (layout.x / 100) * EXPORT_SIZE;
  const y = (layout.y / 100) * EXPORT_SIZE;
  const width = (layout.w / 100) * EXPORT_SIZE;
  const height = (layout.h / 100) * EXPORT_SIZE;

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, 24);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.fill();
  ctx.restore();

  const paddingX = Math.max(24, width * 0.06);
  const paddingY = Math.max(18, height * 0.12);
  const drawX = x + paddingX;
  const drawY = y + paddingY;
  const maxTextWidth = Math.max(0, width - paddingX * 2);
  const maxTextHeight = Math.max(0, height - paddingY * 2);

  ctx.save();
  ctx.font = `${style.fontWeight === 'bold' ? '700' : '400'} ${style.fontSize * 4}px ${FONT_FAMILY}`;
  ctx.fillStyle = style.textColor;
  ctx.textAlign = style.textAlign;
  ctx.textBaseline = 'top';

  const lineHeight = style.fontSize * 4 * 1.6;
  const lines = wrapText(ctx, textContent, maxTextWidth);
  const visibleLineCount = Math.max(1, Math.floor(maxTextHeight / lineHeight));
  const visibleLines = lines.slice(0, visibleLineCount);
  const contentHeight = visibleLines.length * lineHeight;
  const startY = drawY + Math.max(0, (maxTextHeight - contentHeight) / 2);

  let anchorX = drawX;
  if (style.textAlign === 'center') anchorX = x + width / 2;
  if (style.textAlign === 'right') anchorX = x + width - paddingX;

  visibleLines.forEach((line, index) => {
    ctx.fillText(line, anchorX, startY + index * lineHeight, maxTextWidth);
  });
  ctx.restore();
}

async function renderPageToCanvas(input: ExportPageInput) {
  if (!input.page.imageUrl) {
    throw new ExportError(`第 ${input.page.index + 1} 页缺少插画，无法导出`);
  }

  const image = await loadImage(input.page.imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new ExportError('浏览器不支持画布导出');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
  ctx.drawImage(image, 0, 0, EXPORT_SIZE, EXPORT_SIZE);
  drawTextBox(ctx, input);

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

async function renderPageToBlob(input: ExportPageInput) {
  const canvas = await renderPageToCanvas(input);
  return canvasToBlob(canvas);
}

export async function exportPageAsPng(input: ExportPageInput) {
  await exportSinglePage(input);
}

export async function exportAllPagesAsZip(input: ExportAllPagesInput): Promise<ExportAllPagesResult> {
  const result: ExportAllPagesResult = {
    successPages: [],
    failedPages: [],
    skippedPages: [],
  };
  const zip = new JSZip();

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
