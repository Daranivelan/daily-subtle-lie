"""Tests for the Daily Subtle Lie generator."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

# We need to set env vars before importing the generator module
import importlib.util
import os
import sys

os.environ.setdefault("CF_ACCOUNT_ID", "test_account")
os.environ.setdefault("CF_D1_ID", "test_db")
os.environ.setdefault("CF_API_TOKEN", "test_token")
os.environ.setdefault("GEMINI_API_KEY", "test_key")
os.environ.setdefault("GOOGLE_API_KEY", "test_key")
os.environ.setdefault("TYPESAFE_API_KEY", "test_key")

# Load generator/generator.py as module "generator" (avoid package __init__.py shadowing).
_gen_path = Path(__file__).resolve().parents[1] / "generator.py"
_spec = importlib.util.spec_from_file_location("generator", _gen_path)
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
sys.modules["generator"] = _mod
_spec.loader.exec_module(_mod)
Draft = _mod.Draft
fetch_source = _mod.fetch_source
check = _mod.check
build = _mod.build
d1 = _mod.d1
main = _mod.main

FIXTURES = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# Draft model tests
# ---------------------------------------------------------------------------


class TestDraft:
    def test_valid_draft(self):
        draft = Draft(
            sentences=["A", "B", "C", "D", "E"],
            replace_index=2,
            lie="X",
        )
        assert draft.replace_index == 2
        assert len(draft.sentences) == 5

    def test_valid_draft_max_sentences(self):
        draft = Draft(
            sentences=["A", "B", "C", "D", "E", "F", "G", "H"],
            replace_index=7,
            lie="X",
        )
        assert len(draft.sentences) == 8

    def test_replace_index_out_of_range(self):
        with pytest.raises(ValueError, match="replace_index.*out of range"):
            Draft(
                sentences=["A", "B", "C", "D", "E"],
                replace_index=5,
                lie="X",
            )

    def test_replace_index_way_out_of_range(self):
        with pytest.raises(ValueError):
            Draft(
                sentences=["A", "B", "C", "D", "E"],
                replace_index=100,
                lie="X",
            )

    def test_too_few_sentences(self):
        with pytest.raises(ValueError):
            Draft(
                sentences=["A", "B", "C"],
                replace_index=0,
                lie="X",
            )

    def test_too_many_sentences(self):
        with pytest.raises(ValueError):
            Draft(
                sentences=["A"] * 9,
                replace_index=0,
                lie="X",
            )

    def test_negative_replace_index(self):
        with pytest.raises(ValueError):
            Draft(
                sentences=["A", "B", "C", "D", "E"],
                replace_index=-1,
                lie="X",
            )

    def test_boundary_replace_index(self):
        """replace_index == len(sentences) - 1 should be valid."""
        draft = Draft(
            sentences=["A", "B", "C", "D", "E"],
            replace_index=4,
            lie="X",
        )
        assert draft.replace_index == 4


# ---------------------------------------------------------------------------
# fetch_source tests
# ---------------------------------------------------------------------------


class TestFetchSource:
    def test_success(self):
        fixture = json.loads((FIXTURES / "wiki_response.json").read_text())
        mock_response = MagicMock()
        mock_response.json.return_value = fixture
        mock_response.raise_for_status.return_value = None

        with patch("generator.httpx.get", return_value=mock_response):
            text, url = fetch_source("Photosynthesis")

        assert "Photosynthesis" in text
        assert "chlorophyll" in text.lower()
        assert url == "https://en.wikipedia.org/wiki/Photosynthesis"
        assert len(text) <= 6000

    def test_empty_page(self):
        fixture = json.loads((FIXTURES / "wiki_empty.json").read_text())
        mock_response = MagicMock()
        mock_response.json.return_value = fixture
        mock_response.raise_for_status.return_value = None

        with patch("generator.httpx.get", return_value=mock_response):
            text, url = fetch_source("Nonexistent Topic")

        assert text == ""
        assert "Nonexistent" in url

    def test_title_with_spaces(self):
        fixture = json.loads((FIXTURES / "wiki_response.json").read_text())
        mock_response = MagicMock()
        mock_response.json.return_value = fixture
        mock_response.raise_for_status.return_value = None

        with patch("generator.httpx.get", return_value=mock_response):
            _, url = fetch_source("Mount Everest")

        assert url == "https://en.wikipedia.org/wiki/Mount_Everest"

    @patch("generator.time.sleep")
    def test_retry_on_failure(self, mock_sleep):
        import httpx as _httpx

        mock_request = MagicMock()
        side_effects = [
            _httpx.RequestError("timeout", request=mock_request),
            MagicMock(
                json=MagicMock(
                    return_value=json.loads(
                        (FIXTURES / "wiki_response.json").read_text()
                    )
                ),
                raise_for_status=MagicMock(),
            ),
        ]

        with patch("generator.httpx.get", side_effect=side_effects):
            text, url = fetch_source("Photosynthesis")

        assert "Photosynthesis" in text
        assert mock_sleep.called


# ---------------------------------------------------------------------------
# d1 tests
# ---------------------------------------------------------------------------


class TestD1:
    def test_success(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "result": [{"results": [{"date": "2026-01-01", "topic": "Mars"}]}]
        }
        mock_response.raise_for_status.return_value = None

        with patch("generator.httpx.post", return_value=mock_response):
            results = d1("SELECT * FROM puzzles")

        assert len(results) == 1
        assert results[0]["topic"] == "Mars"

    @patch("generator.time.sleep")
    def test_retry_on_error(self, mock_sleep):
        import httpx as _httpx

        mock_request = MagicMock()
        mock_success = MagicMock()
        mock_success.json.return_value = {"result": [{"results": []}]}
        mock_success.raise_for_status.return_value = None

        with patch(
            "generator.httpx.post",
            side_effect=[
                _httpx.RequestError("connection error", request=mock_request),
                mock_success,
            ],
        ):
            results = d1("SELECT 1")

        assert results == []
        assert mock_sleep.called


# ---------------------------------------------------------------------------
# check tests
# ---------------------------------------------------------------------------


class TestCheck:
    def _make_draft(self):
        return Draft(
            sentences=[
                "Plants use sunlight for energy.",
                "Chlorophyll is green.",
                "Photosynthesis produces oxygen.",
                "It occurs in chloroplasts.",
                "CO2 is absorbed from the air.",
            ],
            replace_index=1,
            lie="Chlorophyll is red.",
        )

    def _mock_answers(self, sentence_nouls, lie_supported_noul, lie_contradicts_noul):
        """Build a mock Jev response with the given noul scores."""
        answers = {}
        for i, n in enumerate(sentence_nouls):
            mock_noul = MagicMock()
            mock_noul.noul = n
            answers[f"s{i}"] = mock_noul

        lie_sup = MagicMock()
        lie_sup.noul = lie_supported_noul
        answers["lie_supported"] = lie_sup

        lie_con = MagicMock()
        lie_con.noul = lie_contradicts_noul
        answers["lie_contradicts"] = lie_con

        mock_result = MagicMock()
        mock_result.answers = answers
        return mock_result

    def test_all_pass(self):
        draft = self._make_draft()
        mock_result = self._mock_answers(
            sentence_nouls=[0.9, 0.85, 0.95, 0.8, 0.9],
            lie_supported_noul=0.1,
            lie_contradicts_noul=0.9,
        )

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.system_one.return_value = mock_result

        with patch("generator.TypeSafeClient", return_value=mock_client):
            assert check(draft, "some source text") is True

    def test_sentence_unsupported(self):
        draft = self._make_draft()
        mock_result = self._mock_answers(
            sentence_nouls=[0.9, 0.85, 0.3, 0.8, 0.9],  # s2 fails
            lie_supported_noul=0.1,
            lie_contradicts_noul=0.9,
        )

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.system_one.return_value = mock_result

        with patch("generator.TypeSafeClient", return_value=mock_client):
            assert check(draft, "some source text") is False

    def test_lie_is_supported(self):
        draft = self._make_draft()
        mock_result = self._mock_answers(
            sentence_nouls=[0.9, 0.85, 0.95, 0.8, 0.9],
            lie_supported_noul=0.8,  # lie appears true — bad
            lie_contradicts_noul=0.9,
        )

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.system_one.return_value = mock_result

        with patch("generator.TypeSafeClient", return_value=mock_client):
            assert check(draft, "some source text") is False

    def test_lie_doesnt_contradict(self):
        draft = self._make_draft()
        mock_result = self._mock_answers(
            sentence_nouls=[0.9, 0.85, 0.95, 0.8, 0.9],
            lie_supported_noul=0.1,
            lie_contradicts_noul=0.3,  # lie too similar to truth
        )

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.system_one.return_value = mock_result

        with patch("generator.TypeSafeClient", return_value=mock_client):
            assert check(draft, "some source text") is False


# ---------------------------------------------------------------------------
# build tests
# ---------------------------------------------------------------------------


class TestBuild:
    @patch("generator.time.sleep")
    @patch("generator.check", return_value=True)
    @patch("generator.agent")
    @patch("generator.fetch_source")
    def test_success_first_attempt(self, mock_fetch, mock_agent, mock_check, mock_sleep):
        mock_fetch.return_value = ("A" * 1000, "https://en.wikipedia.org/wiki/Test")
        mock_run = MagicMock()
        mock_run.output = Draft(
            sentences=["A", "B", "C", "D", "E"],
            replace_index=2,
            lie="X",
        )
        mock_agent.run_sync.return_value = mock_run

        result = build({"category": "science", "title": "Test"})

        assert result is not None
        assert result["category"] == "science"
        assert result["topic"] == "Test"
        assert result["lie_index"] == 2
        assert result["truth"] == "C"
        assert result["sentences"][2] == "X"  # lie substituted

    @patch("generator.fetch_source")
    def test_source_too_short(self, mock_fetch):
        mock_fetch.return_value = ("short", "url")

        result = build({"category": "science", "title": "Test"})
        assert result is None

    @patch("generator.fetch_source")
    def test_source_fetch_fails(self, mock_fetch):
        mock_fetch.side_effect = Exception("network error")

        result = build({"category": "science", "title": "Test"})
        assert result is None

    @patch("generator.time.sleep")
    @patch("generator.check", return_value=False)
    @patch("generator.agent")
    @patch("generator.fetch_source")
    def test_all_attempts_fail(self, mock_fetch, mock_agent, mock_check, mock_sleep):
        mock_fetch.return_value = ("A" * 1000, "url")
        mock_run = MagicMock()
        mock_run.output = Draft(
            sentences=["A", "B", "C", "D", "E"],
            replace_index=0,
            lie="X",
        )
        mock_agent.run_sync.return_value = mock_run

        result = build({"category": "science", "title": "Test"})
        assert result is None
        assert mock_agent.run_sync.call_count == 3


# ---------------------------------------------------------------------------
# main tests
# ---------------------------------------------------------------------------


class TestMain:
    @patch("generator.time.sleep")
    @patch("generator.insert_pool")
    @patch("generator.insert")
    @patch("generator.build")
    @patch("generator.d1")
    def test_fills_buffer_gaps(
        self, mock_d1, mock_build, mock_insert, mock_insert_pool, mock_sleep
    ):
        # puzzles rows, pool rows, then buffer depth (+ optional extras)
        mock_d1.side_effect = [
            [],  # no existing daily puzzles
            [],  # empty pool
            [{"cnt": 5}],  # buffer depth
        ]
        mock_build.return_value = {
            "category": "science",
            "topic": "Test",
            "sentences": ["A", "B", "C", "D", "E"],
            "lie_index": 0,
            "truth": "A",
            "source_url": "url",
        }

        main()

        # Should try to fill 14 daily slots (pool top-up may add more builds)
        assert mock_insert.call_count == 14

    @patch("generator.time.sleep")
    @patch("generator.insert_pool")
    @patch("generator.insert")
    @patch("generator.build")
    @patch("generator.d1")
    def test_skips_existing_dates(
        self, mock_d1, mock_build, mock_insert, mock_insert_pool, mock_sleep
    ):
        import datetime as _dt

        today = _dt.datetime.now(_dt.timezone.utc).date()
        existing = [
            {"date": (today + _dt.timedelta(days=i)).isoformat(), "topic": f"Topic{i}"}
            for i in range(14)
        ]
        # Pretend every category already has a full pool so no pool top-up builds
        full_pool = [
            {"topic": f"Pool{c}{i}", "category": c, "status": "approved"}
            for c in (
                "science",
                "history",
                "geography",
                "technology",
                "arts",
                "nature",
                "human_body",
                "sports",
            )
            for i in range(40)
        ]
        mock_d1.side_effect = [
            existing,  # all dates taken
            full_pool,
            [{"cnt": 14}],  # buffer depth
        ]

        main()

        assert mock_insert.call_count == 0
        assert mock_insert_pool.call_count == 0

    @patch("generator.time.sleep")
    @patch("generator.insert_pool")
    @patch("generator.insert")
    @patch("generator.build")
    @patch("generator.d1")
    def test_deduplicates_topics(
        self, mock_d1, mock_build, mock_insert, mock_insert_pool, mock_sleep
    ):
        full_pool = [
            {"topic": f"Pool{c}{i}", "category": c, "status": "approved"}
            for c in (
                "science",
                "history",
                "geography",
                "technology",
                "arts",
                "nature",
                "human_body",
                "sports",
            )
            for i in range(40)
        ]
        mock_d1.side_effect = [
            [{"date": "2020-01-01", "topic": "Photosynthesis"}],  # used topic
            full_pool,
            [{"cnt": 0}],
        ]
        mock_build.return_value = {
            "category": "science",
            "topic": "Test",
            "sentences": ["A", "B", "C", "D", "E"],
            "lie_index": 0,
            "truth": "A",
            "source_url": "url",
        }

        main()

        for call in mock_build.call_args_list:
            assert call[0][0]["title"] != "Photosynthesis"

