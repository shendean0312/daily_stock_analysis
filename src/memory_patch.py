# -*- coding: utf-8 -*-
"""
Memory injection layer for daily_stock_analysis.
Reads AnalysisHistory from DB and injects it into the LLM prompt.
"""

from datetime import datetime
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)


def build_history_section(code: str, db=None, days: int = 30, limit: int = 5, exclude_query_id: str = None) -> str:
    """
    Query recent analysis history for a stock and format it as a
    Markdown block suitable for injection into the LLM prompt.
    """
    try:
        if db is None:
            from src.storage import get_db
            db = get_db()

        # Fetch records for the last `days` days, excluding current run's query_id if provided
        records = db.get_analysis_history(code=code, days=days, limit=50, exclude_query_id=exclude_query_id)

        if not records:
            return ""

        daily_latest = {}
        unique_records = []
        for r in records:
            if not r.created_at:
                continue
            date_str = r.created_at.strftime("%Y-%m-%d")
            if date_str not in daily_latest:
                daily_latest[date_str] = r
                unique_records.append(r)
                if len(unique_records) >= limit:
                    break
        
        if not unique_records:
            return ""

        lines = ["\n### 📜 历史复盘追踪\n"]
        lines.append("| 日期 | 操作建议 | 评分 | 买入位 | 止损位 | 目标位 | 复盘逻辑 |")
        lines.append("|------|----------|------|--------|--------|--------|----------|")

        for r in unique_records:
            date_str = r.created_at.strftime("%m-%d %H:%M")
            advice = r.operation_advice or "-"
            score = str(r.sentiment_score) if r.sentiment_score is not None else "-"
            buy = f"{r.ideal_buy:.2f}" if r.ideal_buy else "-"
            stop = f"{r.stop_loss:.2f}" if r.stop_loss else "-"
            tp = f"{r.take_profit:.2f}" if r.take_profit else "-"
            summary = (r.analysis_summary or "-").replace("\n", " ")

            lines.append(
                f"| {date_str} | {advice} | {score} | {buy} | {stop} | {tp} | {summary} |"
            )

        verification = _build_verification_note(unique_records, db, code)
        if verification:
            lines.append(verification)

        lines.append(
            "\n> 注意：请审查上方过去预测的准确性。"
            "如果触发了止损，请重新评估趋势分析中是否存在"
            "系统性偏差。\n"
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
        delta = datetime.now().date() - latest.created_at.date()
        if delta.days == 0:
            days_ago = f"今日 {latest.created_at.strftime('%H:%M')}"
        elif delta.days == 1:
            days_ago = f"昨日 {latest.created_at.strftime('%H:%M')}"
        else:
            days_ago = f"{delta.days} 天前"

    advice = latest.operation_advice or "未知"
    lines = [f"\n**上次分析验证** ({days_ago}，建议：{advice})"]

    if current_price:
        if latest.stop_loss:
            if current_price < latest.stop_loss:
                status = f"已触发 (当前 {current_price:.2f} < 止损 {latest.stop_loss:.2f})"
            else:
                gap_pct = (current_price - latest.stop_loss) / latest.stop_loss * 100
                status = f"安全 (当前 {current_price:.2f}，高于止损 {gap_pct:.1f}%)"
            lines.append(f"- 止损位 {latest.stop_loss:.2f}: {status}")

        if latest.take_profit:
            if current_price >= latest.take_profit:
                status = f"已达标 (当前 {current_price:.2f} >= 目标 {latest.take_profit:.2f})"
            else:
                gap_pct = (latest.take_profit - current_price) / current_price * 100
                status = f"未达标 (当前 {current_price:.2f}，距离目标还有 {gap_pct:.1f}%)"
            lines.append(f"- 目标位 {latest.take_profit:.2f}: {status}")
    else:
        if latest.stop_loss:
            lines.append(f"- 设定止损位：{latest.stop_loss:.2f}")
        if latest.take_profit:
            lines.append(f"- 设定目标位：{latest.take_profit:.2f}")

    return "\n".join(lines)
