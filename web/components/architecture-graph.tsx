/**
 * The architecture graph, as a layered SVG that reads left to right.
 *
 * A component's column is where it falls in the flow, so "browser → frontend →
 * API → database" or "read → join → aggregate → write" reads in order. Primary
 * flow edges are emphasised; inferred relationships are dashed, so a reader can
 * tell at a glance which arrows were read from code and which were interpreted.
 *
 * Components are buttons: click or press Enter to inspect. The same
 * relationships are listed as text by the page, so nothing depends on reading a
 * picture.
 */

"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { CATEGORY_LABEL, CATEGORY_TONE, cameraFor, flowEdges, fullView, layout } from "@/lib/architecture";
import type { ViewBox } from "@/lib/architecture";
import type { ArchitectureGraph as Graph, ArchitectureNode, MeasuredValue } from "@/lib/types";

const BOX_WIDTH = 170;
const BOX_HEIGHT = 48;
const COLUMN_GAP = 64;
const ROW_GAP = 18;

/**
 * Roles are told apart by a thin stripe in a restrained family, not by filling
 * every box with a different saturated colour: interfaces in deep cyan,
 * processing in cyan, data in slate, everything else neutral. Selection is the
 * one strong signal on the canvas.
 */
const STRIPE: Record<string, string> = {
  interface: "fill-arch-fg",
  processing: "fill-arch",
  data: "fill-fg-muted",
  other: "fill-line-strong",
};
const FAMILY: Record<string, keyof typeof STRIPE> = {
  violet: "interface",
  indigo: "interface",
  sky: "processing",
  emerald: "processing",
  rose: "processing",
  fuchsia: "processing",
  amber: "data",
  teal: "data",
  slate: "other",
};

export function ArchitectureGraph({
  graph,
  selected,
  highlighted,
  measured,
  onSelect,
  caption = defaultCaption,
  kind = (node) => CATEGORY_LABEL[node.category],
  edgeLabel,
  columnGap = COLUMN_GAP,
  frameSelected = false,
  selectedEdge = null,
  onEdgeSelect,
}: {
  graph: Graph;
  selected: string | null;
  highlighted: Set<string>;
  measured: Record<string, MeasuredValue[]>;
  onSelect: (nodeId: string) => void;
  /** The small second line of a box. Defaults to category and technology. */
  caption?: (node: ArchitectureNode) => string;
  /** What a box is, for screen readers. */
  kind?: (node: ArchitectureNode) => string;
  /** What passes along an edge, drawn on it ("tasks", "HTTP request"). */
  edgeLabel?: (edge: Graph["edges"][number]) => string | null;
  /** Wider gaps leave room for edge labels. */
  columnGap?: number;
  /** Zoom the camera to the selection and what it touches; off shows everything. */
  frameSelected?: boolean;
  /** The relationship under inspection, if any. */
  selectedEdge?: { source: string; target: string } | null;
  /** When given, relationships are clickable and report here. */
  onEdgeSelect?: (edge: Graph["edges"][number]) => void;
}) {
  const placements = useMemo(() => layout(graph), [graph]);
  const emphasised = flowEdges(graph);
  const columns = Math.max(1, ...[...placements.values()].map((p) => p.rank + 1));
  const rows = Math.max(1, ...[...placements.values()].map((p) => p.row + 1));
  const width = columns * BOX_WIDTH + (columns - 1) * columnGap;
  const height = rows * BOX_HEIGHT + (rows - 1) * ROW_GAP;
  // What the selection touches: everything else steps back.
  const connected = new Set<string>();
  if (selected) {
    for (const edge of graph.edges) {
      if (edge.source === selected) connected.add(edge.target);
      if (edge.target === selected) connected.add(edge.source);
    }
  }
  const target = useMemo(() => {
    if (!frameSelected || !selected) return fullView({ width, height });
    return (
      cameraFor(
        placements,
        [selected, ...connected],
        { boxWidth: BOX_WIDTH, boxHeight: BOX_HEIGHT, columnGap, rowGap: ROW_GAP },
        { width, height },
      ) ?? fullView({ width, height })
    );
    // placements is memoised on graph; connected derives from selected + graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameSelected, selected, graph, columnGap, width, height]);
  const [svgRef, initialView] = useCamera(target);
  const dimmed = (id: string) => selected !== null && id !== selected && !connected.has(id);
  const at = (id: string) => {
    const p = placements.get(id);
    return p ? { x: p.rank * (BOX_WIDTH + columnGap), y: p.row * (BOX_HEIGHT + ROW_GAP) } : null;
  };

  const labelOf = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={formatViewBox(initialView)}
        width={width + 16}
        height={height + 16}
        role="group"
        aria-label={`${graph.nodes.length} components and ${graph.edges.length} relationships`}
        data-testid="architecture-graph"
        className="max-w-none"
      >
        <defs>
          <marker
            id="arch-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>

        {graph.edges.map((edge, index) => {
          const from = at(edge.source);
          const to = at(edge.target);
          if (!from || !to) return null;
          const forward = to.x > from.x;
          const startX = forward ? from.x + BOX_WIDTH : from.x + BOX_WIDTH / 2;
          const startY = forward ? from.y + BOX_HEIGHT / 2 : from.y + BOX_HEIGHT;
          const endX = forward ? to.x : to.x + BOX_WIDTH / 2;
          const endY = forward ? to.y + BOX_HEIGHT / 2 : to.y;
          const midX = (startX + endX) / 2;
          const onFlow = emphasised.has(`${edge.source}->${edge.target}`);
          const active = selected === edge.source || selected === edge.target;
          const faded = selected !== null && !active;
          const isEdgeSelected = selectedEdge?.source === edge.source && selectedEdge?.target === edge.target;
          const d = forward
            ? `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`
            : `M ${startX} ${startY} L ${endX} ${endY}`;
          const visible = (
            <path
              data-testid="architecture-edge"
              data-provenance={edge.provenance}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={isEdgeSelected ? 2.4 : active || onFlow ? 1.8 : 1}
              strokeDasharray={edge.provenance === "inferred" ? "4 3" : undefined}
              markerEnd="url(#arch-arrow)"
              className={`transition-opacity duration-150 ${
                isEdgeSelected || active ? "text-arch" : onFlow ? "text-fg-secondary" : "text-fg-muted"
              } ${faded ? "opacity-25" : ""}`}
            >
              <title>{edge.type.replace(/_/g, " ")}</title>
            </path>
          );
          if (!onEdgeSelect) return <g key={`${edge.source}-${edge.target}-${index}`}>{visible}</g>;
          return (
            <g
              key={`${edge.source}-${edge.target}-${index}`}
              role="button"
              tabIndex={0}
              aria-pressed={isEdgeSelected}
              aria-label={`${labelOf(edge.source)} ${edge.type.replace(/_/g, " ")} ${labelOf(edge.target)}`}
              data-testid="architecture-edge-button"
              data-edge={`${edge.source}->${edge.target}`}
              onClick={() => onEdgeSelect(edge)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onEdgeSelect(edge);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <path d={d} fill="none" stroke="transparent" strokeWidth={16} pointerEvents="stroke" />
              {visible}
            </g>
          );
        })}

        {edgeLabel &&
          graph.edges.map((edge, index) => {
            const label = edgeLabel(edge);
            const from = at(edge.source);
            const to = at(edge.target);
            if (!label || !from || !to) return null;
            const forward = to.x > from.x;
            // Back-edges run along the boxes; a label there would sit on others.
            if (!forward) return null;
            const x = (from.x + BOX_WIDTH + to.x) / 2;
            const y = (from.y + to.y) / 2 + BOX_HEIGHT / 2 - 5;
            const faded = selected !== null && selected !== edge.source && selected !== edge.target;
            return (
              <text
                key={`label-${edge.source}-${edge.target}-${index}`}
                x={x}
                y={y}
                textAnchor="middle"
                data-testid="edge-label"
                className={`fill-fg-secondary text-[10px] transition-opacity duration-150 ${faded ? "opacity-25" : ""}`}
                stroke="var(--canvas)"
                strokeWidth={4}
                style={{ paintOrder: "stroke" }}
              >
                {truncate(label, 22)}
              </text>
            );
        })}

        {graph.nodes.map((node) => {
          const position = at(node.id);
          if (!position) return null;
          const isSelected = selected === node.id;
          const isHighlighted = highlighted.has(node.id);
          const values = measured[node.id] ?? [];
          const isConnected = connected.has(node.id);
          const family = FAMILY[CATEGORY_TONE[node.category]] ?? "other";
          return (
            <g
              key={node.id}
              transform={`translate(${position.x} ${position.y})`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${node.label}, ${kind(node)}`}
              data-testid="architecture-node"
              data-node-id={node.id}
              data-highlighted={isHighlighted || undefined}
              data-connected={isConnected || undefined}
              data-dimmed={dimmed(node.id) || undefined}
              onClick={() => onSelect(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(node.id);
                }
              }}
              className={`group cursor-pointer outline-none transition-opacity duration-150 ${
                dimmed(node.id) ? "opacity-40" : ""
              }`}
            >
              <rect
                width={BOX_WIDTH}
                height={BOX_HEIGHT}
                rx="8"
                strokeWidth={isSelected || isHighlighted ? 2 : 1}
                strokeDasharray={node.children.length ? "5 3" : undefined}
                className={`transition-colors duration-150 group-hover:stroke-arch group-focus-visible:stroke-brand ${
                  isSelected
                    ? "fill-arch-soft stroke-arch"
                    : isHighlighted
                      ? "fill-surface stroke-arch"
                      : isConnected
                        ? "fill-surface stroke-arch-line"
                        : "fill-surface stroke-line-strong"
                }`}
              />
              <rect x="0" y="10" width="3" height={BOX_HEIGHT - 20} rx="1.5" className={STRIPE[family]} />
              <text x="12" y="20" className="fill-fg text-[11px] font-medium">
                {truncate(node.label, 24)}
              </text>
              <text x="12" y="35" className="fill-fg-muted text-[10px]">
                {truncate(caption(node), 28)}
              </text>
              {values.length > 0 && (
                <g data-testid="measured-badge">
                  <rect x={BOX_WIDTH - 16} y="-6" width="20" height="14" rx="7" className="fill-run" />
                  <text x={BOX_WIDTH - 6} y="4" textAnchor="middle" className="fill-white text-[9px] font-semibold">
                    M
                  </text>
                  <title>{`${values.length} measured value(s)`}</title>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * The camera: eases the SVG's viewBox toward its target so it glides instead
 * of jumping, without re-rendering every frame. Instant on first paint, when
 * reduced motion is preferred, and wherever animation frames don't exist.
 */
function useCamera(target: ViewBox): [RefObject<SVGSVGElement | null>, ViewBox] {
  const ref = useRef<SVGSVGElement | null>(null);
  const [initial] = useState(target);
  const shownRef = useRef(target);
  const first = useRef(true);
  const key = `${target.x},${target.y},${target.w},${target.h}`;
  useEffect(() => {
    const el = ref.current;
    const from = shownRef.current;
    const animate =
      !first.current &&
      el !== null &&
      typeof requestAnimationFrame !== "undefined" &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    first.current = false;
    if (!animate || !el) {
      shownRef.current = target;
      el?.setAttribute("viewBox", formatViewBox(target));
      return;
    }
    const start = performance.now();
    const duration = 320;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = {
        x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased,
        w: from.w + (target.w - from.w) * eased,
        h: from.h + (target.h - from.h) * eased,
      };
      shownRef.current = next;
      el.setAttribute("viewBox", formatViewBox(next));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // The key stands in for the target's fields, which change identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [ref, initial];
}

function formatViewBox(view: ViewBox): string {
  return `${view.x} ${view.y} ${view.w} ${view.h}`;
}

function defaultCaption(node: ArchitectureNode): string {
  return CATEGORY_LABEL[node.category] + (node.technology ? ` · ${truncate(node.technology, 14)}` : "");
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
