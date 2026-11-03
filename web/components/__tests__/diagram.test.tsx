/**
 * The answer diagram as an interactive module: boxes and arrows select,
 * selections explain themselves, and grounded boxes link to the analysis.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnswerDiagram } from "../diagram/answer-diagram";
import { answerGraph } from "../diagram/layout";
import type { ArchitectureGraph, GroundedAnswer } from "@/lib/types";

afterEach(cleanup);

const visual = {
  nodes: [
    { id: "server", label: "Web server", kind: "server", component_id: "service:server", source: "backend/app.js" },
    { id: "orders", label: "Orders API", kind: "route", component_id: "api:orders", source: null },
    { id: "ghost", label: "Elsewhere", kind: "", component_id: "missing:thing", source: null },
  ],
  edges: [
    { source: "server", target: "orders", label: "routes requests", support: "backend/routes/orders.js:2", provenance: "static" },
    { source: "orders", target: "ghost", label: "maybe calls", support: "inferred", provenance: "inferred" },
  ],
};

const architecture = {
  nodes: [{ id: "service:server" }, { id: "api:orders" }],
} as unknown as ArchitectureGraph;

function node(id: string): Element {
  const found = screen.getByTestId("answer-visual").querySelector(`[data-node-id="${id}"]`);
  if (!found) throw new Error(`missing diagram node ${id}`);
  return found;
}

function renderDiagram(props: { jobId?: string | null; architecture?: ArchitectureGraph | null } = {}) {
  const answer = { visual } as unknown as GroundedAnswer;
  const jobId = "jobId" in props ? props.jobId : "job-1";
  const arch = "architecture" in props ? props.architecture : architecture;
  const graph = answerGraph(answer, arch ?? null)!;
  const onOpen = vi.fn();
  render(
    <AnswerDiagram answer={answer} graph={graph} jobId={jobId} architecture={arch} onOpen={onOpen} />,
  );
  return onOpen;
}

describe("diagram selection", () => {
  it("selects a box and offers what the answer kept for it", () => {
    const onOpen = renderDiagram();
    fireEvent.click(node("server"));
    const detail = screen.getByTestId("diagram-detail");
    expect(detail.textContent).toContain("Web server");
    fireEvent.click(within(detail).getByTestId("diagram-open-code"));
    expect(onOpen).toHaveBeenCalledWith("backend/app.js", "Web server");
  });

  it("toggles closed when the selected box is clicked again", () => {
    renderDiagram();
    const box = node("server");
    fireEvent.click(box);
    expect(screen.queryByTestId("diagram-detail")).toBeTruthy();
    fireEvent.click(box);
    expect(screen.queryByTestId("diagram-detail")).toBeNull();
  });

  it("selects with the keyboard", () => {
    renderDiagram();
    const box = node("orders");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByTestId("diagram-detail").textContent).toContain("Orders API");
  });

  it("selects an arrow and explains the relationship", () => {
    const onOpen = renderDiagram();
    fireEvent.click(screen.getByRole("button", { name: "Web server to Orders API: routes requests" }));
    const detail = screen.getByTestId("diagram-detail");
    expect(detail.textContent).toContain("Web server → Orders API");
    expect(detail.textContent).toContain("routes requests");
    fireEvent.click(within(detail).getByTestId("diagram-open-code"));
    expect(onOpen).toHaveBeenCalledWith("backend/routes/orders.js:2", "Web server → Orders API");
  });

  it("says plainly when a relationship was inferred", () => {
    renderDiagram();
    fireEvent.click(screen.getByRole("button", { name: "Orders API to Elsewhere: maybe calls" }));
    expect(screen.getByTestId("diagram-detail").textContent).toContain("Inferred from the surrounding evidence");
  });
});

describe("architecture grounding", () => {
  it("links a grounded box to the component in the Architecture tab", () => {
    renderDiagram();
    fireEvent.click(node("server"));
    const link = within(screen.getByTestId("diagram-detail")).getByTestId("diagram-open-architecture");
    expect(link.getAttribute("href")).toBe("/r/job-1/architecture?node=service%3Aserver");
  });

  it("hides the link when the component is unknown or no job scopes it", () => {
    renderDiagram();
    fireEvent.click(node("ghost"));
    expect(within(screen.getByTestId("diagram-detail")).queryByTestId("diagram-open-architecture")).toBeNull();

    cleanup();
    renderDiagram({ jobId: null });
    fireEvent.click(node("server"));
    expect(within(screen.getByTestId("diagram-detail")).queryByTestId("diagram-open-architecture")).toBeNull();
  });
});
