// CG1–CG5 / DK9 / DK13 evidence on the INSTALLED app with the user's REAL ChatGPT sign-in (made by the user beforehand).
// Usage: npx tsx e2e-desktop/real-chatgpt.mts probe            → restart, check the sign-in survived, list models; sends NOTHING to the AI
//        npx tsx e2e-desktop/real-chatgpt.mts import-real-deck - <name> → also imports the user's real deck list (no AI request)
//        npx tsx e2e-desktop/real-chatgpt.mts send <model-slug> <deck name>  → then exactly ONE one-shot analysis (user-authorized)
// The account e-mail is never written to the evidence; tokens are never read.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EDGE_SAMPLE } from '../src/testing/neuron-deck.sample';
import { goto, launchApp, processes } from './app.ts';
import { openAddDeck } from '../e2e/fixtures';

const [mode = 'probe', modelSlug = '', deckName = '桌面驗收牌組'] = process.argv.slice(2);
if (mode === 'send' && !modelSlug) throw new Error('send needs a model slug from the probe');
const outDir = 'docs/dev/validation/desktop-real-ai';
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const redact = (s: string) => s.replace(/[^\s@：:]+@[^\s@]+\.[A-Za-z]{2,}/g, '<email>');
const evidence: Record<string, unknown> = { mode, startedAt: new Date().toISOString() };

const connections = new Set<string>();
function sampleConnections(pid: number): void {
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-NetTCPConnection -OwningProcess ${pid} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.State) $($_.LocalAddress) $($_.RemoteAddress):$($_.RemotePort)" }`], { encoding: 'utf8' });
    for (const line of out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) connections.add(line);
  } catch {
    /* a sample may fail while connections change */
  }
}
const resolve = (host: string) => {
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Resolve-DnsName ${host} -ErrorAction Stop | Where-Object IPAddress).IPAddress -join ' '`], { encoding: 'utf8' }).trim().split(' ');
  } catch {
    return [];
  }
};

const app = await launchApp();
const { page } = app;
const pageHosts = new Set<string>();
const bridgeCalls: string[] = [];
page.on('request', (r) => {
  const u = new URL(r.url());
  pageHosts.add(u.host);
  if (u.hostname === '127.0.0.1') bridgeCalls.push(`${r.method()} ${u.pathname}`);
});
try {
  const bridgePidOf = () => [...processes('ygo-bridge.exe').entries()].find(([, parent]) => parent === app.pid)?.[0];

  // CG: the sign-in made in an earlier app session is restored after a restart.
  await goto(page, '/settings');
  const status = page.locator('#set-chatgpt p').first();
  // The bundled service starts on first use: refresh until it answers (up to 60 s).
  for (let i = 0; i < 20 && /尚未連線/.test(await status.innerText()); i++) {
    await page.getByRole('button', { name: '重新整理' }).first().click();
    await page.waitForTimeout(3000);
  }
  evidence['settingsStatus'] = redact((await status.innerText()).trim());

  await goto(page, '/decks');
  await page.locator('.deck-row').first().waitFor();
  if (mode === 'import-real-deck') {
    // The user's real Edge deck list (40 / 15 / 0), through the app's own import flow (no AI request).
    await openAddDeck(page);
    await page.getByLabel('牌組代碼或 YDK 內容').fill(EDGE_SAMPLE);
    await page.getByRole('button', { name: '解析', exact: true }).click();
    await page.getByText('牌表檢核通過，匯入後可用於起手查詢。').waitFor({ timeout: 30_000 });
    evidence['parsed'] = (await page.getByText(/主牌 \d+ 張／額外 \d+ 張／備牌 \d+ 張/).first().innerText()).trim();
    await page.getByLabel('新牌組名稱').fill(deckName);
    await page.getByRole('button', { name: '確認匯入' }).click();
    await page.getByRole('status').filter({ hasText: `已匯入「${deckName}」` }).waitFor({ timeout: 30_000 });
    evidence['imported'] = deckName;
  }
  evidence['deckCount'] = await page.locator('.deck-row').count();
  evidence['deck'] = deckName;
  await page.locator('.deck-row', { hasText: deckName }).first().getByRole('link', { name: 'AI 展開分析' }).click();
  const welcome = page.getByRole('dialog', { name: '你正在使用你的 ChatGPT 方案' });
  const select = page.getByLabel('模型（目前帳號可用）');
  await select.waitFor({ timeout: 30_000 });
  if (await welcome.isVisible()) {
    evidence['planNoticeShown'] = true;
    await welcome.getByRole('button', { name: '知道了' }).click();
  }
  await page.waitForFunction(() => (document.querySelectorAll('select option').length ?? 0) > 1, undefined, { timeout: 30_000 }).catch(() => undefined);
  evidence['models'] = await select.locator('option').evaluateAll((os) => os.map((o) => ({ value: (o as HTMLOptionElement).value, text: o.textContent?.trim() })).filter((o) => o.value));

  const panel = page.locator('details.advanced');
  if (!(await panel.evaluate((el) => (el as HTMLDetailsElement).open))) await panel.locator('summary').click();
  const oneShot = page.getByLabel('單次分析（一次請求）');
  evidence['oneShotBefore'] = await oneShot.isChecked();
  const bridgePid = bridgePidOf();
  evidence['bridgeRunningUnderApp'] = !!bridgePid;
  const usageText = async () => (await page.getByText(/今天已送出 \d+ 次/).first().innerText()).trim();
  evidence['usageBefore'] = await usageText();
  const accountLine = () => [page.getByText(/已登入：|已連線：/)]; // the account e-mail is covered in every screenshot
  await page.screenshot({ path: join(outDir, `${stamp}-${mode}-ready.png`), mask: accountLine() });

  if (mode === 'send') {
    if (!(await oneShot.isChecked())) await oneShot.check();
    await select.selectOption(modelSlug);
    const reasons = page.locator('.notice.warn li');
    evidence['blockingReasons'] = await reasons.allInnerTexts();
    if ((await reasons.count()) > 0) throw new Error(`cannot start: ${evidence['blockingReasons']}`);
    for (const host of ['api.openai.com', 'auth.openai.com']) evidence[`dns:${host}`] = resolve(host);
    const t0 = Date.now();
    await page.getByRole('button', { name: '開始分析', exact: true }).click();
    const done = page.getByText(/分析完成：\d+ 條候選路線。|分析失敗|已中止|錯誤/).first();
    while (!(await done.isVisible())) {
      if (bridgePid) sampleConnections(bridgePid);
      if (Date.now() - t0 > 15 * 60_000) throw new Error('no result within 15 minutes');
      await page.waitForTimeout(1000);
    }
    evidence['durationMs'] = Date.now() - t0;
    evidence['result'] = (await done.innerText()).trim();
    evidence['statusLine'] = (await page.locator('p[role="status"]').filter({ hasText: '狀態：' }).first().innerText().catch(() => '')).trim();
    await page.getByText('分析紀錄（牌組、資料版本、規則假設、模型與參數）').first().click().catch(() => undefined);
    await page.waitForTimeout(500);
    evidence['runRecord'] = redact((await page.locator('details', { hasText: '分析紀錄' }).first().innerText().catch(() => '')).trim());
    evidence['candidates'] = (await page.getByRole('list', { name: '候選路線' }).getByRole('listitem').allInnerTexts().catch(() => [])).map((t) => t.split('\n').slice(0, 3).join(' | '));
    await page.screenshot({ path: join(outDir, `${stamp}-send-result.png`), fullPage: true, mask: accountLine() });
    evidence['bridgeConnections'] = [...connections].sort();
    evidence['usageAfter'] = await usageText();
  }

  // DK13 after a real sign-in: nothing secret in the web storage.
  const dump = String(
    await page.evaluate(`(async () => {
      const out = [JSON.stringify(localStorage), JSON.stringify(sessionStorage)];
      for (const info of await indexedDB.databases()) {
        const db = await new Promise((res, rej) => { const r = indexedDB.open(info.name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        for (const store of db.objectStoreNames) {
          if (store === 'images') continue;
          const all = await new Promise((res) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); });
          out.push(JSON.stringify(all));
        }
        db.close();
      }
      return out.join('\\n');
    })()`),
  );
  evidence['webStorageChars'] = dump.length;
  evidence['webStorageHasSecret'] = /refresh_token|access_token|id_token|x-ygo-bridge-token|Bearer |sk-[A-Za-z0-9]{10}|eyJhbGciOi/.test(dump);
} finally {
  evidence['pageHosts'] = [...pageHosts].sort();
  evidence['pageBridgeCalls'] = bridgeCalls; // desktop requests to the bundled service go through Tauri IPC, not page requests
  evidence['finishedAt'] = new Date().toISOString();
  writeFileSync(join(outDir, `${stamp}-${mode}.json`), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await app.close();
}
