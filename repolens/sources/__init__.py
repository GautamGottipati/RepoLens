"""Source code as evidence: symbols, verified references, commit-pinned copies.

symbols    definitions and the lines they span, found deterministically
resolve    claim -> lines RepoLens computed and re-read itself
store      copies of cited files, per repository and commit
"""

from repolens.sources.resolve import Snapshot, parse_citation, strength_of, verify_reference
from repolens.sources.store import CloneSnapshot, MemorySnapshot, StoredSnapshot, capture, read
from repolens.sources.symbols import Symbol, SymbolIndex, scan

__all__ = [
    "CloneSnapshot",
    "MemorySnapshot",
    "Snapshot",
    "StoredSnapshot",
    "Symbol",
    "SymbolIndex",
    "capture",
    "parse_citation",
    "read",
    "scan",
    "strength_of",
    "verify_reference",
]
