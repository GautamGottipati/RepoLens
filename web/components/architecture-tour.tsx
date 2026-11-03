/**
 * One walkthrough, played as a tour instead of read as a list.
 *
 * Each step selects its component -- the existing selection machinery moves the
 * inspector and frames the graph -- while this panel carries the narrative:
 * where the step sits in the path, what it says, and how to move. Arrow keys
 * step when the player has focus; every move is also a button.
 */

"use client";

import type { Walkthrough } from "@/lib/types";

export function TourPlayer({
  walkthrough,
  step,
  onStep,
  onEnd,
}: {
  walkthrough: Walkthrough;
  step: number;
  onStep: (index: number) => void;
  onEnd: () => void;
}) {
  const current = walkthrough.steps[Math.min(step, walkthrough.steps.length - 1)];
  if (!current) return null;
  const at = Math.min(step, walkthrough.steps.length - 1);
  return (
    <div
      data-testid="tour-player"
      data-walkthrough-id={walkthrough.id}
      data-tour-step={at}
      tabIndex={0}
      role="group"
      aria-label={`${walkthrough.name}, step ${at + 1} of ${walkthrough.steps.length}`}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onStep(Math.min(at + 1, walkthrough.steps.length - 1));
        if (event.key === "ArrowLeft") onStep(Math.max(at - 1, 0));
      }}
      className="flex flex-col gap-3 rounded-lg border border-arch-line bg-arch-soft/40 p-4 outline-none focus-visible:border-arch"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-arch-fg" data-testid="tour-progress">
          Step {at + 1} of {walkthrough.steps.length}
        </p>
        <button
          type="button"
          onClick={onEnd}
          data-testid="tour-end"
          className="rounded-md px-2 py-1 text-xs text-fg-secondary hover:bg-surface-hover hover:text-fg"
        >
          End tour
        </button>
      </div>
      <div>
        <p className="text-sm font-medium" data-testid="tour-step-label">
          {current.label}
        </p>
        {current.detail && (
          <p className="mt-1 text-sm text-fg-secondary" data-testid="tour-step-detail">
            {current.detail}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onStep(Math.max(at - 1, 0))}
          disabled={at === 0}
          data-testid="tour-prev"
          className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={() => onStep(Math.min(at + 1, walkthrough.steps.length - 1))}
          disabled={at === walkthrough.steps.length - 1}
          data-testid="tour-next"
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {at === walkthrough.steps.length - 1 ? "Finish" : "Next →"}
        </button>
      </div>
      {walkthrough.provenance === "inferred" && (
        <p className="text-xs uppercase tracking-wide text-fg-muted">inferred by Muse along evidenced relationships</p>
      )}
    </div>
  );
}
