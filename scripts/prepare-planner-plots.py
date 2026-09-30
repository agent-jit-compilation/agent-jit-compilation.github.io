"""Export Figures 5 and 8 from recovered BLAST samples, without running experiments.

Input is a minimal extract (model, protocol, validity, latency) from the private
backup at the commit below. Generated programs and execution logs are excluded.
"""
import json
from collections import defaultdict
from math import comb
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT.parent / 'context/planner-figure-samples.json').read_text())
MODELS = {
    'openai/gpt-oss-120b': ('GPT-OSS-120B', '#AED6F1'),
    'gpt-4.1': ('GPT-4.1', '#5499C7'),
    'gpt-5-mini': ('GPT-5-mini', '#2874A6'),
    'gpt-5': ('GPT-5', '#154360'),
    'gemini-2.0-flash-lite': ('Gemini-2.0-Flash-Lite', '#ABEBC6'),
    'gemini-2.5-flash': ('Gemini-2.5-Flash', '#28B463'),
    'gemini-2.5-pro': ('Gemini-2.5-Pro', '#196F3D'),
}
groups = defaultdict(list)
for file in source['files']:
    if any(f'results_{app}/' in file['path'] for app in ('dashdish', 'gomail', 'omnizon')):
        for row in file['samples']:
            groups[row['model'], row['protocol']].append(row)
points = []
for model in MODELS:
    for protocol in (True, False):
        rows = groups[model, protocol]
        n, c = len(rows), sum(r['valid'] for r in rows)
        points.append(dict(model=MODELS[model][0], protocol=protocol, n=n, valid=c,
                           accuracy=c/n, latency=sum(r['latency'] for r in rows)/n))

def pass_k(n, c, k):
    return 0 if c == 0 else 1 if n-c < k else 1-comb(n-c, k)/comb(n, k)

efficiency = []
for model in ('gemini-2.5-pro', 'gpt-4.1', 'gpt-5'):
    file = next(f for f in source['files'] if f['path'].endswith(f'/{model}/webarena-747_{model}.json'))
    for protocol in (True, False):
        rows = [r for r in file['samples'] if r['protocol'] == protocol]
        n, c = len(rows), sum(r['valid'] for r in rows)
        latencies = sorted(r['latency'] for r in rows if r['latency'] > 0)
        assert n == 32
        def pass_t(t):
            f = sum(lat <= t for lat in latencies)/len(latencies)
            return 1-(1-f*c/n)**8
        efficiency.append(dict(model=MODELS[model][0], protocol=protocol, n=n, valid=c,
                               latencies=latencies,
                               k=[[k, pass_k(n, c, k)] for k in range(1, 33)],
                               t=[[t*48/399, pass_t(t*48/399)] for t in range(400)]))

data = dict(commit=source['commit'],
            protocol=dict(scope='REAL tasks: Dashdish, Gomail, Omnizon',
                          colors={name: color for name, color in MODELS.values()}, points=points),
            efficiency=dict(task='webarena-747', workers=8,
                            colors={'Gemini-2.5-Pro':'#196F3D','GPT-4.1':'#5DADE2','GPT-5':'#154360'},
                            series=efficiency))
(ROOT/'data/planner-plots.json').write_text(json.dumps(data, indent=2)+'\n')
(ROOT/'data/planner-plots.js').write_text('/* Source-backed Figures 5 and 8; see docs/content-provenance.md. */\nwindow.PLANNER_PLOTS = '+json.dumps(data)+';\n')
print(f'Exported {len(points)} protocol points and {len(efficiency)} paired efficiency series.')
