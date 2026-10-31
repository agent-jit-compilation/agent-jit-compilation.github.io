"""Export the REAL-27 leaderboard from released per-trial records, without running experiments.

Every row covers the 27 REAL tasks (Dashdish, Gomail, Omnizon) with equal-weight task
means over all recorded runs, including failures. Success is binary:
- Browser-Use, JIT-Scheduler and the CUA baselines use the harness verdict
  (evaluated_success), reproducing the scheduler and CUA numbers printed in the paper.
  Browser-Use runs are the scheduler experiment's Serial runs.
- JIT-Planner and Browser-Use +cache record only a score, so a run passes at full score;
  this reproduces the paper's binary JIT-Planner tiers (Appendix Table 5).
- CUA +cache (GPT-5.4) raw runs are not released; its row averages paper Table 4.
- GPT-6.1 Terra rows are live runs from October 2026 (data/recorded/live/gpt-6.1-terra.jsonl), passing at full score.
  JIT-Planner latency is the selected plan's generation time plus its execution, as the paper's
  planner records report it; a run with no valid plan counts its online time.
"""
import csv
import json
from html import escape
from collections import defaultdict
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT.parent / 'agent-jit-compilation'
RECORDED = RELEASE / 'data/recorded'
APPS = ('dashdish', 'gomail', 'omnizon')
MODELS = {'gpt-4.1': 'GPT-4.1', 'gemini-2.5-flash': 'Gemini-2.5-Flash', 'gemini-2.5-pro': 'Gemini-2.5-Pro'}
# Each harness is a family and a combination of mechanisms: tools, control loop, and schedule.
HARNESSES = {
    'JIT-Planner': ('JIT', 'Synthesized', 'Compiled', 'Serial'),
    'JIT-Scheduler': ('JIT', 'Primitives', 'Per-step', 'Adaptive'),
    'Browser-Use +cache': ('Browser-Use', 'Synthesized', 'Per-step', 'Serial'),
    'Browser-Use': ('Browser-Use', 'Primitives', 'Per-step', 'Serial'),
    'CUA +cache': ('CUA', 'Synthesized', 'Per-step', 'Serial'),
    'Vendor CUA': ('CUA', 'Pixels', 'Per-step', 'Serial'),
}
# Validated categorical slots 1-3 (all pairs); filled markers mark synthesized tools.
FAMILIES = {'JIT': ('JIT (ours)', '#2a78d6'), 'Browser-Use': ('Browser-Use', '#eb6834'),
            'CUA': ('Computer-use agents', '#1baf7a')}


def row(harness, model, task_stats, rule, source):
    assert len(task_stats) == 27, (harness, model, len(task_stats))
    family, tools, control, schedule = HARNESSES[harness]
    return dict(harness=harness, model=model, family=family, tools=tools, control=control, schedule=schedule,
                latency_s=round(mean(s[0] for s in task_stats), 1),
                success_pct=round(100 * mean(s[1] for s in task_stats), 1),
                runs=sum(s[2] for s in task_stats), success_rule=rule, source=source,
                ours='ours' if family == 'JIT' else '')


rows = []

# JIT-Planner and Browser-Use +cache: planner e2e records, pass at full score.
planner = defaultdict(dict)
for app in APPS:
    for path in sorted((RECORDED / f'planner/results_{app}').glob('*_e2e_detailed.json')):
        record = json.loads(path.read_text())
        for result in record['results']:
            trials = result['results']
            planner[result['name']][record['task_id']] = (
                mean(t['timing']['total_seconds'] for t in trials),
                mean(t['correctness_pct'] >= 1 - 1e-9 for t in trials), len(trials))
for model, label in MODELS.items():
    for harness, method in (('JIT-Planner', 'best'), ('Browser-Use +cache', 'loop-tools-baseline')):
        rows.append(row(harness, label, list(planner[f'{model}-{method}'].values()),
                        'Full score', 'Recorded planner runs'))

# Browser-Use (= scheduler Serial) and JIT-Scheduler: scheduler records, harness verdict.
stats = defaultdict(list)
for trial in json.loads((RECORDED / 'scheduler/trials.json').read_text())['trials']:
    stats[trial['model'], trial['task'], trial['stage_name']].append(trial)
stats = {key: (mean(t['total_time'] for t in trials), mean(t['evaluated_success'] is True for t in trials), len(trials))
         for key, trials in stats.items()}
for model, label in MODELS.items():
    rows.append(row('Browser-Use', label, [v for k, v in stats.items() if k[0] == model and k[2] == 'baseline'],
                    'Harness verdict', 'Recorded scheduler Serial runs'))
    selected = []
    for app in APPS:
        for choice in json.loads((RECORDED / f'scheduler/scheduler-{app}_{model}.json').read_text()):
            latency, success, runs = stats[model, choice['task'], choice['selected_strategy']]
            selected.append((latency + choice['overhead'], success, runs))
    rows.append(row('JIT-Scheduler', label, selected, 'Harness verdict', 'Recorded scheduler runs and choices'))

# GPT-6.1 Terra: live runs on Amazon Bedrock, pass at full score.
terra_runs = [json.loads(line) for line in (RECORDED / 'live/gpt-6.1-terra.jsonl').read_text().splitlines()]
for harness in ('JIT-Planner', 'Browser-Use +cache'):
    terra = defaultdict(list)
    for run in (run for run in terra_runs if run['method'] == harness):
        timing = run['timing']
        # A planner run with no valid plan has no phase timings; it counts its online time.
        phases = ((run['trace'].get('agent_metadata') or {}).get('selected_generation_s'), timing['execution_s'])
        latency = sum(phases) if harness == 'JIT-Planner' and None not in phases else timing['online_s']
        terra[run['task_id']].append((latency, run['score'] >= 1 - 1e-9))
    rows.append(row(harness, 'GPT-6.1 Terra', [(mean(t[0] for t in runs), mean(t[1] for t in runs), len(runs))
                                               for runs in terra.values()],
                    'Full score', 'Live runs, October 2026'))

# Pixel-based CUA baselines: recorded runs, harness verdict.
cua = defaultdict(list)
for trial in json.loads((RECORDED / 'scheduler/cua-trials.json').read_text())['trials']:
    cua[trial['model'], trial['task']].append(trial)
for agent, label in (('Anthropic CUA', 'Claude Sonnet 4'), ('OpenAI CUA', 'computer-use-preview')):
    rows.append(row('Vendor CUA', label, [(mean(t['total_time'] for t in trials), mean(t['evaluated_success'] is True for t in trials), len(trials))
                                          for (name, _), trials in cua.items() if name == agent],
                    'Harness verdict', 'Recorded CUA runs'))

# CUA +cache: per-application means from paper Table 4 (Dashdish, Gomail, Omnizon).
rows.append(dict(harness='CUA +cache', model='GPT-5.4', family='CUA', tools='Synthesized', control='Per-step', schedule='Serial',
                 latency_s=round(mean((34.5, 23.0, 51.2)), 1), success_pct=round(mean((89.0, 96.0, 100.0)), 1),
                 runs=81, success_rule='Reported', source='Paper appendix, Table 4', ours=''))

rows.sort(key=lambda r: r['latency_s'])
for r in rows:
    r['pareto'] = 'pareto' if not any(o['latency_s'] <= r['latency_s'] and o['success_pct'] >= r['success_pct']
                                      and (o['latency_s'], o['success_pct']) != (r['latency_s'], r['success_pct'])
                                      for o in rows) else ''
fields = ['rank', *rows[0]]
with (ROOT / 'data/leaderboard.csv').open('w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    for rank, r in enumerate(rows, 1):
        writer.writerow(dict(rank=rank, **r))
data = dict(tasks='27 REAL tasks: Dashdish, Gomail, Omnizon',
            families={key: dict(label=label, color=color) for key, (label, color) in FAMILIES.items()},
            harnesses={name: dict(family=family, tools=tools, control=control, schedule=schedule)
                       for name, (family, tools, control, schedule) in HARNESSES.items()},
            rows=[dict(rank=rank, **r) for rank, r in enumerate(rows, 1)])
(ROOT / 'data/leaderboard.js').write_text('/* REAL-27 leaderboard; generated by scripts/prepare-leaderboard.py. */\n'
                                          'window.LEADERBOARD = ' + json.dumps(data) + ';\n')
# The no-JavaScript table in leaderboard.html, rewritten from the same rows.
page = (ROOT / 'leaderboard.html').read_text()
before, table = page.split('id="leaderboard-results"', 1)
head, rest = table.split('<tbody>\n', 1)
head = before + 'id="leaderboard-results"' + head
body, tail = rest.split('              </tbody>', 1)
markup = ''.join(
    f'''              <tr class="leaderboard-row">
                <td>{rank}</td>
                <th scope="row"><span class="harness-dot family-{r['family'].lower()}{' is-filled' if r['tools'] == 'Synthesized' else ''}" aria-hidden="true"></span>{escape(r['harness'])}{' <span class="pareto-pill">Pareto optimal</span>' if r['pareto'] else ''}</th>
                <td>{escape(r['model'])}</td>
                <td>{r['latency_s']:.1f}</td>
                <td>{r['success_pct']:.1f}%</td>
              </tr>
''' for rank, r in enumerate(rows, 1))
(ROOT / 'leaderboard.html').write_text(head + '<tbody>\n' + markup + '              </tbody>' + tail)
print(f"Exported {len(rows)} leaderboard rows; Pareto frontier: "
      + ', '.join(f"{r['harness']} ({r['model']})" for r in rows if r['pareto']))
