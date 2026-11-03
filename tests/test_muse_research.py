"""The Muse research provider: citations in, evidence out.

The provider talks to the Meta Responses API, so every test here swaps the HTTP
client for a recording fake. Nothing touches the network.
"""

from __future__ import annotations

from typing import Any

import pytest

import repolens.research.muse as muse_module
from repolens.research.muse import (
    DEFAULT_TIMEOUT_SECONDS,
    InvalidAPIKeyError,
    MuseResearchError,
    MuseResearchProvider,
)


def payload(*citations: tuple[str, str | None], text: str = "the grounded answer") -> dict:
    return {
        "output": [
            {
                "type": "message",
                "content": [
                    {
                        "type": "output_text",
                        "text": text,
                        "annotations": [
                            {"type": "url_citation", "url": url, "title": title}
                            for url, title in citations
                        ],
                    }
                ],
            }
        ]
    }


class FakeResponse:
    def __init__(
        self,
        body: Any,
        *,
        status_code: int = 200,
        broken_json: bool = False,
    ) -> None:
        self._body = body
        self.status_code = status_code
        self._broken_json = broken_json

    def json(self) -> Any:
        if self._broken_json:
            raise ValueError("not json")
        return self._body


def install(
    monkeypatch: pytest.MonkeyPatch,
    response: FakeResponse | Exception,
    recorded: dict[str, Any],
) -> None:
    class Client:
        def __init__(self, *args: object, **kwargs: object) -> None:
            recorded["client_kwargs"] = kwargs

        async def __aenter__(self) -> Client:
            return self

        async def __aexit__(self, *exc: object) -> bool:
            return False

        async def post(self, url: object, **kwargs: object) -> FakeResponse:
            recorded["url"] = url
            recorded["request"] = kwargs.get("json")
            if isinstance(response, Exception):
                raise response
            return response

    monkeypatch.setattr(muse_module.httpx, "AsyncClient", Client)


class TestSearch:
    async def test_citations_become_result_items(self, monkeypatch: pytest.MonkeyPatch) -> None:
        recorded: dict[str, Any] = {}
        install(
            monkeypatch,
            FakeResponse(
                payload(
                    ("https://spark.apache.org/docs/latest/", "Spark docs"),
                    ("https://spark.apache.org/docs/latest/tuning.html", None),
                )
            ),
            recorded,
        )

        items = await MuseResearchProvider(api_key="test-key").search(
            "shuffle partitions", include_domains=["spark.apache.org"]
        )

        assert [item.url for item in items] == [
            "https://spark.apache.org/docs/latest/",
            "https://spark.apache.org/docs/latest/tuning.html",
        ]
        assert items[0].title == "Spark docs"
        assert items[1].title is None
        assert all(item.content == "the grounded answer" for item in items)

    async def test_results_are_capped_at_max_results(self, monkeypatch: pytest.MonkeyPatch) -> None:
        recorded: dict[str, Any] = {}
        install(
            monkeypatch,
            FakeResponse(
                payload(
                    ("https://spark.apache.org/a", None),
                    ("https://spark.apache.org/b", None),
                    ("https://spark.apache.org/c", None),
                )
            ),
            recorded,
        )

        items = await MuseResearchProvider(api_key="test-key").search("x", max_results=2)

        assert len(items) == 2

    async def test_the_web_search_tool_is_requested(self, monkeypatch: pytest.MonkeyPatch) -> None:
        recorded: dict[str, Any] = {}
        install(monkeypatch, FakeResponse(payload()), recorded)

        await MuseResearchProvider(api_key="test-key").search("x")

        request = recorded["request"]
        assert isinstance(request, dict)
        assert request["tools"] == [{"type": "web_search"}]
        assert str(recorded["url"]).endswith("/responses")

    async def test_domains_scope_the_query(self, monkeypatch: pytest.MonkeyPatch) -> None:
        recorded: dict[str, Any] = {}
        install(monkeypatch, FakeResponse(payload()), recorded)

        await MuseResearchProvider(api_key="test-key").search(
            "shuffle", include_domains=["spark.apache.org"]
        )

        request = recorded["request"]
        assert isinstance(request, dict)
        assert "spark.apache.org" in request["input"]
        assert "shuffle" in request["input"]

    async def test_on_domain_hits_win_but_off_domain_is_kept(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        recorded: dict[str, Any] = {}
        install(
            monkeypatch,
            FakeResponse(
                payload(
                    ("https://spark.apache.org/on", None),
                    ("https://elsewhere.example/off", None),
                )
            ),
            recorded,
        )
        provider = MuseResearchProvider(api_key="test-key")

        preferred = await provider.search("x", include_domains=["spark.apache.org"])
        assert [item.url for item in preferred] == ["https://spark.apache.org/on"]

        kept = await provider.search("x", include_domains=["kafka.apache.org"])
        assert [item.url for item in kept] == [
            "https://spark.apache.org/on",
            "https://elsewhere.example/off",
        ]

    async def test_no_citations_is_no_results(self, monkeypatch: pytest.MonkeyPatch) -> None:
        recorded: dict[str, Any] = {}
        install(monkeypatch, FakeResponse({"output": []}), recorded)

        items = await MuseResearchProvider(api_key="test-key").search("x")

        assert items == []


class TestFailures:
    async def test_rejected_credentials_raise_invalid_api_key(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        recorded: dict[str, Any] = {}
        install(monkeypatch, FakeResponse({}, status_code=401), recorded)

        with pytest.raises(InvalidAPIKeyError):
            await MuseResearchProvider(api_key="bad-key").search("x")

    async def test_a_server_error_is_a_research_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        recorded: dict[str, Any] = {}
        install(monkeypatch, FakeResponse({}, status_code=500), recorded)

        with pytest.raises(MuseResearchError):
            await MuseResearchProvider(api_key="test-key").search("x")

    async def test_an_unparseable_body_is_a_research_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        recorded: dict[str, Any] = {}
        install(monkeypatch, FakeResponse({}, broken_json=True), recorded)

        with pytest.raises(MuseResearchError):
            await MuseResearchProvider(api_key="test-key").search("x")

    async def test_a_timeout_is_a_research_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import httpx

        recorded: dict[str, Any] = {}
        install(
            monkeypatch,
            httpx.TimeoutException("timed out"),
            recorded,
        )

        with pytest.raises(MuseResearchError, match="timed out"):
            await MuseResearchProvider(api_key="test-key").search("x")

    def test_the_deadline_is_shorter_than_a_persons_patience(self) -> None:
        assert DEFAULT_TIMEOUT_SECONDS <= 30
