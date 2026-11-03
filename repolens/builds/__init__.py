"""Build resolution: the fidelity fallback ladder.

Turns a repository commit into a ready, checkpointed environment, trying each
rung in turn and serving the best one that passed:

    exact cache -> exact source build -> official release -> partial build -> Mini Lab

Two rules hold at every rung. **A build is ready only after its smoke test
passes**, and **fidelity is derived from what was actually produced**, never
asserted by a caller.
"""

from __future__ import annotations

from repolens.builds.cache import (
    BuildCache,
    DbBuildCache,
    InMemoryBuildCache,
    NullBuildCache,
    best,
)
from repolens.builds.candidates import (
    BuildCandidate,
    NoCandidatesError,
    candidates_for,
    is_cassandra,
    needs_submodules,
)
from repolens.builds.cassandra import (
    cassandra_official_plan,
    cassandra_partial_plan,
    cassandra_source_plan,
)
from repolens.builds.diagnosis import (
    BuildLimits,
    Diagnosis,
    FailureSummary,
    describe_failure,
    diagnose,
    summarise,
)
from repolens.builds.ladder import BuildLadder, CandidateOutcome, LadderResult
from repolens.builds.minilab import MiniLab, MiniLabEntry, MiniLabResponse
from repolens.builds.minilab_build import build_mini_lab
from repolens.builds.models import (
    FIDELITY_ORDER,
    BuildArtifact,
    BuildAttempt,
    BuildCapabilities,
    BuildError,
    BuildRequest,
    BuildSource,
    BuildStatus,
    BuildUnavailableError,
    SmokeTestResult,
    StepOutcome,
    fidelity_for,
    fidelity_rank,
)
from repolens.builds.plan import (
    BuildPlan,
    BuildStep,
    SmokeTest,
    UnsupportedRepositoryError,
    plan_for,
)
from repolens.builds.resolver import BuildResolver, archive_repository
from repolens.builds.session import EnvironmentSession, UpgradeOffer, UpgradeRefused
from repolens.builds.spark import spark_plan

__all__ = [
    "FIDELITY_ORDER",
    "BuildArtifact",
    "BuildAttempt",
    "BuildCache",
    "BuildCandidate",
    "BuildCapabilities",
    "BuildError",
    "BuildLadder",
    "BuildLimits",
    "BuildPlan",
    "BuildRequest",
    "BuildResolver",
    "BuildSource",
    "BuildStatus",
    "BuildStep",
    "BuildUnavailableError",
    "CandidateOutcome",
    "DbBuildCache",
    "Diagnosis",
    "EnvironmentSession",
    "FailureSummary",
    "InMemoryBuildCache",
    "LadderResult",
    "MiniLab",
    "MiniLabEntry",
    "MiniLabResponse",
    "NoCandidatesError",
    "NullBuildCache",
    "SmokeTest",
    "SmokeTestResult",
    "StepOutcome",
    "UnsupportedRepositoryError",
    "UpgradeOffer",
    "UpgradeRefused",
    "archive_repository",
    "best",
    "build_mini_lab",
    "candidates_for",
    "cassandra_official_plan",
    "cassandra_partial_plan",
    "cassandra_source_plan",
    "describe_failure",
    "diagnose",
    "fidelity_for",
    "fidelity_rank",
    "is_cassandra",
    "needs_submodules",
    "plan_for",
    "spark_plan",
    "summarise",
]
