# Agent JIT Compilation leaderboard

We evaluate each (harness, model) pair on 27 REAL tasks (Dashdish, Gomail, Omnizon) with three runs each. Latency is mean end-to-end seconds per task; success is the share of runs that pass. Ranked by latency.

| # | Harness | Model | Latency (s) | Success |
|---|---|---|---|---|
| 1 | JIT-Planner (Pareto optimal) | Gemini-2.5-Flash | 8.3 | 92.6% |
| 2 | JIT-Planner | Gemini-2.5-Pro | 14.3 | 92.6% |
| 3 | JIT-Planner (Pareto optimal) | GPT-6.1 Terra | 17.7 | 95.1% |
| 4 | JIT-Planner | GPT-4.1 | 17.8 | 92.6% |
| 5 | CUA +cache | GPT-5.4 | 36.2 | 95.0% |
| 6 | Browser-Use +cache | GPT-6.1 Terra | 39.4 | 88.9% |
| 7 | Claude Code | Claude Sonnet 5.5 | 64.7 | 92.6% |
| 8 | Browser-Use +cache | Gemini-2.5-Pro | 69.7 | 82.7% |
| 9 | Browser-Use +cache | Gemini-2.5-Flash | 70.2 | 76.5% |
| 10 | Browser-Use | Gemini-2.5-Flash | 96.5 | 55.6% |
| 11 | Browser-Use +cache | GPT-4.1 | 104.4 | 85.2% |
| 12 | JIT-Scheduler | Gemini-2.5-Pro | 109.9 | 86.4% |
| 13 | JIT-Scheduler | Gemini-2.5-Flash | 118.4 | 60.5% |
| 14 | Browser-Use | Gemini-2.5-Pro | 129.6 | 70.4% |
| 15 | Vendor CUA | Claude Sonnet 4 | 141.7 | 79.0% |
| 16 | JIT-Scheduler | GPT-4.1 | 142.6 | 77.8% |
| 17 | Browser-Use | GPT-4.1 | 157.3 | 58.0% |
| 18 | Vendor CUA | computer-use-preview | 258.7 | 77.8% |

## Harnesses

| Harness | Tools | Control | Schedule |
|---|---|---|---|
| JIT-Planner | Synthesized | Compiled | Serial |
| CUA +cache | Synthesized | Per-step | Serial |
| Browser-Use +cache | Synthesized | Per-step | Serial |
| Claude Code | Primitives | Per-step | Serial |
| Browser-Use | Primitives | Per-step | Serial |
| JIT-Scheduler | Primitives | Per-step | Adaptive |
| Vendor CUA | Pixels | Per-step | Serial |

- Tools: reusable app tools (Synthesized), browser actions (Primitives), or screenshots (Pixels).
- Control: the model picks each action (Per-step), or a checked program runs (Compiled).
- Schedule: one browser (Serial), or serial, parallel, or hedged per task (Adaptive).

Data: [leaderboard.csv](https://agent-jit-compilation.github.io/data/leaderboard.csv), with each row's success rule and source. Paper: [project page](https://agent-jit-compilation.github.io/index.html.md).
