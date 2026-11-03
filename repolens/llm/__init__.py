"""Model router and provider adapters for Muse inference.

All model access in RepoLens passes through :class:`ModelRouter`. Callers choose a
logical tier -- :meth:`~ModelRouter.nano`, :meth:`~ModelRouter.super`,
:meth:`~ModelRouter.ultra` -- and never a model ID.
"""

from __future__ import annotations

from repolens.interfaces import LLMProvider
from repolens.llm.errors import (
    EmptyResponseError,
    LLMError,
    LLMTimeoutError,
    LLMTransportError,
    ModelNotConfiguredError,
    SchemaValidationError,
)
from repolens.llm.response import MessageShape, extract_text, inspect_message
from repolens.llm.router import Completion, ModelRouter
from repolens.llm.telemetry import CallRecord, ModelPrice, ModelPricing
from repolens.llm.tiers import ModelTier, Purpose

__all__ = [
    "CallRecord",
    "Completion",
    "EmptyResponseError",
    "LLMError",
    "LLMProvider",
    "LLMTimeoutError",
    "LLMTransportError",
    "MessageShape",
    "ModelNotConfiguredError",
    "ModelPrice",
    "ModelPricing",
    "ModelRouter",
    "ModelTier",
    "Purpose",
    "SchemaValidationError",
    "build_router",
    "extract_text",
    "inspect_message",
]


def build_router(
    settings: object | None = None,
    provider: LLMProvider | None = None,
    *,
    telemetry: object | None = None,
) -> ModelRouter:
    """Construct a :class:`ModelRouter` from settings.

    Both collaborators are injectable so tests and agents can supply a fake
    provider without touching the network.

    *telemetry* is where call records go besides the log -- in practice
    :class:`~repolens.analytics.model_telemetry.DbModelTelemetry`. Left out, the
    router only logs them, which is what every offline test wants.

    Raises:
        ValueError: if no provider is given and no API key is configured.
    """
    from repolens.config import Settings, get_settings

    resolved: Settings = settings if isinstance(settings, Settings) else get_settings()

    if provider is None:
        if resolved.muse_api_key is None:
            raise ValueError("MUSE_API_KEY is not set; pass a provider explicitly")
        from repolens.llm.muse import MuseLLMProvider

        provider = MuseLLMProvider(
            api_key=resolved.muse_api_key.get_secret_value(),
            base_url=resolved.muse_base_url,
            timeout=resolved.llm_timeout_seconds,
        )

    return ModelRouter(
        provider,
        {
            ModelTier.NANO: resolved.model_nano,
            ModelTier.SUPER: resolved.model_super,
            ModelTier.ULTRA: resolved.model_ultra,
        },
        pricing=ModelPricing.from_json(resolved.model_pricing),
        telemetry=telemetry,  # type: ignore[arg-type]
        timeout_seconds=resolved.llm_timeout_seconds,
    )
