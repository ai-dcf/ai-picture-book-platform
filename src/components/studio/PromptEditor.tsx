"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AssetItem, AssetsData, ImageRef } from "@/types/picturebook";
import { parseRefTags } from "@/lib/prompt-ref-parser";
import { cn } from "@/lib/utils";
import PromptRefPicker from "./PromptRefPicker";

interface PromptEditorProps {
  value: string;
  imageRefs: ImageRef[];
  assets: AssetsData;
  onChange: (prompt: string, imageRefs: ImageRef[]) => void;
  characterRefs: string[];
  sceneRefs: string[];
  placeholder?: string;
  className?: string;
  onPreviewRef?: (imageUrl: string, alt: string) => void;
}

const NUMBERED_REF_PATTERN = /#\((图片\d+)\)/g;

function getAssetImageUrl(asset: AssetItem): string {
  return asset.officialImageUrl || asset.baseImageUrl || "";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEditorText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/\n\n/g, "\n");
}

function getExpectedRefTokens(text: string): string[] {
  return Array.from(text.matchAll(NUMBERED_REF_PATTERN), (match) => match[0]);
}

function getRenderedRefTokens(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-ref]"))
    .map((node) => node.getAttribute("data-ref") || "")
    .filter(Boolean);
}

function getNodeTextLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length || 0;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const ref = el.getAttribute("data-ref");
    if (ref) return ref.length;
    if (el.tagName === "BR") return 1;
    if (el.tagName === "DIV") {
      let total = 1;
      for (const child of Array.from(el.childNodes)) {
        total += getNodeTextLength(child);
      }
      return total;
    }
  }

  let total = 0;
  for (const child of Array.from(node.childNodes)) {
    total += getNodeTextLength(child);
  }
  return total;
}

function getCaretTextOffset(root: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  const targetNode = range.startContainer;
  const targetOffset = range.startOffset;

  let found = false;

  function walk(node: Node): number {
    if (node === targetNode) {
      found = true;
      if (node.nodeType === Node.TEXT_NODE) {
        return targetOffset;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        let total = 0;
        for (let i = 0; i < targetOffset; i += 1) {
          total += getNodeTextLength(node.childNodes[i]);
        }
        return total;
      }
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.hasAttribute("data-ref")) {
        return getNodeTextLength(node);
      }
    }

    let total = 0;
    for (const child of Array.from(node.childNodes)) {
      const childLength = walk(child);
      total += childLength;
      if (found) return total;
    }
    return total;
  }

  const total = walk(root);
  return found ? total : null;
}

function placeCaretByTextOffset(root: HTMLElement, targetOffset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  let remaining = targetOffset;
  let placed = false;

  function walk(node: Node) {
    if (placed) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0;
      if (remaining <= textLength) {
        range.setStart(node, remaining);
        range.collapse(true);
        placed = true;
      } else {
        remaining -= textLength;
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const ref = el.getAttribute("data-ref");
      if (ref) {
        if (remaining <= ref.length) {
          range.setStartAfter(el);
          range.collapse(true);
          placed = true;
        } else {
          remaining -= ref.length;
        }
        return;
      }

      if (el.tagName === "BR") {
        if (remaining <= 1) {
          range.setStartAfter(el);
          range.collapse(true);
          placed = true;
        } else {
          remaining -= 1;
        }
        return;
      }
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
      if (placed) return;
    }
  }

  walk(root);

  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

function getNextRefIndex(imageRefs: ImageRef[]): number {
  return imageRefs.reduce((max, ref) => {
    const match = ref.refLabel?.match(/^图片(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Math.max(max, value);
  }, 0) + 1;
}

export default function PromptEditor({
  value,
  imageRefs,
  assets,
  onChange,
  characterRefs,
  sceneRefs,
  placeholder = "",
  className,
  onPreviewRef,
}: PromptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingCaretOffsetRef = useRef<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hashOffset, setHashOffset] = useState<number | null>(null);

  const textToHtml = useCallback((text: string): string => {
    let result = "";
    let lastIndex = 0;

    for (const match of text.matchAll(NUMBERED_REF_PATTERN)) {
      const fullMatch = match[0];
      const label = match[1];
      const matchIndex = match.index ?? 0;
      result += escapeHtml(text.slice(lastIndex, matchIndex));

      const ref = imageRefs.find((item) => item.refLabel === label || item.refToken === fullMatch);
      if (!ref) {
        result += escapeHtml(fullMatch);
        lastIndex = matchIndex + fullMatch.length;
        continue;
      }

      const escapedUrl = ref.imageUrl.replace(/"/g, "&quot;");
      const escapedName = escapeHtml(ref.assetName);
      const escapedLabel = escapeHtml(label);

      result += `<span
                contenteditable="false"
                data-ref="${fullMatch}"
                data-name="${escapedName}"
                data-image-url="${escapedUrl}"
                class="inline-flex items-center align-middle mx-0.5 relative group"
              >
                <img
                  src="${escapedUrl}"
                  alt="${escapedLabel}"
                  title="${escapedName}"
                  class="h-[2.1em] w-[2.1em] rounded-sm object-cover inline-block cursor-pointer hover:ring-1 hover:ring-primary/50 transition-shadow"
                  data-action="preview"
                />
                <button
                  type="button"
                  data-action="delete"
                  class="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[7px] leading-none text-white opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer hover:bg-red-600 z-10"
                >
                  ×
                </button>
              </span>`;
      lastIndex = matchIndex + fullMatch.length;
    }

    result += escapeHtml(text.slice(lastIndex));
    return result;
  }, [imageRefs]);

  const htmlToText = useCallback((node: Node, isRoot = false): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const ref = el.getAttribute("data-ref");
      if (ref) {
        return ref;
      }
      if (el.tagName === "BR") {
        return "\n";
      }
      if (el.tagName === "DIV") {
        let result = "";
        for (const child of Array.from(node.childNodes)) {
          result += htmlToText(child);
        }
        return isRoot ? result : `\n${result}`;
      }
    }

    let result = "";
    for (const child of Array.from(node.childNodes)) {
      result += htmlToText(child);
    }
    return result;
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const currentText = normalizeEditorText(htmlToText(editorRef.current, true));
    const expectedRefTokens = getExpectedRefTokens(value);
    const renderedRefTokens = getRenderedRefTokens(editorRef.current);
    const shouldRender =
      currentText !== value ||
      renderedRefTokens.join("|") !== expectedRefTokens.join("|");

    if (shouldRender) {
      editorRef.current.innerHTML = textToHtml(value);
    }

    if (pendingCaretOffsetRef.current !== null) {
      placeCaretByTextOffset(editorRef.current, pendingCaretOffsetRef.current);
      pendingCaretOffsetRef.current = null;
    }
  }, [textToHtml, value]);

  const syncChange = useCallback(() => {
    if (!editorRef.current) {
      return { text: value, nextImageRefs: imageRefs };
    }

    const text = normalizeEditorText(htmlToText(editorRef.current, true));
    const { imageRefs: nextImageRefs } = parseRefTags(text, assets.characters, assets.scenes, imageRefs);
    onChange(text, nextImageRefs);
    return { text, nextImageRefs };
  }, [assets, htmlToText, imageRefs, onChange, value]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setHashOffset(null);
  }, []);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;

    const caretOffset = getCaretTextOffset(editorRef.current);
    if (caretOffset !== null) {
      pendingCaretOffsetRef.current = caretOffset;
    }

    const { text } = syncChange();
    if (caretOffset !== null && caretOffset > 0 && text[caretOffset - 1] === "#") {
      setHashOffset(caretOffset - 1);
      setPickerOpen(true);
      return;
    }

    if (pickerOpen) {
      closePicker();
    }
  }, [closePicker, pickerOpen, syncChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (pickerOpen && e.key === "Escape") {
      e.preventDefault();
      closePicker();
      return;
    }

    if (e.key !== "Backspace" && e.key !== "Delete") return;

    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    let refNode: HTMLElement | null = null;
    if (e.key === "Backspace") {
      let prev: Node | null = node.previousSibling;
      while (prev && prev.nodeType === Node.TEXT_NODE && !prev.textContent?.trim() && prev.previousSibling) {
        prev = prev.previousSibling;
      }
      if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).hasAttribute("data-ref")) {
        refNode = prev as HTMLElement;
      } else if (node.parentElement?.hasAttribute("data-ref")) {
        refNode = node.parentElement;
      }
    } else {
      let next: Node | null = node.nextSibling;
      while (next && next.nodeType === Node.TEXT_NODE && !next.textContent?.trim() && next.nextSibling) {
        next = next.nextSibling;
      }
      if (next && next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).hasAttribute("data-ref")) {
        refNode = next as HTMLElement;
      } else if (node.parentElement?.hasAttribute("data-ref")) {
        refNode = node.parentElement;
      }
    }

    if (refNode) {
      e.preventDefault();
      refNode.remove();
      syncChange();
    }
  }, [closePicker, pickerOpen, syncChange]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    const deleteBtn = target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const refNode = deleteBtn.closest("[data-ref]") as HTMLElement | null;
      if (refNode) {
        refNode.remove();
        syncChange();
      }
      return;
    }

    const previewImg = target.closest('[data-action="preview"]');
    if (previewImg) {
      const refNode = previewImg.closest("[data-ref]") as HTMLElement | null;
      if (refNode && onPreviewRef) {
        const imageUrl = refNode.getAttribute("data-image-url");
        const name = refNode.getAttribute("data-name") || "";
        if (imageUrl) {
          onPreviewRef(imageUrl, name);
        }
      }
    }
  }, [onPreviewRef, syncChange]);

  const handleSelectAsset = useCallback((asset: AssetItem, assetType: "character" | "scene") => {
    if (hashOffset === null) return;

    const currentText = editorRef.current
      ? normalizeEditorText(htmlToText(editorRef.current, true))
      : value;

    const existingRef = imageRefs.find((ref) => ref.assetId === asset.id);
    const targetRef = existingRef || (() => {
      const nextIndex = getNextRefIndex(imageRefs);
      const refLabel = `图片${nextIndex}`;
      return {
        assetId: asset.id,
        assetName: asset.name,
        assetType,
        imageUrl: getAssetImageUrl(asset),
        refLabel,
        refToken: `#(${refLabel})`,
      } satisfies ImageRef;
    })();

    const nextText = `${currentText.slice(0, hashOffset)}${targetRef.refToken}${currentText.slice(hashOffset + 1)}`;
    const knownRefs = existingRef ? imageRefs : [...imageRefs, targetRef];
    const { imageRefs: nextImageRefs } = parseRefTags(nextText, assets.characters, assets.scenes, knownRefs);

    pendingCaretOffsetRef.current = hashOffset + (targetRef.refToken?.length || 0);
    onChange(nextText, nextImageRefs);
    closePicker();
  }, [assets, closePicker, hashOffset, htmlToText, imageRefs, onChange, value]);

  return (
    <div className={cn("relative space-y-2", className)}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        className={cn(
          "font-body text-sm resize-none min-h-[132px] w-full rounded-lg border border-input bg-background px-3 py-2",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "overflow-auto whitespace-pre-wrap break-words"
        )}
        data-placeholder={placeholder}
      />
      {!value && (
        <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground font-body">
          {placeholder}
        </div>
      )}
      {pickerOpen && (
        <PromptRefPicker
          characters={assets.characters}
          scenes={assets.scenes}
          characterRefs={characterRefs}
          sceneRefs={sceneRefs}
          onSelect={handleSelectAsset}
          onClose={closePicker}
        />
      )}
    </div>
  );
}
