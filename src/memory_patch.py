# -*- coding: utf-8 -*-
"""
Memory injection layer for daily_stock_analysis.
Reads AnalysisHistory from DB and injects it into the LLM prompt.
"""

from datetime import datetime
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)


def build_history_section(code: str, db=None, days: int = 30, limit: int = 5) -> str:
    """
    Query recent analysis history for a stock and format it as a
    Markdown block suitable for injection into the LLM prompt.
    """
    try:
        if db is None:
            from src.storage import get_db
            db = get_db()

        records = db.get_analysis_history(code=code, days=days, limit=limit)

        if not records:
            return ""

        lines = ["\n## Historical Analysis Tracker\n"]
        lines.append("| Date | Advice | Score | Buy | Stop | Target | Summary |")
        lines.append("|------|--------|-------|-----|------|--------|---------|")

        for r in records:
            date_str = r.created_at.strftime("%m-%d %H:%M") if r.created_at else "-"
            advice = r.operation_advice or "-"
            score = str(r.sentiment_score) if r.sentiment_score is not None else "-"
            buy = f"{r.ideal_buy:.2f}" if r.ideal_buy else "-"
            stop = f"{r.stop_loss:.2f}" if r.stop_loss else "-"
            tp = f"{r.take_profit:.2f}" if r.take_profit else "-"
            summary = (r.analysis_summary or "-")[:60].replace("\n", " ")
            if len(r.analysis_summary or "") > 60:
                summary += "..."

            lines.append(
                f"| {date_str} | {advice} | {score} | {buy} | {stop} | {tp} | {summary} |"
            )

        verification = _build_verification_note(records, db, code)
        if verification:
            lines.append(verification)

        lines.append(
            "\n> Note: Review the accuracy of past predictions above. "
            "If a stop-loss was triggered, reassess whether there is a "
            "systematic bias in the trend analysis.\n"
        )

        return "\n".join(lines)

    except Exception as e:
        logger.warning(f"[memory_patch] Failed to load history for {code}, skipping: {e}")
        return ""


def _build_verification_note(records, db, code: str) -> str:
    """
    Compare the latest record's stop/target prices against current price.
    Python does the math; the model only sees the result.
    """
    if not records:
        return ""

    latest = records[0]
    if not latest.stop_loss and not latest.take_profit:
        return ""

    current_price = None
    try:
        recent = db.get_latest_data(code, days=1)
        if recent:
            current_price = recent[0].close
    except Exception:
        pass

    days_ago = ""
    if latest.created_at:
        delta = datetime.now() - latest.created_at
        if delta.days == 0:
            days_ago = "earlier today"
        elif delta.days == 1:
            days_ago = "yesterday"
        else:
            days_ago = f"{delta.days} days ago"

    advice = latest.operation_advice or "unknown"
    lines = [f"\n**Last Analysis Verification** ({days_ago}, advice: {advice})"]

    if current_price:
        if latest.stop_loss:
            if current_price < latest.stop_loss:
                status = f"TRIGGERED (current {current_price:.2f} < stop {latest.stop_loss:.2f})"
            else:
                gap_pct = (current_price - latest.stop_loss) / latest.stop_loss * 100
                status = f"Safe (current {current_price:.2f}, +{gap_pct:.1f}% above stop)"
            lines.append(f"- Stop loss {latest.stop_loss:.2f}: {status}")

        if latest.take_profit:
            if current_price >= latest.take_profit:
                status = f"REACHED (current {current_price:.2f} >= target {latest.take_profit:.2f})"
            else:
                gap_pct = (latest.take_profit - current_price) / current_price * 100
                status = f"Not reached (current {current_price:.2f}, {gap_pct:.1f}% to go)"
            lines.append(f"- Target price {latest.take_profit:.2f}: {status}")
    else:
        if latest.stop_loss:
            lines.append(f"- Stop loss set at: {latest.stop_loss:.2f}")
        if latest.take_profit:
            lines.append(f"- Target price set at: {latest.take_profit:.2f}")

    return "\n".join(lines)
