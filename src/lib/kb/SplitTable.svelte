<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import type { Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { splitTicket, type Problem } from '#lib/kb/split';

  // issues: where each problem is filed now and where it stands, problem → { url, state }.
  type Filed = { url: string; state: string };
  let { ticket, issues = {} }: { ticket: number; issues?: Partial<Record<Problem, Filed>> } = $props();

  const split = $derived(splitTicket(reports as Report[], ticket, tenantOf, notes.oneDayMove));
  const channels = (c: Record<string, number>) =>
    Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .map(([ch, n]) => `${ch} ×${n}`)
      .join(' · ');
  const issueNo = (url: string) => `#${url.split('/').pop()}`;
</script>

<p class="sum">
  <strong>{split.merged.length}</strong> reports merged into #{ticket}
  ({split.rows} rows in the export, {split.rows - split.merged.length} of them repeats) ·
  <strong>{split.groups.length}</strong>
  {split.groups.length === 1 ? 'problem' : 'problems'}
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>channels</th><th>tenants</th><th>seen</th><th>ticket</th></tr>
  </thead>
  <tbody>
    {#each split.groups as g (g.problem)}
      {@const filed = issues[g.problem]}
      <tr class:open={!filed || filed.state === 'open'}>
        <td><code>{g.problem}</code></td>
        <td>
          <strong>{g.reports.length}</strong>
          {#if g.shared}<span class="small">({g.shared} also under another problem)</span>{/if}
        </td>
        <td class="small">{channels(g.channels)}</td>
        <td class="small">{g.tenants.join(', ')}</td>
        <td class="small">{g.firstSeen} → {g.lastSeen}</td>
        <td>
          {#if filed}
            <a href={filed.url}>{issueNo(filed.url)}</a> {filed.state}
          {:else}
            no ticket yet
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<p class="note">
  Each problem counts the reports filed under it, as the desk's own table does: the one-day moves stay
  under the cause their tenant gives them and count again under <code>shift</code>. Intake's tag names none
  of a report's problems on <strong>{split.mistagged}</strong> of {split.merged.length} reports.
  {split.sharedSubjects.length} subject lines turn up in more than one problem.
</p>

<style>
  .sum { font-size: 1.1rem; }
  .small { color: var(--muted); font-size: 0.85em; }
  .note { color: var(--muted); font-size: 0.85em; }
  .open td { background: var(--warn-bg); }
  .open td:last-child { color: var(--warn); font-weight: 600; }
</style>
