"""Isolated execution environments.

User code runs only inside a provider-managed environment, never on the API host.
Callers depend on :class:`ExecutionEnvironment` so nothing above this layer needs
to know whether work happens in a sandbox or on a VM.
"""

from __future__ import annotations

from repolens.sandbox.docker_provider import DockerSandboxProvider
from repolens.sandbox.environment import (
    EnvironmentNotStartedError,
    ExecutionEnvironment,
    SandboxEnvironment,
)
from repolens.sandbox.fake import FakeSandboxProvider, ScriptedCommand
from repolens.sandbox.models import (
    Checkpoint,
    SandboxCapabilities,
    SandboxError,
    SandboxHandle,
    UnsupportedOperationError,
)
from repolens.sandbox.provider import SandboxProvider

__all__ = [
    "Checkpoint",
    "DockerSandboxProvider",
    "EnvironmentNotStartedError",
    "ExecutionEnvironment",
    "FakeSandboxProvider",
    "SandboxCapabilities",
    "SandboxEnvironment",
    "SandboxError",
    "SandboxHandle",
    "SandboxProvider",
    "ScriptedCommand",
    "UnsupportedOperationError",
]
