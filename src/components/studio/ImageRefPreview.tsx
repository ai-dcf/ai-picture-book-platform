"use client";

import React from "react";
import type { ImageRef } from "@/types/picturebook";
import { cn } from "@/lib/utils";

interface ImageRefPreviewProps {
  imageRefs: ImageRef[];
  onRemove: (imageRef: ImageRef) => void;
}

export default function ImageRefPreview({
  imageRefs,
  onRemove,
}: ImageRefPreviewProps) {
  if (imageRefs.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="text-[10px] text-muted-foreground font-body font-medium uppercase tracking-wide">
        参考图 ({imageRefs.length})
      </div>
      <div className="flex flex-wrap gap-2">
        {imageRefs.map((ref, index) => (
          <div
            key={ref.refToken || `${ref.assetId}-${index}`}
            className="group relative w-12 h-12 rounded-lg border border-border overflow-hidden bg-muted"
          >
            <img
              src={ref.imageUrl}
              alt={ref.assetName}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-0.5 right-0.5 bg-black/60 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
              {ref.refLabel ? ref.refLabel.replace("图片", "") : index + 1}
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[8px] text-center truncate px-0.5 font-body">
              {ref.assetName}
            </div>
            <button
              type="button"
              onClick={() => onRemove(ref)}
              className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
            <div className={cn(
              "absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full",
              ref.assetType === 'character' ? 'bg-blue-400' : 'bg-green-400'
            )} />
          </div>
        ))}
      </div>
    </div>
  );
}
