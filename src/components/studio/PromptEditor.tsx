"use client";

import React, { useCallback, useRef, useState } from "react";
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

const REF_TAG_RE = /\$\{([^}]+)\}/g;

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorPosition, setSelectorPosition] = useState<{ top: number; left: number } | null>(null);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      const { imageRefs: newImageRefs } = parseRefTags(text, assets.characters, assets.scenes);
      onChange(text, newImageRefs);
    },
    [assets, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "#" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          const rect = textarea.getBoundingClientRect();
          const cursorPos = textarea.selectionStart;
          const textBefore = textarea.value.substring(0, cursorPos);
          const lines = textBefore.split("\n");
          const currentLine = lines.length - 1;
          const lineHeight = 20;
          const charWidth = 7;

          const top = rect.top + Math.min(currentLine * lineHeight, textarea.clientHeight - 100) + lineHeight + 4;
          const left = rect.left + (lines[currentLine]?.length || 0) * charWidth;

          setSelectorPosition({ top: Math.min(top, window.innerHeight - 300), left: Math.min(left, window.innerWidth - 250) });
        } else {
          setSelectorPosition({ top: 0, left: 0 });
        }
        setSelectorOpen(true);
      }
    },
    []
  );

  const handleSelectAsset = useCallback(
    (assetName: string) => {
      setSelectorOpen(false);
      setSelectorPosition(null);

      const textarea = textareaRef.current;
      if (!textarea) return;

      const tag = `\${${assetName}}`;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.substring(0, start);
      const after = value.substring(end);

      const newText = before + tag + after;
      const { imageRefs: newImageRefs } = parseRefTags(newText, assets.characters, assets.scenes);
      onChange(newText, newImageRefs);

      requestAnimationFrame(() => {
        textarea.focus();
        const newCursorPos = start + tag.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [value, assets, onChange]
  );

  const handleRemoveRef = useCallback(
    (assetName: string) => {
      const newPrompt = removeRefTag(value, assetName);
      const { imageRefs: newImageRefs } = parseRefTags(newPrompt, assets.characters, assets.scenes);
      onChange(newPrompt, newImageRefs);
    },
    [value, assets, onChange]
  );

  const renderPreview = useCallback(() => {
    if (!value) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    const re = new RegExp(REF_TAG_RE.source, "g");
    let match: RegExpExecArray | null;

    while ((match = re.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={key++} className="text-foreground">{value.slice(lastIndex, match.index)}</span>
        );
      }

      const name = match[1];
      const charAsset = assets.characters.find(a => a.name === name);
      const sceneAsset = assets.scenes.find(a => a.name === name);
      const asset = charAsset || sceneAsset;
      const isCharacter = !!charAsset;
      const isValid = !!asset;

      parts.push(
        <span
          key={key++}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium align-middle",
            isValid
              ? isCharacter
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800"
              : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800 line-through"
          )}
        >
          {isValid && asset.officialImageUrl && (
            <img src={asset.officialImageUrl} alt={name} className="w-3.5 h-3.5 rounded-sm object-cover flex-shrink-0" />
          )}
          {name}
          {isValid && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); handleRemoveRef(name); }}
              className="ml-0.5 hover:text-red-500 transition-colors text-[10px] leading-none"
            >
              ×
            </button>
          )}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < value.length) {
      parts.push(<span key={key++} className="text-foreground">{value.slice(lastIndex)}</span>);
    }

    return parts;
  }, [value, assets, handleRemoveRef]);

  return (
    <div className={cn("space-y-2", className)}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        className="font-body text-sm resize-none min-h-[132px] w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        placeholder={placeholder}
      />

      {value && (
        <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm font-body leading-relaxed">
          <div className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">提示词预览</div>
          <div className="whitespace-pre-wrap break-words">{renderPreview()}</div>
        </div>
      )}

      {imageRefs.length > 0 && (
        <ImageRefPreview imageRefs={imageRefs} onRemove={handleRemoveRef} />
      )}

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
