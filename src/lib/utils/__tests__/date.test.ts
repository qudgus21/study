import { describe, it, expect } from "vitest";
import { getWeekStart, getWeekRange, formatDateString, isSameWeek } from "../date";

describe("date utils", () => {
  describe("getWeekStart", () => {
    it("월요일이면 그대로 반환한다", () => {
      // 2026-04-06 = 월요일
      const monday = new Date(2026, 3, 6);
      const result = getWeekStart(monday);
      expect(result.getDay()).toBe(1); // 월요일
      expect(result.getDate()).toBe(6);
    });

    it("수요일이면 해당 주 월요일을 반환한다", () => {
      // 2026-04-08 = 수요일
      const wednesday = new Date(2026, 3, 8);
      const result = getWeekStart(wednesday);
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(6);
    });

    it("일요일이면 전주 월요일을 반환한다", () => {
      // 2026-04-05 = 일요일
      const sunday = new Date(2026, 3, 5);
      const result = getWeekStart(sunday);
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(30); // 3월 30일 월요일
    });
  });

  describe("getWeekRange", () => {
    it("월요일~일요일 범위를 반환한다", () => {
      const wednesday = new Date(2026, 3, 8);
      const { start, end } = getWeekRange(wednesday);
      expect(start.getDay()).toBe(1);
      expect(end.getDay()).toBe(0);
      expect(end.getDate() - start.getDate()).toBe(6);
    });
  });

  describe("formatDateString", () => {
    it("YYYY-MM-DD 형식으로 변환한다", () => {
      const date = new Date(2026, 3, 6); // 로컬 시간
      const result = formatDateString(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("isSameWeek", () => {
    it("같은 주의 두 날짜는 true를 반환한다", () => {
      const mon = new Date(2026, 3, 6);
      const fri = new Date(2026, 3, 10);
      expect(isSameWeek(mon, fri)).toBe(true);
    });

    it("다른 주의 두 날짜는 false를 반환한다", () => {
      const week1 = new Date(2026, 3, 6);
      const week2 = new Date(2026, 3, 13);
      expect(isSameWeek(week1, week2)).toBe(false);
    });
  });
});
