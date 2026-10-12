#!/usr/bin/env python3
"""Small seed evaluation for the demo confidence / grounding score.

This is not a statistical benchmark. It is a reproducible smoke eval that asks:

1. Does the score rise as answers become more grounded?
2. Does the score get misread as readiness confidence before live state exists?
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from typing import Any

from demo import confidence_breakdown, run, setup


STAGES: list[dict[str, Any]] = [
    {
        "id": "01_naive",
        "key": "naive",
        "name": "Naive search",
        "kwargs": {"mode": "naive"},
        "grounded_label": False,
        "resolved_label": False,
    },
    {
        "id": "02_index_filter",
        "key": "index_filter",
        "name": "Index + filter",
        "kwargs": {"mode": "context", "disabled": ["rewrite", "rerank", "authority"]},
        "grounded_label": True,
        "resolved_label": False,
    },
    {
        "id": "03_rewrite",
        "key": "rewrite",
        "name": "Query expansion",
        "kwargs": {"mode": "context", "disabled": ["rerank", "authority"]},
        "grounded_label": True,
        "resolved_label": False,
    },
    {
        "id": "04_rerank",
        "key": "rerank",
        "name": "Reranking",
        "kwargs": {"mode": "context", "disabled": ["authority"]},
        "grounded_label": True,
        "resolved_label": False,
    },
    {
        "id": "05_authority",
        "key": "authority",
        "name": "Authority policy",
        "kwargs": {"mode": "context", "disabled": []},
        "grounded_label": True,
        "resolved_label": False,
    },
    {
        "id": "06_live",
        "key": "live",
        "name": "Add live check",
        "kwargs": {"mode": "live", "disabled": []},
        "grounded_label": True,
        "resolved_label": True,
    },
    {
        "id": "07_complete",
        "key": "complete",
        "name": "Mark complete",
        "kwargs": {"mode": "live", "disabled": []},
        "set_de": "complete",
        "grounded_label": True,
        "resolved_label": True,
    },
]


# The rubric IS the fully-tuned final answer (stage 8, all perks on): the properties
# it has are what "correct" means. Every stage is graded on how many of these five
# target properties it reproduces, so the correctness % is learned from the best
# scenario, not hand-set per stage. It is a transparent rubric, not a trained model.
CORRECTNESS_CRITERIA = [
    "right_table",            # recommends the canonical contract, not the deprecated table
    "no_hallucinated_fresh",  # does not invent "yesterday is ready" without a check
    "flags_currency",         # surfaces the local-currency / conversion caveat
    "freshness_governance",   # brings the freshness policy OR a live check into play
    "readiness_resolved",     # actually resolves readiness via live state
]


def answer_correctness(result: dict[str, Any]) -> dict[str, Any]:
    """Grade one stage's answer against the final-answer rubric. Returns the per-
    criterion booleans plus a 0-100 percentage (passed / 5). Deterministic."""
    answer = result["answer"].lower()
    live_status = result["live_status"]
    checks = answer_checks(result)
    criteria = {
        "right_table": checks["recommends_canonical"] and not checks["recommends_legacy"],
        "no_hallucinated_fresh": not checks["ungrounded_ready_claim"],
        "flags_currency": "local currency" in answer or "convert" in answer,
        "freshness_governance": "freshness policy" in answer or live_status is not None,
        "readiness_resolved": checks["live_resolution_correct"],
    }
    passed = sum(1 for name in CORRECTNESS_CRITERIA if criteria[name])
    return {
        "criteria": criteria,
        "passed": passed,
        "total": len(CORRECTNESS_CRITERIA),
        "pct": round(100 * passed / len(CORRECTNESS_CRITERIA)),
    }



def answer_checks(result: dict[str, Any]) -> dict[str, bool]:
    answer = result["answer"].lower()
    live_status = result["live_status"]
    recommends_canonical = "use finance.fct_net_revenue_v2" in answer
    recommends_legacy = "use finance.daily_revenue" in answer
    ungrounded_ready_claim = live_status is None and "yesterday's data is ready to use" in answer
    live_not_ready = live_status is not None and live_status["complete"] is False and "not ready" in answer
    live_ready = live_status is not None and live_status["complete"] is True and "partitions complete" in answer
    live_resolution_correct = live_not_ready or live_ready
    grounded = recommends_canonical and not recommends_legacy and not ungrounded_ready_claim
    if live_status is not None:
        grounded = grounded and live_resolution_correct
    return {
        "recommends_canonical": recommends_canonical,
        "recommends_legacy": recommends_legacy,
        "ungrounded_ready_claim": ungrounded_ready_claim,
        "live_resolution_correct": live_resolution_correct,
        "grounded_observed": grounded,
        "resolved_observed": live_resolution_correct,
    }


def brier_score(rows: list[dict[str, Any]], label_name: str) -> float:
    return sum((row["confidence"] / 100 - int(row[label_name])) ** 2 for row in rows) / len(rows)


def calibration_bins(rows: list[dict[str, Any]], label_name: str) -> list[dict[str, Any]]:
    bins = [(0, 49), (50, 69), (70, 89), (90, 100)]
    out = []
    for low, high in bins:
        items = [row for row in rows if low <= row["confidence"] <= high]
        if not items:
            continue
        avg_conf = sum(row["confidence"] for row in items) / len(items) / 100
        accuracy = sum(int(row[label_name]) for row in items) / len(items)
        out.append(
            {
                "bin": f"{low}-{high}",
                "n": len(items),
                "avg_confidence": avg_conf,
                "accuracy": accuracy,
                "gap": abs(avg_conf - accuracy),
            }
        )
    return out


def expected_calibration_error(rows: list[dict[str, Any]], label_name: str) -> float:
    total = len(rows)
    return sum(item["n"] / total * item["gap"] for item in calibration_bins(rows, label_name))


def run_eval() -> dict[str, Any]:
    setup(True)
    rows = []
    for stage in STAGES:
        if stage.get("set_de"):
            with sqlite3.connect(setup()) as conn:
                conn.execute(
                    "UPDATE partitions SET status=? WHERE country=? AND business_date=?",
                    (stage["set_de"], "DE", "2026-10-09"),
                )
        result = run(**stage["kwargs"])
        checks = answer_checks(result)
        correctness = answer_correctness(result)
        breakdown = confidence_breakdown(result["evidence"], result["live_status"], result["question"])
        row = {
            "id": stage["id"],
            "key": stage["key"],
            "name": stage["name"],
            "confidence": result["confidence"],
            "correctness_pct": correctness["pct"],
            "correctness_passed": correctness["passed"],
            "correctness_total": correctness["total"],
            "correctness_criteria": correctness["criteria"],
            "grounded_label": stage["grounded_label"],
            "resolved_label": stage["resolved_label"],
            "grounded_observed": checks["grounded_observed"],
            "resolved_observed": checks["resolved_observed"],
            "top_doc": result["evidence"][0]["id"],
            "canonical_rank": breakdown["canonical_rank"],
            "score_parts": breakdown["parts"],
        }
        row["label_check_passed"] = (
            row["grounded_label"] == row["grounded_observed"]
            and row["resolved_label"] == row["resolved_observed"]
        )
        rows.append(row)
    setup(True)
    return {
        "rows": rows,
        "correctness_by_key": {row["key"]: row["correctness_pct"] for row in rows},
        "metrics": {
            "grounded_brier": brier_score(rows, "grounded_label"),
            "grounded_ece": expected_calibration_error(rows, "grounded_label"),
            "resolved_brier": brier_score(rows, "resolved_label"),
            "resolved_ece": expected_calibration_error(rows, "resolved_label"),
        },
        "calibration_bins": {
            "grounded": calibration_bins(rows, "grounded_label"),
            "resolved": calibration_bins(rows, "resolved_label"),
        },
    }


def print_text(report: dict[str, Any]) -> None:
    print("Seed confidence eval")
    print("Note: labels are demo seed labels, not production calibration data.\n")
    print("Stage                 Conf  Correct  Grounded  Resolved  Top doc      Canonical")
    print("--------------------  ----  -------  --------  --------  -----------  ---------")
    for row in report["rows"]:
        print(
            f"{row['name'][:20]:20}  "
            f"{row['confidence']:>4}  "
            f"{str(row['correctness_pct']) + '%':>7}  "
            f"{str(row['grounded_label']):>8}  "
            f"{str(row['resolved_label']):>8}  "
            f"{row['top_doc']:<11}  "
            f"{row['canonical_rank']}"
        )

    metrics = report["metrics"]
    print("\nMetrics")
    print(f"Grounded Brier score: {metrics['grounded_brier']:.3f}")
    print(f"Grounded ECE:         {metrics['grounded_ece']:.3f}")
    print(f"Resolved Brier score: {metrics['resolved_brier']:.3f}")
    print(f"Resolved ECE:         {metrics['resolved_ece']:.3f}")

    print("\nInterpretation")
    print("- The current score tracks grounding better than readiness.")
    print("- Treat it as Grounding Score, not probability the final business decision is ready.")
    print("- Add more labelled questions before calling it calibrated confidence.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Print the full eval report as JSON.")
    args = parser.parse_args()
    report = run_eval()
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print_text(report)
    if not all(row["label_check_passed"] for row in report["rows"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
