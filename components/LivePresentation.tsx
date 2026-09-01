"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { PptViewer } from "@/components/PptViewer";
import type {
  Presentation,
} from "@/lib/presentation";

type LivePresentationProps = {
  presentation: Presentation;
  mode: "host" | "student";
};

type ParticipantCountEvent = {
  presentationId: string;
  participantCount: number;
};

type SlideChangedEvent = {
  presentationId: string;
  slideNumber: number;
};

type PresentationFinishedEvent = {
  presentationId: string;
};

export function LivePresentation({
  presentation: initialPresentation,
  mode,
}: LivePresentationProps) {
  const router = useRouter();

  const [currentSlide, setCurrentSlide] = useState(
    initialPresentation.currentSlide
  );

  const [slideCount, setSlideCount] = useState(
    initialPresentation.slideCount
  );

  const [participantCount, setParticipantCount] = useState(
    initialPresentation.participantCount
  );

  const [copyState, setCopyState] = useState("Copy link");

  const [studentUrl, setStudentUrl] = useState(
    `/presentation/${initialPresentation.id}`
  );

  const [isFinished, setIsFinished] = useState(
    initialPresentation.status === "finished"
  );

  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const [sessionId, setSessionId] = useState("");

  const socketRef = useRef<Socket | null>(null);

  // Keep the latest finished state available to socket callbacks
  // without recreating the socket connection.
  const isFinishedRef = useRef(isFinished);

  useEffect(() => {
    isFinishedRef.current = isFinished;
  }, [isFinished]);

  // ------------------------------------------------------------
  // Create / restore persistent session ID
  // ------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = `ppt-session-${initialPresentation.id}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      setSessionId(stored);
      return;
    }

    const newId = crypto.randomUUID();

    setSessionId(newId);
    localStorage.setItem(storageKey, newId);
  }, [initialPresentation.id]);

  // ------------------------------------------------------------
  // Build student URL
  // ------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    setStudentUrl(
      `${window.location.protocol}//${window.location.hostname}:5023/presentation/${initialPresentation.id}`
    );
  }, [initialPresentation.id]);

  // ------------------------------------------------------------
  // Track student participant
  // ------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) return;

    // Host should NOT be counted as a participant.
    if (mode === "host") return;

    let cancelled = false;

    async function joinPresentation() {
      try {
        const response = await fetch(
          `/api/presentations/${initialPresentation.id}/join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId,
            }),
          }
        );

        if (!response.ok || cancelled) return;

        const result = (await response.json()) as {
          presentation?: Presentation;
        };

        if (result.presentation) {
          setParticipantCount(result.presentation.participantCount);
        }
      } catch {
        // Ignore join errors.
      }
    }

    void joinPresentation();

    return () => {
      cancelled = true;

      fetch(`/api/presentations/${initialPresentation.id}/join`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
        }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [initialPresentation.id, sessionId, mode]);

  // ------------------------------------------------------------
  // Socket.IO connection
  // ------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) return;

    const socketUrl = `${window.location.protocol}//${window.location.hostname}:5024`;

    const socket = io(socketUrl, {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    // ----------------------------------------------------------
    // Participant count - host only
    // ----------------------------------------------------------
    const handleParticipantCount = (
      event: ParticipantCountEvent
    ) => {
      if (mode !== "host") return;

      if (event.presentationId !== initialPresentation.id) {
        return;
      }

      setParticipantCount(event.participantCount);
    };

    // ----------------------------------------------------------
    // Slide change - students only
    // ----------------------------------------------------------
    const handleSlideChanged = (event: SlideChangedEvent) => {
      if (mode !== "student") return;

      if (event.presentationId !== initialPresentation.id) {
        return;
      }

      // Do not update slides after presentation has finished.
      if (isFinishedRef.current) {
        return;
      }

      setCurrentSlide(event.slideNumber);
    };

    // ----------------------------------------------------------
    // Presentation finished - host + students
    // ----------------------------------------------------------
    const handlePresentationFinished = (
      event: PresentationFinishedEvent
    ) => {
      if (event.presentationId !== initialPresentation.id) {
        return;
      }

      isFinishedRef.current = true;
      setIsFinished(true);
    };

    socket.on("participant-count", handleParticipantCount);
    socket.on("slide-changed", handleSlideChanged);
    socket.on("presentation-finished", handlePresentationFinished);

    // ----------------------------------------------------------
    // Socket connected
    // ----------------------------------------------------------
    const handleConnect = () => {
      socket.emit("join-presentation", {
        presentationId: initialPresentation.id,
        mode,
        sessionId,
      });

      if (mode === "host") {
        socket.emit(
          "request-participant-count",
          initialPresentation.id
        );
      }
    };

    socket.on("connect", handleConnect);

    // ----------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------
    return () => {
      socket.off("connect", handleConnect);
      socket.off("participant-count", handleParticipantCount);
      socket.off("slide-changed", handleSlideChanged);
      socket.off(
        "presentation-finished",
        handlePresentationFinished
      );

      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [mode, initialPresentation.id, sessionId]);

  // ------------------------------------------------------------
  // Host changes slide
  // ------------------------------------------------------------
  async function changeSlide(nextSlide: number) {
    if (mode !== "host") return;
    if (isFinishedRef.current) return;
    if (nextSlide < 1) return;
    if (slideCount > 0 && nextSlide > slideCount) return;

    try {
      const response = await fetch(
        `/api/presentations/${initialPresentation.id}/slide`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slideNumber: nextSlide,
          }),
        }
      );

      if (!response.ok) return;

      const result = (await response.json()) as {
        presentation?: Presentation;
      };

      if (!result.presentation) return;

      const updatedSlide = result.presentation.currentSlide;

      // Update host immediately.
      setCurrentSlide(updatedSlide);

      // Notify all students through Socket.IO.
      socketRef.current?.emit("slide-changed", {
        presentationId: initialPresentation.id,
        slideNumber: updatedSlide,
      });
    } catch {
      // Ignore slide change errors.
    }
  }

  // ------------------------------------------------------------
  // Record slide count
  //
  // IMPORTANT:
  // Only HOST should update slide count.
  // Students must NOT send this API request.
  // ------------------------------------------------------------
  async function recordSlideCount(count: number) {
    if (mode !== "host") return;
    if (count <= 0) return;
    if (count === slideCount) return;

    setSlideCount(count);

    try {
      await fetch(
        `/api/presentations/${initialPresentation.id}/slide`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slideCount: count,
          }),
        }
      );
    } catch {
      // Ignore slide count errors.
    }
  }

  // ------------------------------------------------------------
  // Copy student link
  // ------------------------------------------------------------
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

      window.setTimeout(() => {
        setCopyState("Copy link");
      }, 1600);
    } catch {
      setCopyState("Copy failed");
    }
  }

  // ------------------------------------------------------------
  // Finish presentation
  // ------------------------------------------------------------
  async function finishPresentation() {
    if (isFinishing) return;
    if (isFinishedRef.current) return;

    setIsFinishing(true);

    try {
      const response = await fetch(
        `/api/presentations/${initialPresentation.id}/finish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        setIsFinishing(false);
        return;
      }

      // Mark host as finished immediately.
      isFinishedRef.current = true;
      setIsFinished(true);
      setShowConfirmFinish(false);

      // Notify all connected students.
      socketRef.current?.emit("finish-presentation", {
        presentationId: initialPresentation.id,
      });

      setIsFinishing(false);

      // Return host to host dashboard.
      router.replace("/host");
    } catch {
      setIsFinishing(false);
    }
  }

  // ------------------------------------------------------------
  // Student finished screen
  // ------------------------------------------------------------
  if (mode === "student" && isFinished) {
    return (
      <main className="grid h-screen place-items-center bg-[#17252c] px-6 text-center">
        <div>
          <p className="text-lg font-semibold text-[#f4f1e8]">
            Presentation finished
          </p>

          <p className="mt-2 text-sm text-[#9eb5bd]">
            The host has ended this presentation.
          </p>
        </div>
      </main>
    );
  }

  // ------------------------------------------------------------
  // Main UI
  // ------------------------------------------------------------
  return (
    <main className="mx-auto flex h-screen w-full max-w-6xl flex-col overflow-hidden px-5 sm:px-8">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between py-3">
        <Link
          href="/"
          className="font-mono text-sm font-bold tracking-[0.18em] text-[#f4f1e8]"
        >
          PPT LIVE
        </Link>

        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#9eb5bd]">
          <i
            className={`h-2 w-2 rounded-full ${
              isFinished
                ? "bg-[#ff6b6b]"
                : "bg-[#65d391]"
            }`}
          />

          {isFinished ? "Finished" : "Online"}
        </span>
      </header>

      {/* Presentation information */}
      <section className="flex shrink-0 flex-col gap-2 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-[#f4f1e8]">
              {initialPresentation.fileName}
            </h1>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <p className="font-mono text-xs text-[#c6d8d3]">
              {currentSlide}{" "}
              <span className="text-[#66808a]">/</span>{" "}
              {slideCount}
            </p>

            {mode === "host" && (
              <p className="text-xs text-[#849ba2]">
                <span className="text-[#a9bdc1]">
                  {participantCount}
                </span>{" "}
                {participantCount === 1
                  ? "participant"
                  : "participants"}
              </p>
            )}
          </div>
        </div>

        {isFinished && (
          <div className="rounded-lg border border-[#ff6b6b] bg-[#2c1a1a] px-3 py-1.5">
            <p className="text-center text-xs font-medium text-[#ff6b6b]">
              Presentation has ended.
            </p>
          </div>
        )}
      </section>

      {/* PPT viewer + host controls */}
      <section
        className={`flex min-h-0 flex-1 flex-col py-2 ${
          mode === "host"
            ? "gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_220px]"
            : ""
        }`}
      >
        {/* PPT Viewer */}
        <div className="min-w-0">
          <PptViewer
            fileUrl={`/api/presentations/${initialPresentation.id}/file`}
            slideNumber={currentSlide}
            onSlideCount={
              mode === "host"
                ? (count) => void recordSlideCount(count)
                : undefined
            }
          />
        </div>

        {/* Host controls */}
        {mode === "host" && (
          <section className="flex flex-col justify-center gap-3 border-t border-[#31464e] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <div className="flex flex-wrap gap-2">
              {/* Previous */}
              <button
                onClick={() =>
                  void changeSlide(currentSlide - 1)
                }
                disabled={
                  currentSlide <= 1 || isFinished
                }
                className="rounded-full border border-[#607880] px-4 py-2 text-xs font-medium text-[#e6eee8] transition hover:bg-[#20343d] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              {/* Next */}
              <button
                onClick={() =>
                  void changeSlide(currentSlide + 1)
                }
                disabled={
                  currentSlide >= slideCount ||
                  isFinished
                }
                className="rounded-full bg-[#e59f71] px-4 py-2 text-xs font-bold text-[#17252c] transition hover:bg-[#f2b487] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>

              {/* Finish */}
              <button
                onClick={() =>
                  setShowConfirmFinish(true)
                }
                disabled={
                  isFinished || isFinishing
                }
                className="rounded-full border border-[#ff6b6b] px-4 py-2 text-xs font-bold text-[#ff6b6b] transition hover:bg-[#3a1a1a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isFinishing
                  ? "Finishing..."
                  : "Finish"}
              </button>
            </div>

            {/* Student link */}
            <div className="flex flex-col gap-1.5 text-xs">
              <span className="uppercase tracking-[0.14em] text-[#849ba2]">
                Student link
              </span>

              <code className="truncate rounded bg-[#0f1e24] px-2 py-1.5 font-mono text-xs text-[#a9bdc1]">
                {studentUrl}
              </code>

              <button
                onClick={() => void copyLink()}
                disabled={isFinished}
                className="w-full rounded-full border border-[#607880] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#edf0ef] transition hover:bg-[#20343d] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copyState}
              </button>
            </div>
          </section>
        )}
      </section>

      {/* Finish confirmation dialog */}
      {showConfirmFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-sm rounded-lg bg-[#17252c] p-5 shadow-lg">
            <h2 className="mb-3 text-base font-semibold text-[#f4f1e8]">
              Finish Presentation?
            </h2>

            <p className="mb-5 text-xs text-[#a9bdc1]">
              This will end the presentation for all
              participants. This action cannot be undone.
            </p>

            <div className="flex gap-3">
              {/* Cancel */}
              <button
                onClick={() =>
                  setShowConfirmFinish(false)
                }
                disabled={isFinishing}
                className="flex-1 rounded-full border border-[#607880] px-4 py-2 text-xs font-medium text-[#e6eee8] transition hover:bg-[#20343d] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>

              {/* Confirm */}
              <button
                onClick={() => void finishPresentation()}
                disabled={isFinishing}
                className="flex-1 rounded-full bg-[#ff6b6b] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#ff5252] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isFinishing
                  ? "Finishing..."
                  : "Finish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}