"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
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

function normalizeEditorText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
}

function getNextRefIndex(imageRefs: ImageRef[]): number {
  return imageRefs.reduce((max, ref) => {
    const match = ref.refLabel?.match(/^图片(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Math.max(max, value);
  }, 0) + 1;
}

function findTokenRangeAtCaret(text: string, caret: number, direction: "backward" | "forward") {
  for (const match of text.matchAll(NUMBERED_REF_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const shouldRemove =
      direction === "backward"
        ? caret > start && caret <= end
        : caret >= start && caret < end;

    if (shouldRemove) {
      return { start, end };
    }
  }

  return null;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const [draft, setDraft] = useState(() => normalizeEditorText(value));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hashOffset, setHashOffset] = useState<number | null>(null);

  useEffect(() => {
    setDraft(normalizeEditorText(value));
  }, [value]);

  useEffect(() => {
    if (pendingSelectionRef.current === null || !textareaRef.current) return;
    const nextCaret = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(nextCaret, nextCaret);
  }, [draft]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setHashOffset(null);
  }, []);

  const emitChange = useCallback((text: string, knownImageRefs: ImageRef[] = imageRefs) => {
    const normalizedText = normalizeEditorText(text);
    const { imageRefs: nextImageRefs } = parseRefTags(
      normalizedText,
      assets.characters,
      assets.scenes,
      knownImageRefs
    );
    setDraft(normalizedText);
    onChange(normalizedText, nextImageRefs);
    return { text: normalizedText, imageRefs: nextImageRefs };
  }, [assets, imageRefs, onChange]);

  const updatePickerState = useCallback((text: string, caret: number) => {
    if (caret > 0 && text[caret - 1] === "#") {
      setHashOffset(caret - 1);
      setPickerOpen(true);
      return;
    }
    closePicker();
  }, [closePicker]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = e.target.value;
    const caret = e.target.selectionStart ?? nextText.length;
    emitChange(nextText);
    updatePickerState(nextText, caret);
  }, [emitChange, updatePickerState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;

    if (pickerOpen && e.key === "Escape") {
      e.preventDefault();
      closePicker();
      return;
    }

    if (e.key !== "Backspace" && e.key !== "Delete") return;
    if (textarea.selectionStart !== textarea.selectionEnd) return;

    const direction = e.key === "Backspace" ? "backward" : "forward";
    const tokenRange = findTokenRangeAtCaret(draft, textarea.selectionStart, direction);
    if (!tokenRange) return;

    e.preventDefault();
    pendingSelectionRef.current = tokenRange.start;
    emitChange(`${draft.slice(0, tokenRange.start)}${draft.slice(tokenRange.end)}`);
    closePicker();
  }, [closePicker, draft, emitChange, pickerOpen]);

  const handleSelectAsset = useCallback((asset: AssetItem, assetType: "character" | "scene") => {
    if (hashOffset === null) return;

    const currentText = textareaRef.current?.value ?? draft;
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
    pendingSelectionRef.current = hashOffset + targetRef.refToken.length;
    emitChange(nextText, knownRefs);
    closePicker();
  }, [closePicker, draft, emitChange, hashOffset, imageRefs]);

  const previewContent = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const match of draft.matchAll(NUMBERED_REF_PATTERN)) {
      const matchIndex = match.index ?? 0;
      const fullMatch = match[0];
      const label = match[1];
      const ref = imageRefs.find((item) => item.refLabel === label || item.refToken === fullMatch);

      if (matchIndex > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {draft.slice(lastIndex, matchIndex)}
          </span>
        );
      }

      if (ref?.imageUrl) {
        parts.push(
          <button
            key={`ref-${matchIndex}-${ref.assetId}`}
            type="button"
            onClick={() => onPreviewRef?.(ref.imageUrl, ref.assetName)}
            className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1 align-middle hover:bg-accent/40"
            title={ref.assetName}
          >
            <img
              src={ref.imageUrl}
              alt={ref.assetName}
              className="h-7 w-7 rounded object-cover"
            />
            <span className="text-[10px] font-body text-muted-foreground">{ref.refLabel || label}</span>
          </button>
        );
      } else {
        parts.push(
          <span
            key={`token-${matchIndex}`}
            className="mx-0.5 rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-muted-foreground"
          >
            {fullMatch}
          </span>
        );
      }

      lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < draft.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {draft.slice(lastIndex)}
        </span>
      );
    }

    return parts;
  }, [draft, imageRefs, onPreviewRef]);

  return (
    <div className={cn("relative space-y-2", className)}>
      <Textarea
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "font-body text-sm resize-none min-h-[132px]",
          "overflow-auto whitespace-pre-wrap break-words"
        )}
      />
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
      {draft && (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="mb-1 text-[11px] font-body text-muted-foreground">提示词预览</div>
          <div className="whitespace-pre-wrap break-words text-sm font-body text-foreground">
            {previewContent}
          </div>
        </div>
      )}
    </div>
  );
}
