// One ticket per problem. causes.ts tells two causes apart by tenant; the desk's own notes name a third.
import { causeOf, uniqueById, type Cause, type Report, type Tenant } from '#lib/kb/causes';

// `shift`: the date keeps its day and month and slips by one day (desk-notes.json, `oneDayMove`).
// No locale or form explains that, so it is not `parser` or `hint`, whatever the tenant.
export type Problem = Cause | 'shift' | 'unplaced';
export const PROBLEMS: readonly Problem[] = ['parser', 'hint', 'shift', 'unplaced'];

export function problemOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem {
  if (oneDayMove.includes(r.id)) return 'shift';
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  tenants: string[];
  channels: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  // Reports whose intake tag names another problem than the one they belong to.
  mistagged: number;
};

export type Split = {
  // Rows in the export, before overlapping pages are dropped.
  rows: number;
  // One id, one report, merged into the ticket.
  merged: Report[];
  groups: ProblemGroup[];
  // Subject lines found in more than one problem: decision 0001 merges them as one issue.
  sharedSubjects: string[];
};

export function splitTicket(
  rows: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): Split {
  const merged = uniqueById(rows).filter((r) => r.mergedInto === ticket);
  const byProblem = new Map<Problem, Report[]>();
  for (const r of merged) {
    const p = problemOf(r, tenantOf(r), oneDayMove);
    byProblem.set(p, [...(byProblem.get(p) ?? []), r]);
  }
  const groups = PROBLEMS.filter((p) => byProblem.has(p)).map((problem) => {
    const rs = byProblem.get(problem)!;
    const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
    return {
      problem,
      reports: rs,
      tenants: [...new Set(rs.map((r) => r.tenant))].sort(),
      channels: rs.reduce<Record<string, number>>((n, r) => ({ ...n, [r.channel]: (n[r.channel] ?? 0) + 1 }), {}),
      firstSeen: days[0],
      lastSeen: days[days.length - 1],
      mistagged: rs.filter((r) => r.meta.intakeTag !== problem).length,
    };
  });
  const problemsBySubject = new Map<string, Set<Problem>>();
  for (const g of groups)
    for (const r of g.reports) problemsBySubject.set(r.subject, (problemsBySubject.get(r.subject) ?? new Set()).add(g.problem));
  const sharedSubjects = [...problemsBySubject].filter(([, ps]) => ps.size > 1).map(([s]) => s).sort();
  return { rows: rows.length, merged, groups, sharedSubjects };
}
