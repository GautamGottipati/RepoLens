import { describe, expect, it } from "vitest";

import { askUrl, cameraFor, conceptGraph, flowWalkthroughs, focusFor, fullView, layout, sourceUrl } from "../architecture";
import type { ArchitectureGraph, Walkthrough } from "../types";
import { pipelineView } from "@/components/__tests__/fixtures";

describe("layout", () => {
  it("places each step one column after the step that feeds it", () => {
    const placements = layout(pipelineView().graph);
    const rank = (id: string) => placements.get(id)!.rank;
    expect(rank("entry:job")).toBeLessThan(rank("pipeline:job"));
    expect(rank("step:read")).toBeLessThan(rank("step:join"));
    expect(rank("step:join")).toBeLessThan(rank("step:write"));
  });

  it("puts stores at the far right", () => {
    const placements = layout(pipelineView().graph);
    const max = Math.max(...[...placements.values()].map((p) => p.rank));
    expect(placements.get("store:s3")!.rank).toBe(max);
  });

  it("survives a cycle", () => {
    const view = pipelineView();
    view.graph.edges.push({
      source: "step:write",
      target: "step:read",
      type: "data_flow",
      description: null,
      provenance: "static",
      evidence: [],
      confidence: 0.5,
    });
    expect(layout(view.graph).size).toBe(view.graph.nodes.length);
  });
});

describe("links and context", () => {
  it("only links to GitHub, at the commit", () => {
    const ref = { path: "a/b.py", start_line: 3, end_line: 3, commit_sha: null, excerpt: null };
    expect(sourceUrl("https://github.com/o/r", "abc", ref)).toBe("https://github.com/o/r/blob/abc/a/b.py#L3");
    expect(sourceUrl("https://gitlab.com/o/r", "abc", ref)).toBeNull();
  });

  it("sends a bounded description of the component to Ask", () => {
    const focus = focusFor(pipelineView().graph, "step:join")!;
    expect(focus.label).toBe("Join Customers");
    expect(focus.source_references[0].path).toBe("jobs/job.py");
    expect(focus.relationships).toContain("Read Orders data flow Join Customers");
    expect(focusFor(pipelineView().graph, "missing")).toBeNull();
  });

  it("encodes the question in the Ask URL", () => {
    expect(askUrl("j", "n:1", "Why & how?")).toBe("/r/j/ask?node=n%3A1&q=Why+%26+how%3F");
  });
});

describe("cameraFor", () => {
  const dims = { boxWidth: 170, boxHeight: 48, columnGap: 64, rowGap: 18 };
  const canvasOf = (placements: Map<string, { rank: number; row: number }>) => {
    const columns = Math.max(1, ...[...placements.values()].map((p) => p.rank + 1));
    const rows = Math.max(1, ...[...placements.values()].map((p) => p.row + 1));
    return { width: columns * dims.boxWidth + (columns - 1) * dims.columnGap, height: rows * dims.boxHeight + (rows - 1) * dims.rowGap };
  };
  const canvas = { width: 1000, height: 500 };

  it("returns null when nothing requested is placed, meaning the full canvas", () => {
    const placements = layout(pipelineView().graph);
    expect(cameraFor(placements, [], dims, canvas)).toBeNull();
    expect(cameraFor(placements, ["missing"], dims, canvas)).toBeNull();
    expect(fullView(canvas)).toEqual({ x: -8, y: -8, w: 1016, h: 516 });
  });

  it("frames one node with padding on every side", () => {
    const placements = layout(pipelineView().graph);
    const view = cameraFor(placements, ["step:join"], dims, canvas)!;
    const at = placements.get("step:join")!;
    const x = at.rank * (dims.boxWidth + dims.columnGap);
    const y = at.row * (dims.boxHeight + dims.rowGap);
    expect(view.x).toBeLessThanOrEqual(x);
    expect(view.y).toBeLessThanOrEqual(y);
    expect(view.x + view.w).toBeGreaterThanOrEqual(x + dims.boxWidth);
    expect(view.y + view.h).toBeGreaterThanOrEqual(y + dims.boxHeight);
    expect(view.w).toBeLessThan(canvas.width);
  });

  it("frames a cluster spanning columns and ignores unknown ids", () => {
    const placements = layout(pipelineView().graph);
    const view = cameraFor(placements, ["entry:job", "missing", "step:write"], dims, canvasOf(placements))!;
    const left = placements.get("entry:job")!.rank * (dims.boxWidth + dims.columnGap);
    const rightNode = placements.get("step:write")!;
    const right = rightNode.rank * (dims.boxWidth + dims.columnGap) + dims.boxWidth;
    expect(view.x).toBeLessThanOrEqual(left);
    expect(view.x + view.w).toBeGreaterThanOrEqual(right);
  });

  it("clamps to the canvas instead of running past its edges", () => {
    const placements = layout(pipelineView().graph);
    const view = cameraFor(placements, ["entry:job"], dims, canvas, 10000)!;
    expect(view.x).toBe(-8);
    expect(view.y).toBe(-8);
    expect(view.x + view.w).toBeLessThanOrEqual(canvas.width + 8);
    expect(view.y + view.h).toBeLessThanOrEqual(canvas.height + 8);
  });
});

describe("conceptGraph", () => {
  it("keeps file-backed link evidence as citations, drops url-only evidence", () => {
    const edges = conceptGraph(guidedViewForLinks().graph).edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].evidence.map((e) => e.path)).toEqual(["core/sched.py"]);
  });

  function guidedViewForLinks() {
    const view = pipelineView();
    view.graph.system_model = {
      concepts: [],
      links: [
        {
          source: "a",
          target: "b",
          type: "calls",
          description: null,
          provenance: "static",
          evidence: [
            { kind: "source", label: "sched", path: "core/sched.py", line: 12, url: null, target_id: null, excerpt: null },
            { kind: "documentation", label: "docs", path: null, line: null, url: "https://example.com", target_id: null, excerpt: null },
          ],
        },
      ],
      provenance: "static",
    };
    return view;
  }
});

describe("flowWalkthroughs", () => {
  const walk = (id: string, level: string, subsystem: string | null = null) =>
    ({ id, level, subsystem, name: id, kind: "call", steps: [], description: "", provenance: "static" }) as unknown as Walkthrough;

  it("lists each walkthrough once: overview first, then those inside a part", () => {
    // walk:0 belongs to no part and is not the system walk, so it is in both sets.
    const graph = {
      walkthroughs: [walk("walk:system", "system"), walk("walk:0", "component"), walk("walk:1", "component", "sql")],
    } as unknown as ArchitectureGraph;
    expect(flowWalkthroughs(graph).map((w) => w.id)).toEqual(["walk:system", "walk:0", "walk:1"]);
  });
});
