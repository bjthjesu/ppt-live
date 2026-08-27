"use client";

import { useEffect, useRef, useState } from "react";
import { loadPresentation, renderSlideToElement, type LoadedPresentation } from "pptx-viewer";

type PptViewerProps = {
  fileUrl: string;
  slideNumber: number;
  onSlideCount?: (count: number) => void;
};

export function PptViewer({ fileUrl, slideNumber, onSlideCount }: PptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<LoadedPresentation | null>(null);
  const onSlideCountRef = useRef(onSlideCount);
  const [status, setStatus] = useState("Loading slides...");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    onSlideCountRef.current = onSlideCount;
  }, [onSlideCount]);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    async function loadPptx() {
      setStatus("Loading slides...");
      setError(null);
      setLoaded(false);
      try {
        const loadedPresentation = await loadPresentation(fileUrl);
        if (cancelled) return;
        presentationRef.current = loadedPresentation;
        onSlideCountRef.current?.(loadedPresentation.slides.length);
        setLoaded(true);
        if (!cancelled) setStatus("");
      } catch {
        if (!cancelled) {
          setError("This presentation could not be rendered.");
          setStatus("");
        }
      }
    }

    void loadPptx();
    return () => {
      cancelled = true;
      presentationRef.current?.cleanup();
      presentationRef.current = null;
    };
  }, [fileUrl]);

  useEffect(() => {
    const loadedPresentation = presentationRef.current;
    const container = containerRef.current;
    if (!loaded || !loadedPresentation || !container || error) return;
    try {
      renderSlideToElement(loadedPresentation, Math.max(slideNumber - 1, 0), container);
    } catch {
      queueMicrotask(() => setError("This slide could not be rendered."));
    }
  }, [loaded, slideNumber, error]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-[#13202b] shadow-2xl shadow-[#10212d]/20">
      <div ref={containerRef} className="h-full w-full" aria-label={`Slide ${slideNumber}`} />
      {status && <p className="absolute inset-0 grid place-items-center text-sm text-[#b7c8d4]">{status}</p>}
      {error && <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[#ffb4a8]">{error}</p>}
    </div>
  );
}
