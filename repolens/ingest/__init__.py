"""Repository ingestion.

Static inspection only: a repository is cloned shallowly and read, never
executed. See :mod:`repolens.ingest.pipeline` for the end-to-end flow.
"""

from __future__ import annotations

from repolens.ingest.clone import CloneError, CloneResult, TemporaryClone, shallow_clone
from repolens.ingest.limits import DEFAULT_LIMITS, IngestLimits, LimitReport
from repolens.ingest.pipeline import (
    IngestionResult,
    ingest_clone,
    ingest_repository,
    summarize,
)
from repolens.ingest.tree import FileTree, build_file_tree
from repolens.ingest.url import InvalidRepoUrlError, RepoUrl, validate_repo_url

__all__ = [
    "DEFAULT_LIMITS",
    "CloneError",
    "CloneResult",
    "FileTree",
    "IngestLimits",
    "IngestionResult",
    "InvalidRepoUrlError",
    "LimitReport",
    "RepoUrl",
    "TemporaryClone",
    "build_file_tree",
    "ingest_clone",
    "ingest_repository",
    "shallow_clone",
    "summarize",
    "validate_repo_url",
]
