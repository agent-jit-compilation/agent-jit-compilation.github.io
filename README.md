# Agent JIT Compilation project website

An academic project page for **Agent JIT Compilation for Latency-Optimizing Web Agent Planning and Scheduling**, ICML 2026.

The site adapts the [Nerfies project-page template](https://github.com/nerfies/nerfies.github.io), also used by OpenVLA. It uses the template's Bulma 0.9.1 stylesheet, a centered publication header, ordinary section headings, paper figures, worked examples, static results tables, and BibTeX. Template attribution appears in the footer.

## Preview

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://localhost:4173. No build step or runtime package installation is required. Fonts and CSS are self-hosted. The paper, examples, and all results work without JavaScript; JavaScript adds optional figure interactions, hoverable result plots, and citation copying. All five enhanced figures default to Interactive and share an Original / Interactive toggle. Planning and scheduling walkthroughs start on first viewport entry; reduced-motion preferences keep playback manual.

## Content

- `index.html`: paper identity, abstract, original figures, worked planning and scheduling examples, static Table 1 results, limitations and citation.
- `styles.css`: small adaptations to the academic template.
- `assets/vendor/bulma.min.css`: Bulma 0.9.1 from the Nerfies template.
- `script.js`: citation copying with a selection fallback.
- `interactions.js`: opt-in planning and scheduling explanations, plus the SVG scheduler chart.
- `data/figure-art.js`: original SVG artwork from the paper source.
- `data/plot-data.js` and `data/scheduler-results.json`: exact scheduler plot aggregates.
- `scripts/prepare-interactive-assets.py`: regenerate artwork and scheduler values from the sibling camera-ready source directory, without running benchmarks.
- `data/planner-results.csv`: published Table 1 aggregates.
- `docs/content-provenance.md`: source mapping and interpretation notes.

Results are from the supplied paper, not a new reproduction. Planner and scheduler are evaluated separately. No public research-artifact URL was supplied, so no Code link to a private backup or unrelated repository is shown.

## Verify

```sh
npm ci
npx playwright install chromium
npm test
```

The suite checks table values against the CSV, local resource links, clipboard copying, JavaScript-disabled readability, figure switching, first-viewport playback, step and timeline controls, hover/focus/touch inspection, light artwork under a dark OS preference, reduced motion, page overflow, and automated WCAG A/AA accessibility at 320, 390, 768, and 1440 pixels. Screenshots are written to the ignored `test-results/` directory.

## Deployment

`.github/workflows/pages.yml` builds the static site on pull requests and deploys it to GitHub Pages when changes reach `main`. A manual run on `main` can also redeploy the site. Set **Settings → Pages → Source** to **GitHub Actions**. Private repositories require a GitHub plan that supports Pages.

The deployment artifact contains only the HTML, CSS, JavaScript, paper PDF, assets, figure data, robots.txt, and sitemap.xml. Repository maintenance files (`README.md`, `docs/`, tests, scripts, and package manifests) are excluded. No separate deployment repository or `gh-pages` branch is needed.

## Search and sharing metadata

The canonical URL is `https://agent-jit-compilation.github.io/`, matching the repository's organization-site remote. `index.html` includes the full paper title, a search description, OpenGraph/Twitter cards using the architecture figure, citation tags, and ScholarlyArticle JSON-LD. The JSON-LD abstract mirrors the visible abstract; update both when revising it. No hidden FAQ or related-work keyword text is included.

`paper.pdf` is an unchanged copy of the publisher PDF supplied as `~/Downloads/winston26b.pdf`. The citation PDF URL points to this same-host copy, following Google Scholar's inclusion guidance; the publisher's landing page and arXiv record remain in `sameAs`. The PMLR PDF URL could not be verified. GitHub research-artifact and Hugging Face URLs are omitted until public destinations are available. Author homepage URLs match the visible byline; Caleb's and Azalia's Scholar links come from their homepages.

`robots.txt` permits crawling and advertises `sitemap.xml`, which lists the page and PDF. If the production domain changes, update the canonical URL, absolute metadata/image/PDF URLs, JSON-LD identifiers, sitemap, and robots sitemap URL together.

After publishing, verify the production URLs and preview image, register the URL-prefix property in Google Search Console and the site in Bing Webmaster Tools, add their issued verification meta tags to the HTML head, and submit `https://agent-jit-compilation.github.io/sitemap.xml`. Verification tokens have not been supplied and no search-engine submission has been performed. Metadata and a sitemap do not guarantee indexing or rankings.

References: [Google Scholar inclusion](https://scholar.google.com/intl/en/scholar/inclusion.html), [structured-data guidance](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Attribution and licenses

The adapted website template is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with attribution to the [Nerfies authors](https://nerfies.github.io/). Changes replace the publication content and omit unused video, carousel, analytics, and navigation code. Bulma is MIT-licensed; its license is included under `assets/vendor/`. Noto Sans is distributed under the SIL Open Font License, included under `assets/fonts/`. The template license does not change ownership or licensing of the supplied paper and figures.
