"""Building the architecture. See :mod:`repolens.architecture` for the layers."""

from __future__ import annotations

from repolens.architecture.analyzers.adapters import (
    SparkAdapter,
    WebFrameworkAdapter,
    WorkflowAdapter,
)
from repolens.architecture.analyzers.base import AnalysisContext, ArchitectureAnalyzer
from repolens.architecture.analyzers.cli import CliAnalyzer
from repolens.architecture.analyzers.data import DataPipelineAnalyzer
from repolens.architecture.analyzers.entrypoints import EntryPointAnalyzer
from repolens.architecture.analyzers.http import HttpAnalyzer
from repolens.architecture.analyzers.library import ConfigurationAnalyzer, LibraryAnalyzer
from repolens.architecture.analyzers.services import ServiceAnalyzer
from repolens.architecture.analyzers.storage import StorageAnalyzer
from repolens.architecture.analyzers.workflow import WorkflowAnalyzer
from repolens.architecture.assemble import assemble, fit
from repolens.architecture.code_model import Corpus, build_code_model, reading_path
from repolens.architecture.models import ArchitectureGraph
from repolens.architecture.modules import module_dependencies
from repolens.architecture.runtime_synthesis import name_runtime
from repolens.architecture.source import SourceIndex
from repolens.architecture.subsystems import discover_subsystems, rank
from repolens.architecture.synthesis import SynthesisRouter, synthesise
from repolens.architecture.understanding import orient, readme_path
from repolens.architecture.validate import validate
from repolens.architecture.verify import verify_graph
from repolens.evidence.models import DocumentationReference
from repolens.ingest.detectors import DetectionContext, DetectionOutcome
from repolens.ingest.priority import prioritized
from repolens.manifest.models import RepoManifest
from repolens.sources import CloneSnapshot

#: Generic analyzers, in order. Library runs last: it only describes a
#: repository nothing more specific matched.
GENERIC_ANALYZERS: tuple[ArchitectureAnalyzer, ...] = (
    EntryPointAnalyzer(),
    HttpAnalyzer(),
    CliAnalyzer(),
    DataPipelineAnalyzer(),
    WorkflowAnalyzer(),
    ServiceAnalyzer(),
    StorageAnalyzer(),
    ConfigurationAnalyzer(),
    LibraryAnalyzer(),
)

#: Framework adapters. Enrichment only.
ADAPTERS: tuple[ArchitectureAnalyzer, ...] = (
    SparkAdapter(),
    WebFrameworkAdapter(),
    WorkflowAdapter(),
)


def build_static_architecture(
    context: DetectionContext,
    outcome: DetectionOutcome,
    manifest: RepoManifest | None,
    *,
    index: SourceIndex | None = None,
    adapters: tuple[ArchitectureAnalyzer, ...] = ADAPTERS,
) -> tuple[ArchitectureGraph, SourceIndex]:
    """The deterministic architecture, before any model is consulted."""
    index = index if index is not None else SourceIndex.build(context)
    graph = ArchitectureGraph(subsystems=discover_subsystems(index))
    analysis = AnalysisContext(index=index, outcome=outcome, manifest=manifest, graph=graph)
    for analyzer in (*GENERIC_ANALYZERS, *adapters):
        analyzer.analyze(analysis)
    graph = validate(assemble(analysis), index)
    rank(graph, index, manifest)
    fit(graph)  # folding small subsystems together can overfill "Other modules"
    return graph, index


async def build_architecture(
    context: DetectionContext,
    outcome: DetectionOutcome,
    manifest: RepoManifest | None,
    *,
    router: SynthesisRouter | None = None,
    summaries: dict[str, str] | None = None,
    docs: list[DocumentationReference] | None = None,
) -> ArchitectureGraph:
    """The full architecture, from components up to "what is this repository?".

    Static analysis and subsystems first; Super refines the components, then
    orients a newcomer (levels 0 and 1); validation runs after each model pass.
    *summaries* are optional one-line file purposes (Nano's) and *docs* official
    documentation the investigation retrieved -- context for Super, and *docs*
    may be cited, but neither is treated as repository evidence on its own.
    """
    graph, index = build_static_architecture(context, outcome, manifest)
    graph = validate(await synthesise(graph, index, router, summaries=summaries), index)
    rank(graph, index, manifest)
    graph = await orient(graph, index, manifest, router, docs=docs)
    graph = validate(graph, index)
    return await runtime_architecture(graph, context, index, router)


async def runtime_architecture(
    graph: ArchitectureGraph,
    context: DetectionContext,
    index: SourceIndex,
    router: SynthesisRouter | None,
) -> ArchitectureGraph:
    """The machinery under the surfaces: key types, how they use each other,
    runtime components, flows, module dependencies -- and every reference in
    the graph checked against the snapshot. See :mod:`repolens.architecture.code_model`."""
    paths = [entry.path for entry in prioritized(context.tree.files)]
    snapshot = CloneSnapshot(root=context.root, commit_sha=index.commit_sha, paths=set(paths))
    corpus = Corpus.read(context.root, index.commit_sha, paths)
    readme = (index.text(found) or "") if (found := readme_path(index)) else ""
    graph = build_code_model(graph, corpus, readme=readme)
    module_dependencies(graph, snapshot, paths)
    graph = await name_runtime(graph, router)
    graph = verify_graph(graph, snapshot)
    # Ordered after verification, which is what makes a reference eligible.
    graph.reading_path = reading_path(graph)
    return graph
