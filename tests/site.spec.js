const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');

test('paper resources, source-backed table and citation', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Agent JIT Compilation for Latency-Optimizing Web Agent Planning and Scheduling | ICML 2026');
  await expect(page.locator('#planner-results .result-row')).toHaveCount(14);
  const csv = fs.readFileSync('data/planner-results.csv', 'utf8').trim().split('\n').slice(1);
  for (const line of csv) {
    const values = line.trim().split(',');
    const row = page.locator('.result-row').filter({ has: page.getByRole('rowheader', { name: values[1], exact: true }) });
    await expect(row).toContainText(Number(values[2]).toFixed(1));
    await expect(row).toContainText(`${Number(values[3])}%`);
    await expect(row).toContainText(Number(values[6]).toFixed(1));
    await expect(row).toContainText(`${Number(values[7])}%`);
  }
  const links = await page.locator('a[href]').evaluateAll(elements => elements.map(el => el.getAttribute('href')).filter(href => !/^(https?:|#)/.test(href)));
  for (const link of new Set(links)) expect((await page.request.get(link)).status(), link).toBe(200);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy BibTeX' }).click();
  await expect(page.getByRole('status')).toHaveText('Citation copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('@inproceedings{winston2026agentjit');
  expect(errors).toEqual([]);
  for (const name of ['planning', 'scheduling', 'scheduler']) {
    if (name !== 'scheduler') await page.locator(`#${name}-interactive`).getByRole('button', {name:'Interactive',exact:true}).click();
    await page.locator(`#${name}-interactive`).screenshot({ path: `test-results/${name}-interactive.png` });
  }
});

for (const width of [1440, 768, 390, 320]) {
  test(`layout and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.images];
      images.forEach(image => image.loading = 'eager');
      await Promise.all(images.map(image => image.decode()));
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({ path: `test-results/page-${width}.png`, fullPage: true });
    await page.screenshot({ path: `test-results/header-${width}.png` });
    for (const name of ['planning','scheduling']) {
      await page.locator(`#${name}-interactive`).getByRole('button',{name:'Interactive',exact:true}).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  });
}

test('all examples and results are readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('h1')).toContainText('Agent JIT Compilation');
  await expect(page.locator('.result-row')).toHaveCount(14);
  await expect(page.getByText('Plan 2 is invalid.', { exact: false })).toBeVisible();
  await expect(page.locator('#bibtex')).toContainText('winston2026agentjit');
  await context.close();
});


test('original diagram steps, plan inspection and scheduling controls', async ({ page }) => {
  await page.goto('/');
  for (const name of ['planning','scheduling']) await page.locator(`#${name}-interactive`).getByRole('button',{name:'Interactive',exact:true}).click();
  await expect(page.getByRole('link', {name:'Ron Yifeng Wang',exact:true})).toHaveAttribute('href','https://ronyw.com/');
  await expect(page.getByRole('link', {name:'Azalia Mirhoseini',exact:true})).toHaveAttribute('href','https://www.azaliamirhoseini.com/');
  await page.getByRole('button', {name:'1. Generation',exact:true}).click();
  await expect(page.locator('#planning-explanation')).toContainText('Candidate generation:');
  await page.getByRole('button', {name:'2. Validation',exact:true}).click();
  await expect(page.locator('#planning-explanation')).toContainText('rejected');
  await page.getByRole('button', {name:'Inspect Plan 2',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#planning-explanation')).toContainText('missing goto_restaurant');
  await page.getByRole('button', {name:'4. Selection',exact:true}).click();
  await expect(page.locator('#planning-explanation')).toContainText('selects Plan 3');
  await page.locator('#planning-play').click();
  await expect(page.getByRole('button', {name:'Pause',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Pause',exact:true}).click();
  await page.getByRole('button', {name:'Illustrate parallel execution',exact:true}).click();
  await expect(page.locator('#schedule-choice')).toHaveValue('parallel');
  await expect(page.locator('#schedule-progress-note')).toContainText('Vendor B');
  await page.locator('#schedule-progress').fill('50');
  await expect(page.locator('#schedule-progress-note')).toContainText('in progress');
  await page.locator('#schedule-choice').selectOption('hedge');
  await expect(page.locator('#schedule-progress-note')).toContainText('cancelled');
  await page.locator('#schedule-play').click();
  await expect(page.locator('#schedule-progress-note')).toContainText('Reduced motion');
});

test('scheduler chart values, legend filtering, focus and tooltip dismissal', async ({ page }) => {
  await page.goto('/');
  const point=page.getByRole('button',{name:'Gemini-2.5-Pro, JIT-Scheduler: 109.9 seconds, 86.4% accuracy',exact:true});
  await point.focus();
  await expect(page.getByRole('tooltip')).toContainText('109.9 s');
  await expect(page.locator('#chart-selection')).toContainText('9.0 s scheduler overhead');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).not.toBeVisible();
  await page.getByRole('button',{name:'Show Gemini-2.5-Pro',exact:true}).click();
  await expect(point).not.toBeVisible();
  await page.getByRole('button',{name:'Show Gemini-2.5-Pro',exact:true}).click();
  await expect(point).toBeVisible();
  await expect(page.locator('#scheduler-chart .chart-point')).toHaveCount(17);
  await expect(page.getByText('Download plotted values')).toHaveCount(0);
  await expect(page.getByText('View plotted values as a table')).toHaveCount(0);
});

test('entering interactive view replays from the beginning and leaving pauses execution', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.clock.install();
  const planning = page.locator('#planning-interactive');
  const scheduling = page.locator('#scheduling-interactive');
  await planning.getByRole('button',{name:'Original',exact:true}).click();
  await planning.getByRole('button',{name:'Interactive',exact:true}).click();
  await expect(page.locator('#planning-play')).toHaveText('Pause');
  await expect(page.locator('#planning-explanation')).toContainText('Candidate generation:');
  await page.clock.runFor(7300);
  await expect(page.locator('#planning-play')).toHaveText('Replay');
  await expect(page.locator('#planning-explanation')).toContainText('Plan selection:');
  await planning.getByRole('button',{name:'Original',exact:true}).click();
  await planning.getByRole('button',{name:'Interactive',exact:true}).click();
  await expect(page.locator('#planning-explanation')).toContainText('Candidate generation:');
  await planning.getByRole('button',{name:'Original',exact:true}).click();
  await page.clock.runFor(3000);
  await expect(page.locator('#planning-play')).toHaveText('Replay');
  await expect(page.locator('#planning-explanation')).toContainText('Candidate generation:');

  await scheduling.getByRole('button',{name:'Original',exact:true}).click();
  await scheduling.getByRole('button',{name:'Interactive',exact:true}).click();
  await expect(page.locator('#schedule-play')).toHaveText('Pause');
  await page.clock.runFor(1000);
  await page.locator('#schedule-progress').fill('20');
  await page.clock.runFor(500);
  await expect(page.locator('#schedule-progress')).toHaveValue('20');
  await expect(page.locator('#schedule-play')).toHaveText('Replay');
  await page.locator('#schedule-play').click();
  await page.clock.runFor(4600);
  await expect(page.locator('#schedule-progress')).toHaveValue('100');
  await expect(page.locator('#schedule-play')).toHaveText('Replay');
  await expect(page.locator('#schedule-progress-note')).toContainText('Worker 2 completes first');
  await scheduling.getByRole('button',{name:'Original',exact:true}).click();
  await scheduling.getByRole('button',{name:'Interactive',exact:true}).click();
  expect(Number(await page.locator('#schedule-progress').inputValue())).toBeLessThan(10);
  await scheduling.getByRole('button',{name:'Original',exact:true}).click();
  const pausedProgress = await page.locator('#schedule-progress').inputValue();
  await page.clock.runFor(5000);
  await expect(page.locator('#schedule-progress')).toHaveValue(pausedProgress);
});

test('touch inspection and mobile figure layouts', async ({ browser }) => {
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173');
  for (const name of ['planning','scheduling']) await page.locator(`#${name}-interactive`).getByRole('button',{name:'Interactive',exact:true}).tap();
  await page.getByRole('button',{name:'2. Validation',exact:true}).tap();
  await expect(page.locator('#planning-explanation')).toContainText('rejected');
  await page.locator('#schedule-choice').selectOption('parallel');
  await expect(page.locator('#schedule-progress-note')).toContainText('Vendor B');
  const point = page.getByRole('button',{name:'GPT-4.1, JIT-Scheduler: 142.6 seconds, 77.8% accuracy',exact:true});
  await point.scrollIntoViewIfNeeded();
  const target = await point.locator('.point-target').boundingBox();
  await page.touchscreen.tap(target.x + target.width/2,target.y + target.height/2);
  await expect(page.locator('#chart-selection')).toContainText('GPT-4.1 — JIT-Scheduler: 142.6 s');
  for (const name of ['planning','scheduling','scheduler']) {
    await page.locator(`#${name}-interactive`).screenshot({path:`test-results/${name}-mobile.png`});
  }
  await context.close();
});

test('all figures default to interactive and share the original/interactive toggle', async ({page}) => {
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('/');
  for (const name of ['planning','scheduling','scheduler','protocol','efficiency']) {
    const figure = page.locator(`#${name}-interactive`);
    await expect(figure.locator('.static-figure')).not.toBeVisible();
    await expect(figure.locator('.interactive-mount')).toBeVisible();
    await expect(figure.getByRole('button',{name:'Interactive',exact:true})).toHaveAttribute('aria-pressed','true');
    if (['planning','scheduling'].includes(name)) await expect(figure.locator('.original-diagram')).toHaveCSS('color-scheme','light');
    await figure.screenshot({path:`test-results/${name}-dark-preference.png`});
    await figure.getByRole('button',{name:'Original',exact:true}).click();
    await expect(figure.locator('.static-figure')).toBeVisible();
    await expect(figure.locator('.interactive-mount')).not.toBeVisible();
    await figure.getByRole('button',{name:'Interactive',exact:true}).click();
    await expect(figure.locator('.interactive-mount')).toBeVisible();
    await expect(figure.locator('.static-figure')).not.toBeVisible();
  }
});

test('walkthroughs wait for viewport entry and do not restart on ordinary scrolling', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.clock.install();
  await page.goto('/');
  await page.clock.runFor(8000);
  await expect(page.locator('#planning-play')).toHaveText('Replay');
  await expect(page.locator('#schedule-play')).toHaveText('Replay');
  for (const name of ['planning','scheduling']) {
    const figure = page.locator(`#${name}-interactive`);
    const play = page.locator(name === 'planning' ? '#planning-play' : '#schedule-play');
    await figure.scrollIntoViewIfNeeded();
    await expect(play).toHaveText('Pause');
    if (name === 'planning') await expect(page.locator('#planning-explanation')).toContainText('Candidate generation:');
    else expect(Number(await page.locator('#schedule-progress').inputValue())).toBeLessThan(10);
    await page.clock.runFor(7500);
    await expect(play).toHaveText('Replay');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.clock.runFor(100);
    await figure.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    await expect(play).toHaveText('Replay');
  }
});

test('reduced motion keeps viewport playback manual', async ({page}) => {
  await page.goto('/');
  for (const name of ['planning','scheduling']) {
    await page.locator(`#${name}-interactive`).scrollIntoViewIfNeeded();
    await expect(page.locator(name === 'planning' ? '#planning-play' : '#schedule-play')).toHaveText('Replay');
  }
  await expect(page.locator('#schedule-progress')).toHaveValue('100');
});

test('protocol points inspect both conditions and model selection can be cleared', async ({page}) => {
  await page.goto('/');
  const figure = page.locator('#protocol-interactive');
  await expect(figure.locator('.chart-point')).toHaveCount(14);
  await figure.getByRole('button',{name:'Highlight Gemini-2.5-Pro',exact:true}).click();
  await expect(figure.locator('#protocol-readout')).toContainText('With protocol: 10.30 s · 94.4% (816/864 valid plans)');
  await expect(figure.locator('#protocol-readout')).toContainText('Without protocol: 11.34 s · 79.3% (685/864 valid plans)');
  await expect(figure.locator('[data-plot-model="GPT-4.1"]').first()).toHaveCSS('opacity','0.16');
  await page.keyboard.press('Escape');
  await expect(figure.locator('[data-plot-model="GPT-4.1"]').first()).toHaveCSS('opacity','1');
  await figure.locator('.chart-point').first().focus();
  await expect(figure.locator('#protocol-readout')).toContainText('GPT-OSS-120B');
});

test('efficiency panels share model selection and expose keyboard budgets', async ({page}) => {
  await page.goto('/');
  const figure = page.locator('#efficiency-interactive');
  await figure.getByRole('button',{name:'Highlight Gemini-2.5-Pro',exact:true}).click();
  await expect(figure.locator('#pass-k-readout')).toContainText('Without protocol: 9.4%');
  await expect(figure.locator('#pass-t-readout')).toContainText('Gemini-2.5-Pro');
  const k = figure.getByRole('slider',{name:'Candidate budget k',exact:true});
  await k.focus(); await page.keyboard.press('Home');
  await expect(k).toHaveAttribute('aria-valuenow','1');
  await expect(figure.locator('#pass-k-readout')).toContainText('Without protocol: 3.1%');
  await page.keyboard.press('End');
  await expect(figure.locator('#pass-k-readout')).toContainText('Without protocol: 100.0%');
  const t = figure.getByRole('slider',{name:'Time budget in seconds',exact:true});
  await t.focus(); await page.keyboard.press('End');
  await expect(figure.locator('#pass-t-readout')).toContainText('Without protocol: 22.4%');
  await figure.getByRole('button',{name:'Highlight GPT-5',exact:true}).click();
  await expect(figure.locator('#pass-k-readout')).toContainText('GPT-5');
  await expect(figure.locator('#pass-t-readout')).toContainText('Without protocol: 40.3%');
  await figure.getByRole('button',{name:'Highlight GPT-5',exact:true}).click();
  await expect(figure.locator('.efficiency-curve').first()).toHaveCSS('opacity','1');
});
