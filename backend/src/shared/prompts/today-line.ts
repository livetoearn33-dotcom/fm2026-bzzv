const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 兩個引擎（/analyze、/guard）〈本次任務〉開頭注入的日期行（見
 * prompts/README-組裝說明.md「兩個引擎的通用組裝規則」第 1 點）：
 * 「這週來得及嗎」這類時效問題沒有它會答含糊。
 */
export function formatTodayLine(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const weekday = WEEKDAY_LABELS[now.getDay()];
  return `今天是 ${yyyy}-${mm}-${dd}（週${weekday}）`;
}
