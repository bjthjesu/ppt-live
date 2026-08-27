import type { Presentation, StoredPresentation } from "./types";

type PresentationRuntime = typeof globalThis & {
  __pptLivePresentations?: Map<string, StoredPresentation>;
};

const runtime = globalThis as PresentationRuntime;
const presentations =
  runtime.__pptLivePresentations ?? new Map<string, StoredPresentation>();
runtime.__pptLivePresentations = presentations;

function createId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}

export function createPresentation(
  fileName: string,
  fileData: Uint8Array,
  slideCount: number,
): Presentation {
  const id = createId();
  const presentation: StoredPresentation = {
    id,
    fileName,
    currentSlide: 1,
    slideCount,
    fileData,
  };
  presentations.set(id, presentation);
  return toPublicPresentation(presentation);
}

export function getPresentation(id: string): Presentation | undefined {
  const presentation = presentations.get(id);
  return presentation ? toPublicPresentation(presentation) : undefined;
}

export function getPresentationFile(id: string): Uint8Array | undefined {
  return presentations.get(id)?.fileData;
}

export function updateCurrentSlide(
  id: string,
  currentSlide: number,
): Presentation | undefined {
  const presentation = presentations.get(id);
  if (!presentation) return undefined;

  presentation.currentSlide = Math.min(
    Math.max(currentSlide, 1),
    presentation.slideCount,
  );
  return toPublicPresentation(presentation);
}

export function updateSlideCount(
  id: string,
  slideCount: number,
): Presentation | undefined {
  const presentation = presentations.get(id);
  if (!presentation) return undefined;

  presentation.slideCount = Math.max(1, slideCount);
  presentation.currentSlide = Math.min(presentation.currentSlide, presentation.slideCount);
  return toPublicPresentation(presentation);
}

function toPublicPresentation(presentation: StoredPresentation): Presentation {
  const { fileData, ...publicPresentation } = presentation;
  void fileData;
  return publicPresentation;
}
