import PLAN from "./plan-whole9mo.json";

export { PLAN };
export const TOTAL_READING_DAYS = PLAN.filter((d) => d.type === "reading").length;
export function getDay(dayNum) {
  return PLAN.find((d) => d.day === dayNum);
}
