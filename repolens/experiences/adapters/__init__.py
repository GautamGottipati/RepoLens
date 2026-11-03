"""Experience adapters: each turns repository evidence into things to do.

An adapter proposes experiences from what the investigation found, says how far
along each one is (detected, supported, runnable, running), and -- for the ones
RepoLens runs itself -- how to prepare a runtime and execute an action in it.
Registered in :data:`ADAPTERS`; adding a kind of experience means adding one.
"""

from repolens.experiences.adapters.base import Adapter, DiscoveryContext
from repolens.experiences.adapters.cli import CliAdapter
from repolens.experiences.adapters.library import LibraryAdapter
from repolens.experiences.adapters.live import LiveAppAdapter
from repolens.experiences.adapters.spark import SparkAdapter

#: In proposal order. Ranking, not this order, decides what is shown first.
ADAPTERS: tuple[Adapter, ...] = (SparkAdapter(), LiveAppAdapter(), CliAdapter(), LibraryAdapter())

__all__ = ["ADAPTERS", "Adapter", "DiscoveryContext"]
