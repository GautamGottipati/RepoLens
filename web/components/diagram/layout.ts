/**
 * Answer diagrams: how the boxes and arrows the backend verified become places
 * on a page. Pure functions, so the diagram can be tested without a browser.
 *
 * Nothing here adds to an answer. The boxes, arrows and captions are exactly
 * what verification kept; these functions only arrange them.
 */

import { CATEGORY_LABEL, layout } from "@/lib/architecture";
import type {
  ArchitectureEdge,
  ArchitectureGraph,
  ArchitectureNode,
  GroundedAnswer,
  NodeCategory,
} from "@/lib/types";

const KIND_CATEGORY: Array<[RegExp, NodeCategory]> = [
  [/server|service|app/i, "service"],
  [/model|schema|orm|entity/i, "model"],
  [/database|db|store|table|collection/i, "database"],
  [/cache/i, "cache"],
  [/queue|topic|broker/i, "queue"],
  [/worker|job|task/i, "worker"],
  [/cli|command|shell/i, "cli"],
  [/config/i, "configuration"],
];

function categoryFor(kind: string, component: ArchitectureNode | null): NodeCategory {
  if (component) return component.category;
  return KIND_CATEGORY.find(([pattern]) => pattern.test(kind))?.[1] ?? "other";
}

/**
 * The answer's diagram as an architecture graph, so the shared layered layout
 * places it. Boxes and arrows are exactly the verified ones; nothing is added.
 */
export function answerGraph(answer: GroundedAnswer, architecture: ArchitectureGraph | null): ArchitectureGraph | null {
  const visual = answer.visual;
  if (!visual || visual.nodes.length < 2 || visual.edges.length === 0) return null;
  const known = new Map((architecture?.nodes ?? []).map((node) => [node.id, node]));
  const nodes: ArchitectureNode[] = visual.nodes.map((box) => {
    const component = box.component_id ? known.get(box.component_id) ?? null : null;
    return {
      id: box.id,
      label: box.label,
      category: categoryFor(box.kind, component),
      subtype: null,
      technology: box.kind || null,
      description: null,
      runtime_significance: null,
      source_references: [],
      properties: {},
      confidence: 0.7,
      provenance: "static",
      detected_because: "",
      inferred_fields: [],
      children: [],
      surface: null,
    };
  });
  const edges: ArchitectureEdge[] = visual.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    type: "data_flow",
    description: edge.label || null,
    provenance: edge.provenance === "inferred" ? "inferred" : "static",
    evidence: [],
    confidence: 0.7,
  }));
  return {
    schema_version: 3,
    nodes,
    edges,
    entry_points: [],
    important_files: [],
    interaction_surfaces: [],
    summary: null,
    summary_provenance: "inferred",
    primary_flows: [],
    default_view: "data_flow",
    completeness: "complete",
    gaps: [],
    generated_by: "super_enriched",
    dropped: {},
  };
}

export type DiagramBox = { id: string; label: string; caption: string; layer: number; column: number };

/** Boxes in top-to-bottom layers, from the shared layered layout. */
export function diagramLayers(graph: ArchitectureGraph): DiagramBox[] {
  const placements = layout(graph);
  return graph.nodes.map((node) => {
    const place = placements.get(node.id)!;
    return {
      id: node.id,
      label: node.label,
      caption: node.technology ?? CATEGORY_LABEL[node.category],
      layer: place.rank,
      column: place.row,
    };
  });
}
