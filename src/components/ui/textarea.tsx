"use client";
import * as React from "react"

import { cn } from "@/lib/utils"

const AUTO_RESIZE_MAX_HEIGHT = 320;

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, defaultValue, onChange, ...props }, forwardedRef) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);

    React.useImperativeHandle(forwardedRef, () => internalRef.current!);

    const resize = React.useCallback(() => {
      const el = internalRef.current;
      if (!el) return;
      el.style.height = "auto";
      const next = Math.min(el.scrollHeight, AUTO_RESIZE_MAX_HEIGHT);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > AUTO_RESIZE_MAX_HEIGHT ? "auto" : "hidden";
    }, []);

    React.useEffect(() => {
      resize();
    }, [value, defaultValue, resize]);

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(e);
        resize();
      },
      [onChange, resize],
    );

    return (
      <textarea
        className={cn(
          "ink-input ink-textarea",
          className
        )}
        ref={internalRef}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
