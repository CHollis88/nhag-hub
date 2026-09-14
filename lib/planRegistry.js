import * as foundations from "@/data/plan";
import * as nt90 from "@/data/plan-nt90";
import * as whole6mo from "@/data/plan-whole6mo";
import * as whole9mo from "@/data/plan-whole9mo";

// Every plan a ministry can offer. id is stored either on a group
// (reading_plan_id, when locked) or on a user (active_reading_plan, when
// each member picks their own) -- see migration_016. Adding a new plan
// later means dropping in a new data/plan-<id>.json + .js pair (same
// shape: PLAN, TOTAL_READING_DAYS, getDay) and one line here.
export const PLANS = {
  foundations: { id: "foundations", name: "Through the Bible in a Year", ...foundations },
  whole6mo: { id: "whole6mo", name: "Whole Bible in 6 Months", ...whole6mo },
  whole9mo: { id: "whole9mo", name: "Whole Bible in 9 Months", ...whole9mo },
  nt90: { id: "nt90", name: "New Testament in 90 Days", ...nt90 },
};

export const DEFAULT_PLAN_ID = "foundations";

export function getPlan(planId) {
  return PLANS[planId] || PLANS[DEFAULT_PLAN_ID];
}

export const PLAN_LIST = Object.values(PLANS).map(({ id, name, TOTAL_READING_DAYS }) => ({
  id,
  name,
  totalDays: TOTAL_READING_DAYS,
}));
