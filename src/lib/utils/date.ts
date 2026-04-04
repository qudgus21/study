/**
 * 주어진 날짜가 속한 주의 월요일을 반환한다.
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  // 일요일(0)이면 6일 전, 아니면 (day - 1)일 전
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 주의 시작(월요일)과 끝(일요일)을 반환한다.
 */
export function getWeekRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Date를 YYYY-MM-DD 형식 문자열로 변환한다.
 */
export function formatDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * 현재 주의 월요일을 YYYY-MM-DD로 반환한다.
 */
export function getCurrentWeekStartString(): string {
  return formatDateString(getWeekStart());
}

/**
 * 두 날짜가 같은 주에 속하는지 확인한다.
 */
export function isSameWeek(a: Date, b: Date): boolean {
  return getWeekStart(a).getTime() === getWeekStart(b).getTime();
}
