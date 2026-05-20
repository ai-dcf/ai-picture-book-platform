"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import type { AssetsData, ImageRef } from "@/types/picturebook";
import { parseRefTags, removeRefTag } from "@/lib/prompt-ref-parser";
import { cn } from "@/lib/utils";
import AssetSelector from "./AssetSelector";
import ImageRefPreview from "./ImageRefPreview";

interface PromptEditorProps {
  value: string;
  imageRefs: ImageRef[];
  assets: AssetsData;
  onChange: (prompt: string, imageRefs: ImageRef[]) => void;
  characterRefs: string[];
  sceneRefs: string[];
  placeholder?: string;
  className?: string;
}

const REF_PATTERN = /@([^\s@]+)/g;

export default function PromptEditor({
  value,
  imageRefs,
  assets,
  onChange,
  characterRefs,
  sceneRefs,
  placeholder = "",
  className,
}: PromptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorPosition, setSelectorPosition] = useState<{ top: number; left: number } | null>(null);
  const [localHtml, setLocalHtml] = useState<string>("");
  const isUpdatingRef = useRef(false);

  // 将纯文本转换为带标签的 HTML
  const textToHtml = useCallback((text: string): string => {
    return text.replace(REF_PATTERN, (match, name) => {
      const char = assets.characters.find(c => c.name === name && c.officialImageUrl);
      const scene = assets.scenes.find(s => s.name === name && s.officialImageUrl);
      const asset = char || scene;
      const isChar = !!char;
      if (!asset) return match;

      return `<span 
                contenteditable="false" 
                data-ref="${match}" 
                data-name="${name}"
                class="${
                  isChar
                    ? "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium align-middle bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    : "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium align-middle bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                }"
              >
                <img 
                  src="${asset.officialImageUrl}" 
                  alt="${name}" 
                  class="w-3.5 h-3.5 rounded-sm object-cover flex-shrink-0"
                />
                ${name}
                <button 
                  type="button" 
                  class="ml-0.5 hover:text-red-500 transition-colors text-[10px] leading-none cursor-pointer"
                >
                  ×
                </button>
              </span>`;
    });
  }, [assets]);

  // 将 HTML 转换回纯文本
  const htmlToText = useCallback((node: Node): string => {
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
        return "\n" + result;
      }
    }
    let result = "";
    for (const child of Array.from(node.childNodes)) {
      result += htmlToText(child);
    }
    return result;
  }, []);

  // 当外部 value 变化时更新 HTML
  useEffect(() => {
    if (!editorRef.current || isUpdatingRef.current) return;
    const newHtml = textToHtml(value);
    if (editorRef.current.innerHTML !== newHtml) {
      editorRef.current.innerHTML = newHtml;
    }
  }, [value, textToHtml]);

  // 同步内容变化
  const syncChange = useCallback(() => {
    if (!editorRef.current) return;
    const text = htmlToText(editorRef.current).replace(/\n\n/g, "\n");
    const { imageRefs: newImageRefs } = parseRefTags(text, assets.characters, assets.scenes);
    onChange(text, newImageRefs);
  }, [htmlToText, assets, onChange]);

  // 处理输入事件
  const handleInput = useCallback(() => {
    syncChange();
  }, [syncChange]);

  // 处理 keydown 事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "#" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectorPosition({
            top: rect.bottom + 4,
            left: rect.left,
          });
          setSelectorOpen(true);
        }
        return;
      }

      // 删除标签处理
      if (e.key === "Backspace" || e.key === "Delete") {
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
      }
    },
    [syncChange]
  );

  // 处理删除按钮点击
  const handleRemoveClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const refNode = target.closest("[data-ref]") as HTMLElement;
    if (!refNode) return;
    refNode.remove();
    syncChange();
  }, [syncChange]);

  // 处理点击选择素材
  const handleSelectAsset = useCallback(
    (assetName: string) => {
      setSelectorOpen(false);
      setSelectorPosition(null);
      const tag = `@${assetName}`;

      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !editorRef.current) return;

      const range = selection.getRangeAt(0);
      range.deleteContents();

      // 插入 HTML 标签
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = textToHtml(tag);
      const refElement = tempDiv.firstChild as HTMLElement;

      range.insertNode(refElement);

      // 光标移到标签后面
      const cursor = document.createTextNode("\u200B");
      refElement.after(cursor);
      const newRange = document.createRange();
      newRange.setStartAfter(cursor);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      syncChange();
    },
    [textToHtml, syncChange]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleRemoveClick}
        className={cn(
          "font-body text-sm resize-none min-h-[132px] w-full rounded-lg border border-input bg-background px-3 py-2",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "overflow-auto whitespace-pre-wrap break-words"
        )}
        data-placeholder={placeholder}
      />
      {!value && (
        <div className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none font-body">
          {placeholder}
        </div>
      )}

      {imageRefs.length > 0 && <ImageRefPreview imageRefs={imageRefs} onRemove={handleRemoveClick} />}

      {selectorOpen && selectorPosition && (
        <AssetSelector
          assets={assets}
          existingRefs={imageRefs.map(r => r.assetName)}
          position={selectorPosition}
          onSelect={handleSelectAsset}
          onClose={() => {
            setSelectorOpen(false);
            setSelectorPosition(null);
          }}
        />
      )}
    </div>
  );
}
