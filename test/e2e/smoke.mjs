// Real-browser smoke test — loads the ACTUAL built extension in Chromium via
// Playwright and drives every "ready" tool end-to-end (worker-routed,
// main-thread-routed, and custom-view tools alike). This exists because a
// real, systemic bug (Vite's automatic modulePreload helper touching
// `document` inside engine.worker.js, breaking almost every tool) was
// invisible to vitest: vitest runs engine files directly in Node, never
// exercising the actual bundled worker or a real Worker/browser environment.
//
// Run `npm run build` first, then `npm run test:e2e`.
// Requires `npx playwright install chromium` once.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildAllFixtures } from './fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXT_PATH = path.join(ROOT, 'dist');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'opendoc-e2e-'));

if (!fs.existsSync(path.join(EXT_PATH, 'app.html'))) {
  console.error('dist/ not found — run `npm run build` before `npm run test:e2e`.');
  process.exit(1);
}

const fx = await buildAllFixtures(path.join(SCRATCH, 'fixtures'));

const context = await chromium.launchPersistentContext(path.join(SCRATCH, 'profile'), {
  headless: false,
  args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-first-run']
});

let sw = context.serviceWorkers()[0];
if (!sw) sw = await context.waitForEvent('serviceworker');
const extId = sw.url().split('/')[2];

const page = await context.newPage();
const consoleErrorsByTool = {};
let currentTool = '(startup)';
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    (consoleErrorsByTool[currentTool] ??= []).push(msg.text().split('\n')[0]);
  }
});
page.on('pageerror', (err) => {
  (consoleErrorsByTool[currentTool] ??= []).push(`pageerror: ${err.message}`);
});

const results = [];

async function fillTextOption(labelText, value) {
  await page.locator('label.field', { hasText: labelText }).locator('input').fill(value);
}
async function selectOption(labelText, value) {
  await page.locator('label.field', { hasText: labelText }).locator('select').selectOption(value);
}
async function checkOption(labelText) {
  await page.locator('label.field', { hasText: labelText }).locator('input[type=checkbox]').check();
}

async function waitForResult(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Success/failure detection is class-based (.alert-success / .alert-error),
    // not string-matching — every view uses these two classes consistently,
    // but each has its own wording ("Berhasil diproses", "siap diunduh",
    // "Selesai memproses", ...), so matching on text like "erhasil" produced
    // false-negative timeouts for measure.js/automation.js during development.
    const successCount = await page.locator('.result-area .alert-success').count();
    const errorCount = await page.locator('.result-area .alert-error').count();
    if (successCount > 0 || errorCount > 0) {
      return (await page.locator('.result-area').textContent().catch(() => '')) || '';
    }
    await page.waitForTimeout(250);
  }
  return (await page.locator('.result-area').textContent().catch(() => '')) || '(timed out)';
}

async function isSuccess() {
  return (await page.locator('.result-area .alert-success').count()) > 0;
}

async function runTool(toolId, files, { fillOptions, timeoutMs } = {}) {
  currentTool = toolId;
  await page.goto(`chrome-extension://${extId}/app.html#/tool/${toolId}`);
  await page.waitForTimeout(500);
  await page.locator('input[type=file]').first().setInputFiles(files);
  await page.waitForTimeout(300);
  if (fillOptions) await fillOptions();
  await page.click('button:has-text("Proses")');
  const text = await waitForResult(timeoutMs ?? 25000);
  const ok = await isSuccess();
  results.push({ toolId, ok, text: text.replace(/\s+/g, ' ').trim().slice(0, 140) });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${toolId}: ${text.replace(/\s+/g, ' ').trim().slice(0, 140)}`);
}

// ---- PDF organize ----
await runTool('merge-pdf', [fx.pdf, fx.pdf]);
await runTool('split-pdf', fx.pdf);
await runTool('rotate-pages', fx.pdf);
await runTool('bates-numbering', [fx.pdf, fx.pdf]);

// ---- Edit ----
await runTool('add-watermark-text', fx.pdf);
await runTool('add-page-numbers', fx.pdf);
await runTool('header-footer', fx.pdf);
await runTool('edit-metadata', fx.pdf);
await runTool('compress-pdf', fx.pdf);

// ---- Convert ----
await runTool('pdf-to-word', fx.pdf);
await runTool('word-to-pdf', fx.docx);
await runTool('pdf-to-ppt', fx.pdf);
await runTool('ppt-to-pdf', fx.pptx);
await runTool('pdf-to-excel', fx.pdf);
await runTool('excel-to-pdf', fx.xlsx);
await runTool('pdf-to-image', fx.pdf);
await runTool('image-to-pdf', fx.png);
await runTool('pdf-to-html', fx.pdf);
await runTool('html-to-pdf', fx.html);
await runTool('pdf-to-text', fx.pdf);
await runTool('text-to-pdf', fx.txt);
await runTool('pdf-to-pdfa', fx.pdf);
await runTool('excel-to-csv', fx.xlsx);
await runTool('csv-to-excel', fx.csv);
await runTool('excel-to-sav', fx.xlsx);
await runTool('sav-to-excel', fx.sav);
await runTool('archive-to-zip', fx.archive);

// ---- Security ----
await runTool('protect-pdf', fx.pdf, { fillOptions: () => fillTextOption('Kata sandi pembuka', 'test1234') });
await runTool('remove-password', fx.protectedPdf, { fillOptions: () => fillTextOption('Kata sandi', 'rahasia123') });
await runTool('redact-pdf', fx.pdf, { fillOptions: () => fillTextOption('Kata/frasa yang diredaksi', 'Halaman') });
await runTool('redact-pdf', fx.emailPdf, { fillOptions: () => checkOption('Deteksi & redaksi alamat email') });
await runTool('sanitize-pdf', fx.pdf);

// ---- OCR (bundled WASM + trained data — real risk area, needs more time) ----
await runTool('ocr-searchable-pdf', fx.pdf, { fillOptions: () => selectOption('Bahasa', 'eng'), timeoutMs: 60000 });
await runTool('ocr-extract-text', fx.pdf, { fillOptions: () => selectOption('Bahasa', 'eng'), timeoutMs: 60000 });

// ---- Sign / comment ----
await runTool('export-form-data', fx.withFormPdf);
await runTool('verify-signature', fx.signedPdf);

// ---- Accessibility / portfolio / compare ----
await runTool('accessibility-checker', fx.pdf);
await runTool('compare-pdf', [fx.pdf, fx.pdf]);
await runTool('portfolio-builder', [fx.pdf, fx.png]);

// ---- Custom-view tools: real canvas-click interaction, not just load checks ----
currentTool = 'measure-tool';
await page.goto(`chrome-extension://${extId}/app.html#/tool/measure-tool`);
await page.waitForTimeout(500);
page.once('dialog', (d) => d.accept('100'));
await page.locator('input[type=file]').first().setInputFiles(fx.pdf);
await page.waitForTimeout(1200);
await page.locator('.pdf-canvas').waitFor({ state: 'visible', timeout: 5000 });
{
  const box = await page.locator('.pdf-canvas').boundingBox();
  await page.mouse.click(box.x + 50, box.y + 50);
  await page.mouse.click(box.x + 150, box.y + 50); // calibration: triggers the prompt() dialog above
  await page.waitForTimeout(300);
  await page.click('button:has-text("Ukur Jarak")');
  await page.mouse.click(box.x + 60, box.y + 100);
  await page.mouse.click(box.x + 160, box.y + 100);
  await page.waitForTimeout(300);
  await page.click('button:has-text("Ekspor PDF Beranotasi")');
  const text = await waitForResult(10000);
  const ok = await isSuccess();
  results.push({ toolId: 'measure-tool', ok, text: text.replace(/\s+/g, ' ').trim() });
  console.log(`${ok ? 'PASS' : 'FAIL'} measure-tool: ${text.replace(/\s+/g, ' ').trim()}`);
}

currentTool = 'extract-pages';
await page.goto(`chrome-extension://${extId}/app.html#/tool/extract-pages`);
await page.waitForTimeout(500);
await page.locator('input[type=file]').first().setInputFiles(fx.pdf);
await page.waitForTimeout(1200);
await page.locator('.page-picker-thumb').first().waitFor({ state: 'visible', timeout: 5000 });
{
  // fx.pdf has 3 pages — click the first two thumbnails to select them.
  await page.locator('.page-picker-thumb').nth(0).click();
  await page.locator('.page-picker-thumb').nth(1).click();
  await page.click('button:has-text("Proses")');
  const text = await waitForResult(10000);
  const ok = await isSuccess();
  results.push({ toolId: 'extract-pages', ok, text: text.replace(/\s+/g, ' ').trim() });
  console.log(`${ok ? 'PASS' : 'FAIL'} extract-pages: ${text.replace(/\s+/g, ' ').trim()}`);
}

currentTool = 'delete-pages';
await page.goto(`chrome-extension://${extId}/app.html#/tool/delete-pages`);
await page.waitForTimeout(500);
await page.locator('input[type=file]').first().setInputFiles(fx.pdf);
await page.waitForTimeout(1200);
await page.locator('.page-picker-thumb').first().waitFor({ state: 'visible', timeout: 5000 });
{
  await page.locator('.page-picker-thumb').nth(0).click();
  await page.click('button:has-text("Proses")');
  const text = await waitForResult(10000);
  const ok = await isSuccess();
  results.push({ toolId: 'delete-pages', ok, text: text.replace(/\s+/g, ' ').trim() });
  console.log(`${ok ? 'PASS' : 'FAIL'} delete-pages: ${text.replace(/\s+/g, ' ').trim()}`);
}

currentTool = 'markup-highlight-ink';
await page.goto(`chrome-extension://${extId}/app.html#/tool/markup-highlight-ink`);
await page.waitForTimeout(500);
await page.locator('input[type=file]').first().setInputFiles(fx.pdf);
await page.waitForTimeout(1200);
await page.locator('.pdf-canvas-overlay').waitFor({ state: 'visible', timeout: 5000 });
{
  const box = await page.locator('.pdf-canvas-overlay').boundingBox();
  // Highlight mode is the default: drag a rectangle.
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 60, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  // Switch to ink mode and drag a freehand stroke.
  await page.click('button:has-text("Coret Tangan")');
  await page.mouse.move(box.x + 50, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 100, { steps: 3 });
  await page.mouse.move(box.x + 130, box.y + 130, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  // Switch to sticky-note mode and place one via a single click — this
  // prompts twice in a row (note text, then author), so a persistent
  // handler (not once()) is needed to catch both in sequence.
  await page.click('button:has-text("Catatan Tempel")');
  let stickyDialogCount = 0;
  const stickyDialogHandler = (d) => {
    stickyDialogCount += 1;
    d.accept(stickyDialogCount === 1 ? 'Catatan uji' : '');
  };
  page.on('dialog', stickyDialogHandler);
  await page.mouse.click(box.x + 200, box.y + 60);
  await page.waitForTimeout(300);
  page.off('dialog', stickyDialogHandler);
  await page.click('button:has-text("Terapkan & Unduh PDF")');
  const text = await waitForResult(10000);
  const ok = await isSuccess();
  results.push({ toolId: 'markup-highlight-ink', ok, text: text.replace(/\s+/g, ' ').trim() });
  console.log(`${ok ? 'PASS' : 'FAIL'} markup-highlight-ink: ${text.replace(/\s+/g, ' ').trim()}`);
}

currentTool = 'edit-page-text';
await page.goto(`chrome-extension://${extId}/app.html#/tool/edit-page-text`);
await page.waitForTimeout(500);
await page.locator('input[type=file]').first().setInputFiles(fx.pdf);
await page.waitForTimeout(1200);
// fx.pdf has 3 pages — the view now renders all of them, so target page 1 explicitly.
await page.locator('.pdf-canvas').first().waitFor({ state: 'visible', timeout: 5000 });
{
  const box = await page.locator('.pdf-canvas').first().boundingBox();
  // fx.pdf's fixture text is drawn at (40, 150) on a 300x300 page, scale 1.4 —
  // click comfortably inside its rendered box rather than right at an edge.
  await page.mouse.click(box.x + 100, box.y + (300 - 150 - 8) * 1.4);
  // A floating <input> should now be positioned over the clicked run.
  await page.locator('.edit-text-inline-input').waitFor({ state: 'visible', timeout: 3000 });
  await page.locator('.edit-text-inline-input').fill('Halaman 1 sudah diedit');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Terapkan & Unduh PDF")');
  const text = await waitForResult(10000);
  const ok = await isSuccess();
  results.push({ toolId: 'edit-page-text', ok, text: text.replace(/\s+/g, ' ').trim() });
  console.log(`${ok ? 'PASS' : 'FAIL'} edit-page-text: ${text.replace(/\s+/g, ' ').trim()}`);
}

currentTool = 'fill-sign';
await page.goto(`chrome-extension://${extId}/app.html#/tool/fill-sign`);
await page.waitForTimeout(500);
await page.locator('input[type=file]').first().setInputFiles(fx.pdf);
await page.waitForTimeout(1200);
await page.locator('.pdf-canvas').waitFor({ state: 'visible', timeout: 5000 });
{
  const box = await page.locator('.pdf-canvas').boundingBox();
  // Text mode is the default; the text field already has a value, so a
  // click alone places a signature item.
  await page.mouse.click(box.x + 90, box.y + 90);
  await page.waitForTimeout(300);
  await page.click('button:has-text("Terapkan & Unduh PDF")');
  const text = await waitForResult(10000);
  const ok = await isSuccess();
  results.push({ toolId: 'fill-sign', ok, text: text.replace(/\s+/g, ' ').trim() });
  console.log(`${ok ? 'PASS' : 'FAIL'} fill-sign: ${text.replace(/\s+/g, ' ').trim()}`);
}

currentTool = 'forms-designer';
await page.goto(`chrome-extension://${extId}/app.html#/tool/forms-designer`);
await page.waitForTimeout(500);
await page.locator('input[type=file]').first().setInputFiles(fx.pdf);
await page.waitForTimeout(1200);
await page.locator('.pdf-canvas').waitFor({ state: 'visible', timeout: 5000 });
{
  const box = await page.locator('.pdf-canvas').boundingBox();
  await page.mouse.click(box.x + 80, box.y + 80); // places a text field (default type)
  await page.waitForTimeout(300);
  await page.click('button:has-text("Terapkan & Unduh PDF")');
  const text = await waitForResult(10000);
  const ok = await isSuccess();
  results.push({ toolId: 'forms-designer', ok, text: text.replace(/\s+/g, ' ').trim() });
  console.log(`${ok ? 'PASS' : 'FAIL'} forms-designer: ${text.replace(/\s+/g, ' ').trim()}`);
}

currentTool = 'automation-wizard';
await page.goto(`chrome-extension://${extId}/app.html#/tool/automation-wizard`);
await page.waitForTimeout(500);
await page.locator('.automation-add-row select').selectOption({ index: 0 });
await page.click('button:has-text("+ Tambah Langkah")');
await page.waitForTimeout(300);
await page.locator('input[type=file]').first().setInputFiles(fx.pdf);
await page.waitForTimeout(300);
await page.click('button:has-text("Jalankan Batch")');
{
  const text = await waitForResult(15000);
  const ok = await isSuccess();
  results.push({ toolId: 'automation-wizard', ok, text: text.replace(/\s+/g, ' ').trim() });
  console.log(`${ok ? 'PASS' : 'FAIL'} automation-wizard: ${text.replace(/\s+/g, ' ').trim()}`);
}

// digital-signature has a different button label ("Tanda Tangani"), so it
// can't use the generic runTool() helper — handled explicitly here.
currentTool = 'digital-signature';
await page.goto(`chrome-extension://${extId}/app.html#/tool/digital-signature`);
await page.waitForTimeout(500);
await page.locator('input[type=file]').first().setInputFiles(fx.pdf);
await page.waitForTimeout(300);
await page.click('button:has-text("Tanda Tangani")');
const signText = await waitForResult();
const signOk = await isSuccess();
results.push({ toolId: 'digital-signature', ok: signOk, text: signText.replace(/\s+/g, ' ').trim() });
console.log(`${signOk ? 'PASS' : 'FAIL'} digital-signature: ${signText.replace(/\s+/g, ' ').trim()}`);

await context.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed.`);
if (failed.length) {
  console.log('\nFailures:');
  failed.forEach((r) => console.log(` - ${r.toolId}: ${r.text}`));
  process.exit(1);
}
console.log('All tools passed.');
