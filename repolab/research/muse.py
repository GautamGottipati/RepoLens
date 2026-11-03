"""External documentation research via Muse's built-in web search.

The Meta Model API serves Muse Spark over an OpenAI-compatible Responses API
that carries a server-side ``web_search`` tool:

  endpoint  POST https://api.meta.ai/v1/responses
  auth      MUSE_API_KEY as a Bearer [REDACTED]
  grounding ``tools=[{"type": "web_search"}]`` grounds the answer in real-time
            web results with inline URL citations
  results   each ``url_citation`` annotation carries ``url`` and ``title``;
            the answer text itself is the snippet content

Repository code remains RepoLab's primary evidence; research supplements it with
version-matched official documentation.
"""

from __future__ import annotations

from typing import Any

import httpx

from repolab.interfaces import SearchResultItem

#: Seconds before a research call is abandoned.
#:
#: Research supplements repository evidence and never gates it, so the right
#: deadline is "shorter than a person's patience": an investigation that waits a
#: minute for a documentation page it will cite in passing has already cost more
#: than the citation is worth.
DEFAULT_TIMEOUT_SECONDS = 20.0

#: Meta Model API base URL when the caller does not pass one explicitly.
DEFAULT_BASE_URL = "https://api.meta.ai/v1"

#: Muse model answering research queries. Documentation lookup is Super-tier
#: work; callers that need another model pass ``model=...`` explicitly.
DEFAULT_RESEARCH_MODEL = "muse-spark-1.2"

#: Longest snippet kept per hit. The grounded answer text backs every citation,
#: and callers excerpt further for their own display.
MAX_SNIPPET_CHARS = 2000


class MuseResearchError(RuntimeError):
    """The Muse research service did not answer usably."""


class InvalidAPIKeyError(MuseResearchError):
    """The Muse research service rejected our credentials."""


def _on_domain(url: str, domains: list[str]) -> bool:
    return any(domain in url for domain in domains)


def _citations_from_response(payload: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    """Pull the answer text and its URL citations out of a Responses payload.

    The wire shape follows the OpenAI-compatible Responses API: ``output`` is a
    list of items, ``message`` items carry ``content`` parts, and ``output_text``
    parts carry ``annotations`` with ``url_citation`` entries. Anything missing
    simply yields less, never an exception: an unusable payload is an empty
    result, reported by the caller as a failed probe rather than a crash.
    """
    texts: list[str] = []
    citations: list[dict[str, Any]] = []
    output = payload.get("output")
    if not isinstance(output, list):
        return "", []
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for part in content:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text)
            annotations = part.get("annotations")
            if not isinstance(annotations, list):
                continue
            for annotation in annotations:
                if not isinstance(annotation, dict):
                    continue
                url = annotation.get("url")
                if not url:
                    continue
                citations.append(
                    {"url": url, "title": annotation.get("title")},
                )
    return "\n\n".join(texts), citations


class MuseResearchProvider:
    """:class:`~repolab.interfaces.ResearchProvider` backed by Muse web search."""

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        model: str = DEFAULT_RESEARCH_MODEL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout

    async def search(
        self,
        query: str,
        *,
        include_domains: list[str] | None = None,
        max_results: int = 5,
    ) -> list[SearchResultItem]:
        domains = [d for d in (include_domains or []) if d]
        if domains:
            scoped = (
                f"Find official documentation about: {query}\n"
                f"Only cite pages from these domains: {', '.join(domains)}."
            )
        else:
            scoped = f"Find official documentation about: {query}"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    f"{self._base_url}/responses",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self._model,
                        "input": scoped,
                        "tools": [{"type": "web_search"}],
                    },
                )
        except httpx.TimeoutException as exc:
            raise MuseResearchError(f"research timed out after {self._timeout:g}s") from exc
        except httpx.HTTPError as exc:
            raise MuseResearchError(f"research request failed: {exc}") from exc

        if response.status_code in (401, 403):
            raise InvalidAPIKeyError("MUSE_API_KEY was rejected by the research service")
        if response.status_code >= 400:
            raise MuseResearchError(f"research service returned HTTP {response.status_code}")

        try:
            payload = response.json()
        except ValueError as exc:
            raise MuseResearchError("research service returned an unparseable response") from exc
        if not isinstance(payload, dict):
            raise MuseResearchError("research service returned an unparseable response")

        text, citations = _citations_from_response(payload)
        snippet = text[:MAX_SNIPPET_CHARS] if text.strip() else None

        items = [
            SearchResultItem(url=c["url"], title=c["title"], content=snippet)
            for c in citations
            if c.get("url")
        ]
        if domains:
            # Prefer on-domain hits per the `include_domains` scoping, but
            # keep off-domain hits when nothing on-domain came back: the caller
            # sees the real URLs either way, and the capability probe reports
            # off-domain results as a warning rather than a failure.
            on_domain = [item for item in items if _on_domain(item.url, domains)]
            if on_domain:
                items = on_domain
        return items[:max_results]
