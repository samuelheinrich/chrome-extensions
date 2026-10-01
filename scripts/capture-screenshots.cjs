const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const projectRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(projectRoot, 'docs/demo-bookmarks.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const outputDir = path.join(projectRoot, 'docs/screenshots');
const baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:5173';
const executablePath = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);

async function installDemoApi(page) {
  await page.addInitScript(({ fixture }) => {
    const roots = structuredClone(fixture.roots);
    const storage = { bookmarkGenieTags: structuredClone(fixture.tags) };
    let nextId = 100;
    const find = (id, nodes = roots) => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const child = find(id, node.children || []);
        if (child) return child;
      }
    };
    const reindex = node => node.children?.forEach((child, index) => { child.index = index; reindex(child); });
    roots.forEach(reindex);
    const runtime = { getURL: value => new URL(value, location.origin).href };
    window.chrome = {
      runtime,
      bookmarks: {
        getTree: done => done(structuredClone(roots)),
        update: (id, changes, done) => { Object.assign(find(id), changes); done(structuredClone(find(id))); },
        create: (details, done) => {
          const parent = find(details.parentId);
          const node = { id: String(nextId++), ...details, ...(details.url ? {} : { children: [] }) };
          parent.children.splice(details.index ?? parent.children.length, 0, node);
          reindex(parent);
          done(structuredClone(node));
        },
        move: (id, target, done) => {
          const node = find(id);
          const oldParent = find(node.parentId);
          oldParent.children = oldParent.children.filter(child => child.id !== id);
          const parent = find(target.parentId);
          parent.children.splice(target.index ?? parent.children.length, 0, node);
          node.parentId = parent.id;
          reindex(oldParent);
          reindex(parent);
          done(structuredClone(node));
        },
        remove: (id, done) => { const node = find(id); const parent = find(node.parentId); parent.children = parent.children.filter(child => child.id !== id); reindex(parent); done(); },
        removeTree: (id, done) => window.chrome.bookmarks.remove(id, done)
      },
      storage: { local: {
        get: (key, done) => done({ [key]: structuredClone(storage[key]) }),
        set: (values, done) => { Object.assign(storage, structuredClone(values)); done(); }
      } },
      permissions: { contains: (_details, done) => done(true), request: (_details, done) => done(true) },
      tabs: { create: (_details, done) => done?.() },
      windows: { getCurrent: done => done({ width: 3100, height: 900 }) }
    };
    localStorage.setItem('bookmarkWizardColumnWidths', JSON.stringify([34, 290, 330, 100, 90, 212]));
    // Only fictional requests are simulated; no bookmark website is contacted.
    window.fetch = async input => {
      const url = String(input);
      if (url.includes('slow.example')) {
        throw new DOMException('Simulated timeout', 'AbortError');
      }
      return new Response(null, { status: url.includes('archive.example') ? 404 : 200 });
    };
  }, { fixture });
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1760, height: 980 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await installDemoApi(page);
    await page.goto(baseUrl);
    const tab = name => page.locator('.inspector-tabs').getByRole('button', { name, exact: true });
    const openFolder = async name => {
      await page.locator('.tree-panel .node-title').filter({ hasText: new RegExp(`^${name}$`) }).click();
    };
    const row = name => page.locator('.file-row.bookmark-row').filter({ has: page.locator('.name-button').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
    const capture = async (filename, target = page.locator('.app-shell')) => {
      await page.evaluate(() => document.fonts.ready);
      await target.screenshot({ path: path.join(outputDir, filename), animations: 'disabled' });
      console.log(`Captured ${filename}`);
    };
    const settleToasts = async () => {
      await page.locator('.toast').first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    };

    await openFolder('Demo Bookmarks');
    await tab('Help').click();
    await capture('01-overview.png');

    await openFolder('Networking');
    await row('Wireless planning guide').locator('.url-cell').click();
    const editor = page.getByRole('form', { name: 'Edit bookmark' });
    await editor.getByLabel('Name', { exact: true }).fill('Wireless planning guide – revised');
    await editor.getByLabel('URL', { exact: true }).fill('https://network.example/guides/wireless-planning-v2');
    await capture('02-quickedit.png');
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await row('Wireless planning guide').click({ button: 'right' });
    await capture('03-context-menu.png');
    await page.keyboard.press('Escape');

    await openFolder('Security');
    await page.locator('.search-box input').fill('tag:docs');
    await page.locator('.search-pane .bookmark-row').first().waitFor();
    await capture('04-search.png');
    await page.locator('.search-box input').fill('');

    const quickPage = await context.newPage();
    quickPage.on('pageerror', error => errors.push(error.message));
    await installDemoApi(quickPage);
    await quickPage.goto(`${baseUrl}/?quick=search`);
    await quickPage.locator('.quick-search-input-area input').fill('docs');
    await quickPage.locator('.quick-search-input-area input').press('ArrowDown');
    await capture('05-quicksearch.png', quickPage.locator('.quick-search-card'));
    await quickPage.close();

    await row('VPN deployment guide').getByRole('checkbox').check();
    await row('SSO architecture notes').getByRole('checkbox').check();
    await row('VPN deployment guide').getByRole('button', { name: 'Tags', exact: true }).click();
    await page.getByLabel('Tags, comma separated').fill('demo, training');
    await capture('06-tags.png');
    await page.locator('.tag-edit-actions').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await tab('Tags').click();
    await page.locator('.tag-controls select').selectOption('folder');
    await page.getByRole('button', { name: 'Analyze tags', exact: true }).click();
    await page.locator('.tag-suggestion').first().waitFor();
    await capture('07-auto-tags.png');

    await openFolder('Networking');
    await tab('Deadlinks').click();
    await page.getByRole('button', { name: /^Check folder/ }).click();
    await page.waitForFunction(() => document.querySelector('.deadlink-stats')?.textContent.includes('404: 1'));
    await settleToasts();
    await capture('08-deadlinks.png');
    await tab('Cleanup').click();
    await page.getByRole('button', { name: 'Run scan', exact: true }).click();
    await page.locator('.cleanup-finding').first().waitFor();
    await settleToasts();
    await capture('09-cleanup.png');

    await tab('Sort').click();
    await page.locator('.sort-controls select').selectOption('current');
    await page.locator('.sort-controls').getByRole('button', { name: 'Analyze', exact: true }).click();
    await page.locator('.sort-preview').waitFor();
    await settleToasts();
    await capture('10-sort.png');
    await tab('Rename').click();
    await page.locator('.rename-controls select').selectOption('folder');
    await page.getByRole('button', { name: 'Analyze names', exact: true }).click();
    await page.locator('.rename-suggestion').first().waitFor();
    await settleToasts();
    await capture('11-auto-rename.png');

    await tab('Backup').click();
    await page.locator('.file-button input').setInputFiles(fixturePath);
    await page.locator('.import-preview').waitFor();
    await capture('12-backup.png');

    await row('Retired wireless manual').getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Undo delete (1)', exact: true }).waitFor();
    await openFolder('Deleted');
    await row('Retired wireless manual').getByRole('checkbox').check();
    await settleToasts();
    await capture('13-restore.png');
    await page.getByRole('button', { name: /^Undelete selected/ }).click();

    await openFolder('Development');
    await tab('Add').click();
    await page.locator('.import-textarea textarea').fill('https://dev.example/docs/testing-guide\nhttps://cloud.example/labs/deployment-demo\nhttps://network.example/tools/subnet-calculator');
    await page.locator('.import-preview-item').first().waitFor();
    await settleToasts();
    await page.getByLabel('Smart naming suggestions').check();
    await page.locator('.import-preview-item').first().waitFor();
    await capture('14-bulk-import.png');
    await page.locator('.import-preview-bar').getByRole('button', { name: 'Import', exact: true }).click();
    await page.locator('.import-input-section .success-text').waitFor();
    assert.match(await page.locator('.import-input-section .success-text').textContent(), /Imported 3 bookmark/);
    assert.equal(await page.locator('.file-row.bookmark-row').count(), 6, 'Bulk import adds all three demo URLs');

    assert.deepEqual(errors, [], 'Screenshots must not contain application runtime errors');
    assert.equal(fs.readdirSync(outputDir).filter(name => name.endsWith('.png')).length, 14);
    console.log('Validated: 14 screenshots, fictional fixture, no runtime errors.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
