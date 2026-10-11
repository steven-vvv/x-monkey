/**
 * Screenshot runner: `pnpm run preview:shoot -- --out <dir> [--only a,b] [--list]`.
 * Starts the preview dev server, drives system Chromium through playwright-core.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium, type Locator, type Page } from 'playwright-core';
import { scenarios, type Scenario, type Step } from './scenarios';

const CHROMIUM = '/usr/bin/chromium-browser';
const STEP_TIMEOUT_MS = 5000;
const PANEL_MARGIN = 16;

function parseArgs(argv: string[]): { out?: string; only?: string[]; list: boolean } {
  const result: { out?: string; only?: string[]; list: boolean } = { list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--list') result.list = true;
    else if (arg === '--out') result.out = argv[++i];
    else if (arg === '--only') result.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

async function target(page: Page, scenario: Scenario, selector: string, what: string): Promise<Locator> {
  const locator = page.locator(selector).first();
  try {
    await locator.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
  } catch {
    throw new Error(`scenario "${scenario.name}": ${what} selector not found or not visible: ${selector}`);
  }
  return locator;
}

async function runStep(page: Page, scenario: Scenario, step: Step): Promise<void> {
  if ('click' in step) await (await target(page, scenario, step.click, 'click')).click();
  else if ('hover' in step) await (await target(page, scenario, step.hover, 'hover')).hover();
  else if ('fill' in step) await (await target(page, scenario, step.fill[0], 'fill')).fill(step.fill[1]);
  else if ('press' in step) await page.keyboard.press(step.press);
  else if ('wait' in step) await page.waitForTimeout(step.wait);
  else if ('scroll' in step) {
    const locator = await target(page, scenario, step.scroll[0], 'scroll');
    await locator.evaluate((el, top) => { el.scrollTop = top; }, step.scroll[1]);
  }
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

async function shoot(base: string, browser: Awaited<ReturnType<typeof chromium.launch>>, scenario: Scenario, outDir: string): Promise<string> {
  const viewport = scenario.viewport ?? { width: 1100, height: 760 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: scenario.dpr ?? 1 });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console.error: ${message.text()}`); });

  try {
    await page.goto(`${base}/?${new URLSearchParams(scenario.query).toString()}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => (window as unknown as { __xmReady?: boolean }).__xmReady === true, undefined, { timeout: 15000 });
    } catch {
      throw new Error(`scenario "${scenario.name}": preview never became ready. ${problems.join(' | ')}`);
    }
    await settle(page);

    const classic = scenario.query.ui === 'classic';
    if (!scenario.collapsed) {
      await (await target(page, scenario, classic ? '.xd-bubble' : '.xm-launcher', 'launcher')).click();
      await settle(page);
    }
    for (const step of scenario.steps ?? []) {
      await runStep(page, scenario, step);
    }
    await settle(page);

    const file = resolve(outDir, `${scenario.name}.png`);
    const clipMode = scenario.clip ?? (scenario.collapsed ? 'page' : 'panel');
    if (clipMode === 'panel') {
      const panel = await target(page, scenario, '.xm-panel, .xd-panel', 'panel');
      const box = await panel.boundingBox();
      if (!box) throw new Error(`scenario "${scenario.name}": panel has no bounding box`);
      const x = Math.max(0, Math.floor(box.x - PANEL_MARGIN));
      const y = Math.max(0, Math.floor(box.y - PANEL_MARGIN));
      const width = Math.min(viewport.width - x, Math.ceil(box.width + PANEL_MARGIN * 2));
      const height = Math.min(viewport.height - y, Math.ceil(box.height + PANEL_MARGIN * 2));
      await page.screenshot({ path: file, clip: { x, y, width, height } });
    } else {
      await page.screenshot({ path: file });
    }
    for (const problem of problems) console.warn(`  [${scenario.name}] ${problem}`);
    return file;
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    for (const scenario of scenarios) console.log(scenario.name);
    return;
  }
  if (!args.out) throw new Error('Missing --out <dir>');
  const outDir = resolve(args.out);
  const selected = args.only ? scenarios.filter((scenario) => args.only!.includes(scenario.name)) : scenarios;
  const unknown = (args.only ?? []).filter((name) => !scenarios.some((scenario) => scenario.name === name));
  if (unknown.length) throw new Error(`Unknown scenario(s): ${unknown.join(', ')}`);
  mkdirSync(outDir, { recursive: true });

  // PREVIEW_PORT lets several shoot runs share the machine.
  const port = Number(process.env.PREVIEW_PORT ?? 5180);
  const server = await createServer({
    configFile: resolve(process.cwd(), 'vite.preview.config.ts'),
    logLevel: 'warn',
    server: { port },
  });
  await server.listen();
  const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://127.0.0.1:5180';
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
  let failed = false;
  try {
    for (const scenario of selected) {
      try {
        console.log(`${scenario.name} -> ${await shoot(base, browser, scenario, outDir)}`);
      } catch (error) {
        failed = true;
        console.error(`FAILED ${scenario.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
