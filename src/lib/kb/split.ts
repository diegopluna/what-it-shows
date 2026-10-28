// One ticket per problem. causes.ts tells two causes apart by tenant; the desk's own notes name a third.
import { causeOf, uniqueById, type Cause, type Report, type Tenant } from '#lib/kb/causes';

// `shift`: the date keeps its day and month and slips by one day (desk-notes.json, `oneDayMove`).
// No locale or form explains that. The desk counts these where they are filed by tenant and
// footnotes them (causes.ts, `readAs`); this split counts them there too, and again under `shift`.
export type Problem = Cause | 'shift' | 'unplaced';
export const PROBLEMS: readonly Problem[] = ['parser', 'hint', 'shift', 'unplaced'];

export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  tenants: string[];
  channels: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  // Reports in this group that are also counted under another problem.
  shared: number;
};

export type Split = {
  // Rows in the export, before overlapping pages are dropped.
  rows: number;
  // One id, one report, merged into the ticket.
  merged: Report[];
  groups: ProblemGroup[];
  // Reports whose intake tag names none of the problems they are counted under.
  mistagged: number;
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
  const add = (p: Problem, r: Report) => byProblem.set(p, [...(byProblem.get(p) ?? []), r]);
  for (const r of merged) {
    add(causeOf(r, tenantOf(r)) ?? 'unplaced', r);
    if (oneDayMove.includes(r.id)) add('shift', r);
  }
  const counted = new Map<string, number>();
  for (const rs of byProblem.values()) for (const r of rs) counted.set(r.id, (counted.get(r.id) ?? 0) + 1);

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
      shared: rs.filter((r) => counted.get(r.id)! > 1).length,
    };
  });
  const problemsBySubject = new Map<string, Set<Problem>>();
  for (const g of groups)
    for (const r of g.reports) problemsBySubject.set(r.subject, (problemsBySubject.get(r.subject) ?? new Set()).add(g.problem));
  const sharedSubjects = [...problemsBySubject].filter(([, ps]) => ps.size > 1).map(([s]) => s).sort();
  const mistagged = merged.filter((r) => !groups.some((g) => g.problem === r.meta.intakeTag && g.reports.includes(r))).length;
  return { rows: rows.length, merged, groups, mistagged, sharedSubjects };
}
