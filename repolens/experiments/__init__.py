"""Controlled experiment design and execution.

    question -> investigate -> design -> validate -> APPROVE -> run -> measure
             -> compute statistics -> assemble evidence -> explain -> verify

The division of labour is the point. A model proposes and a model interprets;
deterministic code decides what may run, executes it, and computes every number.
Nothing executes before the user approves.
"""

from __future__ import annotations

from repolens.experiments.agent import ExperimentAgent
from repolens.experiments.evidence import build_evidence
from repolens.experiments.executor import (
    ApprovalRequiredError,
    EquivalenceViolation,
    SparkVariantRunner,
    VariantExecutor,
    VariantRunner,
    verify_equivalent_state,
)
from repolens.experiments.experiment import Experiment, IllegalTransitionError
from repolens.experiments.explanation import (
    Claim,
    ClaimKind,
    Explanation,
    ExplanationInput,
    UnsupportedClaim,
    VerifiedExplanation,
    build_explanation_input,
    default_notes,
    verify_explanation,
)
from repolens.experiments.investigation import ExperimentInvestigationPlanner
from repolens.experiments.models import (
    ExperimentPlan,
    ExperimentStatus,
    ProposedPlan,
    ReproducibilityRecord,
    ResourceProfile,
    VariantRun,
)
from repolens.experiments.statistics import (
    Aggregate,
    ComparisonPoint,
    ExperimentStatistics,
    MetricComparison,
    VariantStatistics,
    aggregate_samples,
    compute_statistics,
    relative_difference,
)
from repolens.experiments.validation import (
    ALLOWED_VARIABLES,
    REQUIRED_METRICS,
    ExperimentBudget,
    PlanRejected,
    ValidationResult,
    canonical_metric,
    canonical_variable,
    measurable_metrics,
    validate_plan,
    variable_in_question,
)

__all__ = [
    "ALLOWED_VARIABLES",
    "REQUIRED_METRICS",
    "Aggregate",
    "ApprovalRequiredError",
    "Claim",
    "ClaimKind",
    "ComparisonPoint",
    "EquivalenceViolation",
    "Experiment",
    "ExperimentAgent",
    "ExperimentBudget",
    "ExperimentInvestigationPlanner",
    "ExperimentPlan",
    "ExperimentStatistics",
    "ExperimentStatus",
    "Explanation",
    "ExplanationInput",
    "IllegalTransitionError",
    "MetricComparison",
    "PlanRejected",
    "ProposedPlan",
    "ReproducibilityRecord",
    "ResourceProfile",
    "SparkVariantRunner",
    "UnsupportedClaim",
    "ValidationResult",
    "VariantExecutor",
    "VariantRun",
    "VariantRunner",
    "VariantStatistics",
    "VerifiedExplanation",
    "aggregate_samples",
    "build_evidence",
    "build_explanation_input",
    "canonical_metric",
    "canonical_variable",
    "compute_statistics",
    "default_notes",
    "measurable_metrics",
    "relative_difference",
    "validate_plan",
    "variable_in_question",
    "verify_equivalent_state",
    "verify_explanation",
]
