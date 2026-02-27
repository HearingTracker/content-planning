"use client";

import { useEffect, useRef, useState, memo } from "react";
import type EditorJS from "@editorjs/editorjs";
import type { EditorJSData } from "../types";

interface EditorWrapperProps {
  data: EditorJSData | null;
  onChange: (data: EditorJSData) => void;
  placeholder?: string;
  readOnly?: boolean;
}

function EditorWrapperComponent({
  data,
  onChange,
  placeholder = "Start writing your content...",
  readOnly = false,
}: EditorWrapperProps) {
  const editorRef = useRef<EditorJS | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const initialDataRef = useRef(data);
  const onChangeRef = useRef(onChange);
  const isInitializingRef = useRef(false);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize editor
  useEffect(() => {
    let isMounted = true;

    const initEditor = async () => {
      // Prevent double initialization (React Strict Mode)
      if (!holderRef.current || editorRef.current || isInitializingRef.current) return;

      isInitializingRef.current = true;

      // Clear any existing content in the holder
      holderRef.current.innerHTML = "";

      // Dynamic import to avoid SSR issues
      const EditorJS = (await import("@editorjs/editorjs")).default;
      const { EDITOR_TOOLS } = await import("./editor-tools");

      // Check if still mounted after async imports
      if (!isMounted || !holderRef.current) {
        isInitializingRef.current = false;
        return;
      }

      const editor = new EditorJS({
        holder: holderRef.current,
        tools: EDITOR_TOOLS,
        data: initialDataRef.current || undefined,
        placeholder,
        readOnly,
        onChange: async (api) => {
          const outputData = await api.saver.save();
          onChangeRef.current(outputData as EditorJSData);
        },
        onReady: () => {
          if (isMounted) {
            setIsReady(true);
          }
        },
      });

      editorRef.current = editor;
      isInitializingRef.current = false;
    };

    initEditor();

    return () => {
      isMounted = false;
      if (editorRef.current && editorRef.current.destroy) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
      isInitializingRef.current = false;
    };
  }, [placeholder, readOnly]);

  // Update content when data changes externally (only for major changes)
  useEffect(() => {
    const updateData = async () => {
      if (editorRef.current && isReady && data) {
        // Only update if the data is different (e.g., switching items)
        const currentData = await editorRef.current.save();
        const currentBlockCount = currentData.blocks?.length || 0;
        const newBlockCount = data.blocks?.length || 0;

        // Simple check: if block counts differ significantly, update
        if (Math.abs(currentBlockCount - newBlockCount) > 0 && data !== initialDataRef.current) {
          await editorRef.current.render(data);
          initialDataRef.current = data;
        }
      }
    };

    updateData();
  }, [data, isReady]);

  // Handle link clicks in the editor - open in new tab
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor && anchor.href) {
        e.preventDefault();
        e.stopPropagation();
        window.open(anchor.href, "_blank", "noopener,noreferrer");
      }
    };

    holder.addEventListener("click", handleClick);
    return () => holder.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="editor-wrapper min-h-[300px] border rounded-md bg-background">
      <div
        ref={holderRef}
        className="prose prose-sm max-w-none py-4 px-12"
        style={{ minHeight: "300px" }}
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <span className="text-sm text-muted-foreground">Loading editor...</span>
        </div>
      )}
    </div>
  );
}

export const EditorWrapper = memo(EditorWrapperComponent);
