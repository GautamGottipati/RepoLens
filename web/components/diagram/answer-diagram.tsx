/**
 * The answer's verified boxes and arrows, drawn so they can be explored.
 *
 * Selecting a box spotlights it and what it touches, and offers what the
 * answer kept for it: the file to open, the architecture component to visit,
 * or both. Selecting an arrow explains the relationship the same way. The
 * text list below stays the non-visual equivalent of the drawing.
 */

"use client";

import { useState } from "react";

import type { ArchitectureGraph, GroundedAnswer, VisualEdge, VisualNode } from "@/lib/types";
import { SourceChip } from "../ui";
import { diagramLayers } from "./layout";

const BOX_W = 150;
const BOX_H = 44;
const GAP_X = 20;
const GAP_Y = 36;

export function AnswerDiagram({
  answer,
  graph,
  jobId = null,
  architecture = null,
  onOpen,
}: {
  answer: GroundedAnswer;
  graph: ArchitectureGraph;
  /** The job, for "Open in Architecture" links. Without it they are hidden. */
  jobId?: string | null;
  /** The analysed architecture, to resolve component links against. */
  architecture?: ArchitectureGraph | null;
  onOpen: (cited: string, reason: string) => void;
}) {
  const boxes = diagramLayers(graph);
  const perLayer = new Map<number, number>();
  for (const box of boxes) perLayer.set(box.layer, Math.max(perLayer.get(box.layer) ?? 0, box.column + 1));
  const columns = Math.max(1, ...perLayer.values());
  const layers = Math.max(1, ...boxes.map((b) => b.layer + 1));
  const width = columns * BOX_W + (columns - 1) * GAP_X;
  const height = layers * BOX_H + (layers - 1) * GAP_Y;
  const at = new Map(
    boxes.map((box) => {
      const count = perLayer.get(box.layer) ?? 1;
      const rowWidth = count * BOX_W + (count - 1) * GAP_X;
      const x = (width - rowWidth) / 2 + box.column * (BOX_W + GAP_X);
      return [box.id, { x, y: box.layer * (BOX_H + GAP_Y), box }];
    }),
  );
  const visual = answer.visual!;
  const nodeOf = new Map(visual.nodes.map((node) => [node.id, node]));
  const known = new Set((architecture?.nodes ?? []).map((node) => node.id));

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{ source: string; target: string } | null>(null);
  const selectNode = (id: string) => {
    setSelectedEdge(null);
    setSelectedNode((current) => (current === id ? null : id));
  };
  const selectEdge = (edge: VisualEdge) => {
    setSelectedNode(null);
    setSelectedEdge((current) =>
      current?.source === edge.source && current?.target === edge.target ? null : { source: edge.source, target: edge.target },
    );
  };
  // What the selection touches stays lit; everything else steps back.
  const lit = new Set<string>();
  if (selectedNode) {
    lit.add(selectedNode);
    for (const edge of visual.edges) {
      if (edge.source === selectedNode) lit.add(edge.target);
      if (edge.target === selectedNode) lit.add(edge.source);
    }
  }
  const edgeLit = (edge: VisualEdge) =>
    (selectedEdge?.source === edge.source && selectedEdge?.target === edge.target) ||
    (selectedNode !== null && (edge.source === selectedNode || edge.target === selectedNode));
  const dimmed = selectedNode !== null || selectedEdge !== null;

  const selectedEdgeDetail = selectedEdge
    ? visual.edges.find((e) => e.source === selectedEdge.source && e.target === selectedEdge.target) ?? null
    : null;

  return (
    <figure className="min-w-0" data-testid="answer-visual">
      <svg
        viewBox={`-4 -4 ${width + 8} ${height + 8}`}
        width="100%"
        style={{ maxWidth: width + 8 }}
        role="group"
        aria-label={`${visual.nodes.length} parts and ${visual.edges.length} relationships`}
        className="mx-auto block h-auto"
      >
        <defs>
          <marker id="answer-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {visual.edges.map((edge, index) => {
          const from = at.get(edge.source);
          const to = at.get(edge.target);
          if (!from || !to) return null;
          const down = to.y > from.y;
          const x1 = from.x + BOX_W / 2;
          const y1 = down ? from.y + BOX_H : from.y + BOX_H / 2;
          const x2 = to.x + BOX_W / 2;
          const y2 = down ? to.y : to.y + BOX_H / 2;
          const mid = (y1 + y2) / 2;
          const d = down ? `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}` : `M ${x1} ${y1} L ${x2} ${y2}`;
          const active = edgeLit(edge);
          const fromLabel = nodeOf.get(edge.source)?.label ?? edge.source;
          const toLabel = nodeOf.get(edge.target)?.label ?? edge.target;
          return (
            <g
              key={`${edge.source}-${edge.target}-${index}`}
              role="button"
              tabIndex={0}
              aria-pressed={selectedEdge?.source === edge.source && selectedEdge?.target === edge.target}
              aria-label={`${fromLabel} to ${toLabel}${edge.label ? `: ${edge.label}` : ""}`}
              data-edge={`${edge.source}->${edge.target}`}
              onClick={() => selectEdge(edge)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectEdge(edge);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <path d={d} fill="none" stroke="transparent" strokeWidth={16} pointerEvents="stroke" />
              <path
                data-testid="diagram-edge"
                data-provenance={edge.provenance}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={active && selectedEdge ? 2.2 : 1.4}
                strokeDasharray={edge.provenance === "inferred" ? "4 3" : undefined}
                markerEnd="url(#answer-arrow)"
                className={`text-fg-muted transition-opacity duration-150 ${dimmed && !active ? "opacity-25" : ""}`}
              >
                <title>{edge.label || "connects to"}</title>
              </path>
            </g>
          );
        })}
        {[...at.values()].map(({ x, y, box }) => {
          const node = nodeOf.get(box.id);
          const active = !dimmed || lit.has(box.id);
          return (
            <g
              key={box.id}
              transform={`translate(${x} ${y})`}
              data-testid="diagram-node"
              data-node-id={box.id}
              role="button"
              tabIndex={0}
              aria-pressed={selectedNode === box.id}
              aria-label={`${box.label}, show what the answer kept for it`}
              onClick={() => selectNode(box.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectNode(box.id);
                }
              }}
              className={`cursor-pointer outline-none transition-opacity duration-150 ${active ? "" : "opacity-30"}`}
            >
              <rect
                width={BOX_W}
                height={BOX_H}
                rx="7"
                className={`fill-surface ${selectedNode === box.id ? "stroke-arch" : "stroke-line-strong"}`}
                strokeWidth={selectedNode === box.id ? 2 : 1}
              />
              <text x={BOX_W / 2} y="19" textAnchor="middle" className="fill-fg text-[12px] font-medium">
                {truncate(box.label, 22)}
              </text>
              <text x={BOX_W / 2} y="34" textAnchor="middle" className="fill-fg-muted text-[10px]">
                {truncate(box.caption, 26)}
              </text>
              {node?.component_id && known.has(node.component_id) && jobId && (
                <title>{`${box.label} — also in the architecture analysis`}</title>
              )}
            </g>
          );
        })}
      </svg>
      {(selectedNode || selectedEdgeDetail) && (
        <DiagramDetail
          node={selectedNode ? nodeOf.get(selectedNode) ?? null : null}
          edge={selectedEdgeDetail}
          labelOf={(id) => nodeOf.get(id)?.label ?? id}
          jobId={jobId}
          architectureIds={known}
          onOpen={onOpen}
          onClose={() => {
            setSelectedNode(null);
            setSelectedEdge(null);
          }}
        />
      )}
      <figcaption className="mt-3">
        <ul className="flex flex-col gap-1 text-xs text-fg-secondary" data-testid="relationships">
          {visual.edges.map((edge, index) => {
            const from = visual.nodes.find((n) => n.id === edge.source)?.label;
            const to = visual.nodes.find((n) => n.id === edge.target)?.label;
            const file = edge.provenance !== "inferred" && !edge.support.startsWith("edge:") ? edge.support : null;
            return (
              <li key={index} className="flex flex-wrap items-center gap-x-2">
                <span>
                  {from} → {to}
                  {edge.label ? `: ${edge.label}` : ""}
                </span>
                {edge.provenance === "inferred" ? (
                  <span className="italic text-fg-muted">inferred</span>
                ) : file ? (
                  <SourceChip cited={file} onOpen={() => onOpen(file, `${from} → ${to}`)} />
                ) : (
                  <span className="text-fg-muted">from the architecture analysis</span>
                )}
              </li>
            );
          })}
        </ul>
      </figcaption>
    </figure>
  );
}

function DiagramDetail({
  node,
  edge,
  labelOf,
  jobId,
  architectureIds,
  onOpen,
  onClose,
}: {
  node: VisualNode | null;
  edge: VisualEdge | null;
  labelOf: (id: string) => string;
  jobId: string | null | undefined;
  architectureIds: Set<string>;
  onOpen: (cited: string, reason: string) => void;
  onClose: () => void;
}) {
  const componentId = node?.component_id ?? null;
  const grounded = componentId !== null && architectureIds.has(componentId) && jobId;
  const file = edge && edge.provenance !== "inferred" && !edge.support.startsWith("edge:") ? edge.support : null;
  const fromArchitecture = edge && edge.provenance !== "inferred" && edge.support.startsWith("edge:");
  return (
    <div data-testid="diagram-detail" className="mt-3 rounded-lg border border-line bg-surface-subtle p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {node ? node.label : `${labelOf(edge!.source)} → ${labelOf(edge!.target)}`}
          {node?.kind && <span className="ml-2 text-xs font-normal text-fg-secondary">{node.kind}</span>}
          {edge?.label && <span className="ml-2 text-xs font-normal text-fg-secondary">{edge.label}</span>}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded px-1 text-xs text-fg-secondary hover:text-fg"
        >
          ✕
        </button>
      </div>
      {edge?.provenance === "inferred" && (
        <p className="mt-1 text-xs italic text-fg-muted">Inferred from the surrounding evidence, not read from one place.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {node?.source && (
          <button
            type="button"
            onClick={() => onOpen(node.source!, node.label)}
            data-testid="diagram-open-code"
            className="rounded border border-line-strong px-2 py-1 font-mono hover:underline"
          >
            Open code: {node.source}
          </button>
        )}
        {grounded && (
          <a
            href={`/r/${jobId}/architecture?node=${encodeURIComponent(componentId!)}`}
            data-testid="diagram-open-architecture"
            className="rounded border border-line-strong px-2 py-1 hover:underline"
          >
            Open in Architecture
          </a>
        )}
        {file && (
          <button
            type="button"
            onClick={() => onOpen(file, `${labelOf(edge!.source)} → ${labelOf(edge!.target)}`)}
            data-testid="diagram-open-code"
            className="rounded border border-line-strong px-2 py-1 font-mono hover:underline"
          >
            Open code: {file}
          </button>
        )}
        {fromArchitecture && jobId && (
          <a
            href={`/r/${jobId}/architecture`}
            data-testid="diagram-open-architecture"
            className="rounded border border-line-strong px-2 py-1 hover:underline"
          >
            View in Architecture
          </a>
        )}
        {!node?.source && !grounded && !file && !fromArchitecture && edge?.provenance !== "inferred" && (
          <span className="text-xs text-fg-secondary">The answer kept no file or component for this.</span>
        )}
      </div>
    </div>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
