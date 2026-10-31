"""Write llms.txt and Markdown copies of the pages (llmstxt.org conventions) from the site's HTML and CSV data."""
import csv
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://agent-jit-compilation.github.io/'
VOID = {'br', 'img', 'meta', 'link', 'input', 'hr', 'source', 'path', 'line', 'circle'}
SKIP_CLASSES = {'interactive-mount', 'citation-actions', 'skip-link', 'static-figure'}


class Node:
    def __init__(self, tag, attrs):
        self.tag, self.attrs, self.children = tag, dict(attrs), []


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('root', {})
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def find(node, predicate):
    if isinstance(node, Node):
        if predicate(node):
            return node
        for child in node.children:
            found = find(child, predicate)
            if found:
                return found
    return None


def skipped(node):
    return node.tag in ('button', 'script', 'svg', 'style') or SKIP_CLASSES & set(node.attrs.get('class', '').split())


def absolute(href):
    return href if re.match(r'^(https?:|mailto:|#)', href) else SITE + href


def inline(node):
    if isinstance(node, str):
        return re.sub(r'\s+', ' ', node)
    if skipped(node):
        return ''
    text = ''.join(inline(child) for child in node.children)
    wrap = {'strong': '**', 'b': '**', 'em': '*', 'i': '*', 'code': '`', 'time': '**'}.get(node.tag)
    if wrap and text.strip():
        return f'{wrap}{text.strip()}{wrap}'
    if node.tag == 'a' and node.attrs.get('href') and text.strip():
        return f'[{text.strip()}]({absolute(node.attrs["href"])})'
    if node.tag == 'sub':
        return f'_{text}'
    return text


def text_of(node):
    return ''.join(child if isinstance(child, str) else text_of(child) for child in node.children)


def planner_table():
    rows = list(csv.DictReader(open(ROOT / 'data/planner-results.csv')))
    out = ['| Group | Setting | Browser-Use latency (s) | Browser-Use accuracy | Browser-Use +cache latency (s) '
           '| Browser-Use +cache accuracy | JIT-Planner latency (s) | JIT-Planner accuracy |',
           '|---|---|---|---|---|---|---|---|']
    for r in rows:
        out.append(f"| {r['group']} | {r['setting']} | {r['browser_use_latency_s']} | {float(r['browser_use_accuracy_pct']):.0f}% "
                   f"| {r['cache_latency_s']} | {float(r['cache_accuracy_pct']):.0f}% | {r['jit_latency_s']} "
                   f"| {float(r['jit_accuracy_pct']):.0f}% |")
    return '\n'.join(out)


def block(node):
    if isinstance(node, str):
        return [node.strip()] if node.strip() else []
    if skipped(node):
        return []
    tag = node.tag
    if tag in ('h1', 'h2', 'h3', 'h4'):
        return ['#' * int(tag[1]) + ' ' + inline(node).strip()]
    if tag == 'p':
        text = inline(node).strip()
        return [text] if text else []
    if tag in ('ul', 'ol'):
        items = [child for child in node.children if isinstance(child, Node) and child.tag == 'li']
        marker = (lambda i: f'{i}.') if tag == 'ol' else (lambda i: '-')
        return ['\n'.join(f'{marker(i)} {inline(li).strip()}' for i, li in enumerate(items, 1))]
    if tag == 'pre':
        return ['```\n' + text_of(node).strip('\n') + '\n```']
    if tag == 'table' and node.attrs.get('id') == 'planner-results':
        caption = find(node, lambda n: n.tag == 'caption')
        return [inline(caption).strip(), planner_table()]
    if tag == 'figure':
        image = find(node, lambda n: n.tag == 'img')
        caption = find(node, lambda n: n.tag == 'figcaption')
        out = [f'![{image.attrs.get("alt", "")}]({absolute(image.attrs["src"])})'] if image else []
        return out + ([f'*{inline(caption).strip()}*'] if caption else [])
    return [part for child in node.children for part in block(child)]


def page_markdown():
    tree = Tree()
    tree.feed((ROOT / 'index.html').read_text())
    title = find(tree.root, lambda n: n.tag == 'meta' and n.attrs.get('name') == 'citation_title').attrs['content']
    authors = re.findall(r'<meta name="citation_author" content="([^"]+)">', (ROOT / 'index.html').read_text())
    parts = [f'# {title}',
             f'{", ".join(authors)}. Stanford University. ICML 2026.',
             f'[Paper](https://proceedings.mlr.press/v306/winston26b.html) · [arXiv](https://arxiv.org/abs/2605.21470) · '
             f'[Code](https://github.com/agent-jit-compilation/agent-jit-compilation) · [Leaderboard]({SITE}leaderboard.html.md) · '
             f'[PDF]({SITE}paper.pdf)']
    parts += block(find(tree.root, lambda n: n.attrs.get('id') == 'updates'))
    for section_id in ('abstract', 'method', 'planner', 'scheduler', 'results', 'limitations', 'beyond-web', 'citation'):
        section = find(tree.root, lambda n: n.tag == 'section' and n.attrs.get('id') == section_id)
        parts += block(section)
    return '\n\n'.join(parts) + '\n'


def leaderboard_markdown():
    rows = list(csv.DictReader(open(ROOT / 'data/leaderboard.csv')))
    harnesses = {r['harness']: (r['tools'], r['control'], r['schedule']) for r in rows}
    table = ['| # | Harness | Model | Latency (s) | Success |', '|---|---|---|---|---|']
    table += [f"| {r['rank']} | {r['harness']}{' (Pareto optimal)' if r['pareto'] else ''} | {r['model']} "
              f"| {float(r['latency_s']):.1f} | {float(r['success_pct']):.1f}% |" for r in rows]
    key = ['| Harness | Tools | Control | Schedule |', '|---|---|---|---|']
    key += [f'| {name} | {tools} | {control} | {schedule} |' for name, (tools, control, schedule) in harnesses.items()]
    return '\n\n'.join([
        '# Agent JIT Compilation leaderboard',
        'We evaluate each (harness, model) pair on 27 REAL tasks (Dashdish, Gomail, Omnizon) with three runs each. '
        'Latency is mean end-to-end seconds per task; success is the share of runs that pass. Ranked by latency.',
        '\n'.join(table),
        '## Harnesses',
        '\n'.join(key),
        '- Tools: reusable app tools (Synthesized), browser actions (Primitives), or screenshots (Pixels).\n'
        '- Control: the model picks each action (Per-step), or a checked program runs (Compiled).\n'
        '- Schedule: one browser (Serial), or serial, parallel, or hedged per task (Adaptive).',
        f'Data: [leaderboard.csv]({SITE}data/leaderboard.csv), with each row\'s success rule and source. '
        f'Paper: [project page]({SITE}index.html.md).',
    ]) + '\n'


LLMS = f"""# Agent JIT Compilation

> Agent JIT Compilation (ICML 2026) compiles natural-language web tasks into checked, cost-ranked programs (JIT-Planner) and chooses serial, parallel, or hedged execution per task (JIT-Scheduler). Across five web applications, JIT-Planner is 10.4× faster than Browser-Use with a 28-point accuracy gain; JIT-Scheduler is 2.4× faster than OpenAI CUA.

Caleb Winston, Ron Yifeng Wang, Azalia Mirhoseini, Christos Kozyrakis. Stanford University.

## Project

- [Project page]({SITE}index.html.md): method, results, and limitations
- [Leaderboard]({SITE}leaderboard.html.md): latency and success of harness and model pairs on 27 REAL tasks
- [Leaderboard data]({SITE}data/leaderboard.csv): CSV with each row's success rule and source

## Paper

- [PMLR](https://proceedings.mlr.press/v306/winston26b.html): Proceedings of ICML 2026, PMLR 306
- [arXiv](https://arxiv.org/abs/2605.21470)
- [PDF]({SITE}paper.pdf)
- [BibTeX]({SITE}assets/citation.bib)

## Code

- [GitHub](https://github.com/agent-jit-compilation/agent-jit-compilation): JIT-Planner, JIT-Scheduler, tool registries, and recorded results

## Optional

- [ICML poster](https://icml.cc/virtual/2026/poster/66062)
"""

(ROOT / 'index.html.md').write_text(page_markdown())
(ROOT / 'leaderboard.html.md').write_text(leaderboard_markdown())
(ROOT / 'llms.txt').write_text(LLMS)
print('Wrote llms.txt, index.html.md, leaderboard.html.md')
