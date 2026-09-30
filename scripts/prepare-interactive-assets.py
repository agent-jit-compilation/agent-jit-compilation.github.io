"""Prepare original diagram artwork and exact Figure 10 data; no benchmark execution."""
from pathlib import Path
import re, json, ast
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT.parent/"Agent JIT Compilation - ICML '26 camera-ready/figures"
figures={}
for name in ['example_planning','example_scheduling']:
 s=(SRC/(name+'.svg')).read_text()
 s=re.sub(r'<\?xml[^>]*\?>','',s)
 s=re.sub(r' content="[^"]*"','',s,count=1)
 s=re.sub(r' width="[^"]*"','',s,count=1)
 s=re.sub(r' height="[^"]*"','',s,count=1)
 s=re.sub(r'<image\b[^>]*/>', '', s)  # raster fallbacks; modern browsers use the original foreignObject text
 figures[name]=s
(ROOT/'data/figure-art.js').write_text('/* Original draw.io SVG artwork from the supplied camera-ready source. */\nwindow.PAPER_FIGURES = '+json.dumps(figures)+';\n')
assigns={}
for n in ast.parse((SRC/'plot_fig6.py').read_text()).body:
 if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in ['DATA','OVERHEAD','COL','MARK']:
  assigns[n.targets[0].id]=ast.literal_eval(n.value)
points=[]
for model,strategies in assigns['DATA'].items():
 for strategy,(lat,acc) in strategies.items():
  overhead=assigns['OVERHEAD'].get(model,0) if strategy in ['JIT-Scheduler','Oracle-Scheduler'] else 0
  points.append(dict(model=model,strategy=strategy,latency=round(lat+overhead,1),accuracy=round(acc*100,1),overhead=overhead))
data={'source':'Camera-ready figures/plot_fig6.py; scheduler overhead added to JIT and Oracle as in the source script.', 'colors':{m:'#'+''.join(f'{round(c*255):02x}' for c in color) for m,color in assigns['COL'].items()},'points':points}
(ROOT/'data/scheduler-results.json').write_text(json.dumps(data,indent=2)+'\n')
(ROOT/'data/plot-data.js').write_text('/* Figure 10 values from the supplied plotting script, including scheduler overhead. */\nwindow.SCHEDULER_RESULTS = '+json.dumps(data)+';\n')
print('Prepared original SVG artwork and',len(points),'scheduler points.')
