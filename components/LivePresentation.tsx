"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { PptViewer } from "@/components/PptViewer";
import type { Presentation, SlideChangedEvent, PresentationFinishedEvent } from "@/lib/presentation";

type LivePresentationProps = { presentation: Presentation; mode: "host" | "student" };

export function LivePresentation({ presentation: initialPresentation, mode }: LivePresentationProps) {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(initialPresentation.currentSlide);
  const [slideCount, setSlideCount] = useState(initialPresentation.slideCount);
  const [participantCount, setParticipantCount] = useState(initialPresentation.participantCount);
  const [copyState, setCopyState] = useState("Copy link");
  const [studentUrl, setStudentUrl] = useState(`/presentation/${initialPresentation.id}`);
  const [isFinished, setIsFinished] = useState(initialPresentation.status === "finished");
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const socketRef = useRef<Socket | null>(null);

  // Initialize persistent session ID
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(`ppt-session-${initialPresentation.id}`);
    if (stored) {
      setSessionId(stored);
    } else {
      const newId = crypto.randomUUID();
      setSessionId(newId);
      localStorage.setItem(`ppt-session-${initialPresentation.id}`, newId);
    }
  }, [initialPresentation.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStudentUrl(`${window.location.protocol}//${window.location.hostname}:5023/presentation/${initialPresentation.id}`);
  }, [initialPresentation.id]);

  // Track participant join
  useEffect(() => {
    if (!sessionId) return;

    async function joinPresentation() {
      try {
        const response = await fetch(`/api/presentations/${initialPresentation.id}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (response.ok) {
          const result = (await response.json()) as { presentation?: Presentation };
          if (result.presentation) {
            setParticipantCount(result.presentation.participantCount);
          }
        }
      } catch {
        // Silently handle join error
      }
    }

    // Only track host, not students (to avoid counting host as participant)
    if (mode === "host") return;
    
    joinPresentation();

    return () => {
      // Untrack participant on cleanup
      fetch(`/api/presentations/${initialPresentation.id}/join`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    };
  }, [initialPresentation.id, sessionId, mode]);

  useEffect(() => {
    const source = new EventSource(`/api/presentations/${initialPresentation.id}/events`);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as SlideChangedEvent | PresentationFinishedEvent;
      if (event.type === "SLIDE_CHANGED") {
        setCurrentSlide(event.slideNumber);
      } else if (event.type === "PRESENTATION_FINISHED") {
        setIsFinished(true);
      }
    };
    return () => source.close();
  }, [initialPresentation.id]);

  useEffect(() => {
    if (!sessionId) return;
    const socket = io(`${window.location.protocol}//${window.location.hostname}:5024`, {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("participant-count", (event: { presentationId: string; participantCount: number }) => {
      if (event.presentationId !== initialPresentation.id || mode !== "host") return;
      setParticipantCount(event.participantCount);
    });

    socket.on("presentation-finished", (event: { presentationId: string }) => {
      if (event.presentationId !== initialPresentation.id) return;
      setIsFinished(true);
    });

    if (mode === "student") {
      socket.on("slide-changed", (event: { presentationId: string; slideNumber: number }) => {
        if (event.presentationId !== initialPresentation.id) return;
        if (!isFinished) {
          setCurrentSlide(event.slideNumber);
        }
      });
    }

    socket.on("connect", () => {
      socket.emit("join-presentation", {
        presentationId: initialPresentation.id,
        mode,
        sessionId,
      });
      if (mode === "host") socket.emit("request-participant-count", initialPresentation.id);
    });

    return () => {
      socket.off("slide-changed");
      socket.off("presentation-finished");
      socket.off("participant-count");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [mode, initialPresentation.id, isFinished, sessionId]);

  async function changeSlide(nextSlide: number) {
    if (isFinished) return;

    const response = await fetch(`/api/presentations/${initialPresentation.id}/slide`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideNumber: nextSlide }),
    });

    if (!response.ok) return;
    const result = (await response.json()) as { presentation?: Presentation };
    if (!result.presentation) return;

    setCurrentSlide(result.presentation.currentSlide);
    socketRef.current?.emit("slide-changed", {
      presentationId: initialPresentation.id,
      slideNumber: result.presentation.currentSlide,
    });
  }

  async function recordSlideCount(count: number) {
    if (count === slideCount) return;
    setSlideCount(count);
    await fetch(`/api/presentations/${initialPresentation.id}/slide`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideCount: count }),
    });
  }

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(studentUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = studentUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      setCopyState("Copied");
      window.setTimeout(() => setCopyState("Copy link"), 1600);
    } catch {
      setCopyState("Copy failed");
    }
  }

  async function finishPresentation() {
    setIsFinishing(true);
    try {
      const response = await fetch(`/api/presentations/${initialPresentation.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        setIsFinishing(false);
        return;
      }

      // Emit Socket.IO event to notify all participants
      socketRef.current?.emit("finish-presentation", {
        presentationId: initialPresentation.id,
      });

      setIsFinished(true);
      setShowConfirmFinish(false);
      setIsFinishing(false);
      router.replace("/host");
    } catch {
      setIsFinishing(false);
    }
  }

  if (mode === "student" && isFinished) {
    return (
      <main className="grid h-screen place-items-center bg-[#17252c] px-6 text-center">
        <p className="text-lg font-semibold text-[#f4f1e8]">Presentation finished</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col h-screen px-5 sm:px-8 overflow-hidden">
      <header className="flex items-center justify-between py-3 sm:py-3 shrink-0">
        <Link href="/" className="font-mono text-sm font-bold tracking-[0.18em] text-[#f4f1e8]">
          PPT LIVE
        </Link>
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#9eb5bd]">
          <i className={`h-2 w-2 rounded-full ${isFinished ? "bg-[#ff6b6b]" : "bg-[#65d391]"}`} />
          {isFinished ? "Finished" : "Online"}
        </span>
      </header>

      <section className="flex flex-col gap-2 pb-2 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-[#f4f1e8]">
              {initialPresentation.fileName}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <p className="font-mono text-xs text-[#c6d8d3]">
              {currentSlide} <span className="text-[#66808a]">/</span> {slideCount}
            </p>
            {mode === "host" && (
              <p className="text-xs text-[#849ba2]">
                <span className="text-[#a9bdc1]">{participantCount}</span> {participantCount === 1 ? "participant" : "participants"}
              </p>
            )}
          </div>
        </div>

        {isFinished && (
          <div className="rounded-lg border border-[#ff6b6b] bg-[#2c1a1a] px-3 py-1.5">
            <p className="text-center text-xs font-medium text-[#ff6b6b]">Presentation has ended.</p>
          </div>
        )}
      </section>

      <section className={`flex-1 min-h-0 py-2 ${mode === "host" ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]" : ""}`}>
        <div className="min-w-0">
          <PptViewer
            fileUrl={`/api/presentations/${initialPresentation.id}/file`}
            slideNumber={currentSlide}
            onSlideCount={(count) => void recordSlideCount(count)}
          />
        </div>

        {mode === "host" && (
          <section className="flex flex-col justify-center gap-3 border-t border-[#31464e] pt-3 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0">
            <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => void changeSlide(currentSlide - 1)}
              disabled={currentSlide <= 1 || isFinished}
              className="rounded-full border border-[#607880] px-4 py-2 text-xs font-medium text-[#e6eee8] transition hover:bg-[#20343d] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Previous
            </button>
            <button
              onClick={() => void changeSlide(currentSlide + 1)}
              disabled={currentSlide >= slideCount || isFinished}
              className="rounded-full bg-[#e59f71] px-4 py-2 text-xs font-bold text-[#17252c] transition hover:bg-[#f2b487] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Next
            </button>
            <button
              onClick={() => setShowConfirmFinish(true)}
              disabled={isFinished || isFinishing}
              className="rounded-full border border-[#ff6b6b] px-4 py-2 text-xs font-bold text-[#ff6b6b] transition hover:bg-[#3a1a1a] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isFinishing ? "Finishing..." : "Finish"}
            </button>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <span className="text-[#849ba2] uppercase tracking-[0.14em]">Student link</span>
              <code className="truncate rounded bg-[#0f1e24] px-2 py-1.5 text-[#a9bdc1] font-mono text-xs">
                {studentUrl}
              </code>
              <button
                onClick={() => void copyLink()}
                disabled={isFinished}
                className="w-full rounded-full border border-[#607880] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#edf0ef] transition hover:bg-[#20343d] disabled:opacity-35"
              >
                {copyState}
              </button>
            </div>
          </section>
        )}
      </section>

      {showConfirmFinish && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50">
          <div className="rounded-lg bg-[#17252c] p-5 shadow-lg max-w-sm">
            <h2 className="mb-3 text-base font-semibold text-[#f4f1e8]">Finish Presentation?</h2>
            <p className="mb-5 text-xs text-[#a9bdc1]">
              This will end the presentation for all participants. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmFinish(false)}
                disabled={isFinishing}
                className="flex-1 rounded-full border border-[#607880] px-4 py-2 text-xs font-medium text-[#e6eee8] transition hover:bg-[#20343d] disabled:opacity-35"
              >
                Cancel
              </button>
              <button
                onClick={() => void finishPresentation()}
                disabled={isFinishing}
                className="flex-1 rounded-full bg-[#ff6b6b] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#ff5252] disabled:opacity-35"
              >
                {isFinishing ? "Finishing..." : "Finish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
