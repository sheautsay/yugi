// CG1 on the INSTALLED app with a REAL sign-in: wait for the user to sign in (they click "使用 ChatGPT 登入" in the
// app window this script opens), then — after the one-hour access token has expired — open the AI page, which needs a
// token and therefore makes the bundled service refresh it for real. Records whether the refresh succeeded, the
// credential file's timestamp/size and the service's non-secret event log. Sends NO AI analysis request.
// Usage: npx tsx e2e-desktop/real-refresh.mts [waitForSignInMinutes=45] [refreshAfterMinutes=62]
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { goto, launchApp } from './app.ts';

const [signInMinutes = '45', refreshAfterMinutes = '62'] = process.argv.slice(2);
const outDir = 'docs/dev/validation/desktop-real-ai/refresh';
mkdirSync(outDir, { recursive: true });
const progress = join(outDir, 'progress.log');
const say = (m: string) => {
  const line = `${new Date().toISOString()} ${m}`;
  console.log(line);
  appendFileSync(progress, line + '\n');
};
const redact = (s: string) => s.replace(/[^\s@：:]+@[^\s@]+\.[A-Za-z]{2,}/g, '<email>');
const credDir = join(process.env['APPDATA'] ?? '', 'com.ygocomboassistant.desktop', 'chatgpt');
const authInfo = () => {
  const f = join(credDir, 'auth.json');
  return existsSync(f) ? { size: statSync(f).size, modified: statSync(f).mtime.toISOString() } : null;
};
const eventLog = () => {
  const f = join(credDir, 'bridge-events.log');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').slice(-15) : [];
};

const app = await launchApp();
const { page } = app;
try {
  await goto(page, '/settings');
  const status = page.locator('#set-chatgpt p').first();
  const readStatus = async () => redact((await status.innerText()).trim());
  say(`app open at Settings; credentials before: ${JSON.stringify(authInfo())}; status: ${await readStatus()}`);
  say('WAITING for the user to press "使用 ChatGPT 登入" in the app window and finish the official sign-in');

  const signInDeadline = Date.now() + Number(signInMinutes) * 60_000;
  let signedInAt = 0;
  // Already signed in (e.g. the app was closed and reopened): the tokens were issued when auth.json was last written.
  for (let i = 0; i < 12 && !signedInAt; i++) {
    const s = await readStatus();
    if (/^已連線/.test(s)) {
      signedInAt = statSync(join(credDir, 'auth.json')).mtime.getTime();
      say(`ALREADY SIGNED IN (tokens issued ${new Date(signedInAt).toISOString()}): ${s}`);
    } else if (/尚未連線/.test(s)) {
      await page.getByRole('button', { name: '重新整理' }).first().click().catch(() => undefined);
      await page.waitForTimeout(5000);
    } else break;
  }
  while (!signedInAt && Date.now() < signInDeadline) {
    const s = await readStatus();
    if (/^已連線/.test(s)) {
      signedInAt = Date.now();
      say(`SIGNED IN: ${s}; credentials: ${JSON.stringify(authInfo())}`);
      break;
    }
    await page.waitForTimeout(10_000);
  }
  if (!signedInAt) throw new Error(`no sign-in within ${signInMinutes} minutes`);
  await page.screenshot({ path: join(outDir, `01-signed-in-${Date.now()}.png`), mask: [page.getByText(/已登入：|已連線：/)] });

  // The access token lasts one hour; the service refreshes it when it is needed within 5 minutes of expiry.
  const refreshAt = signedInAt + Number(refreshAfterMinutes) * 60_000;
  say(`will trigger a token-needing request at ${new Date(refreshAt).toISOString()} (after the access token expired)`);
  while (Date.now() < refreshAt) {
    await page.waitForTimeout(60_000);
    // Keep the window alive and prove the sign-in survives idle time (status does not refresh tokens).
    if ((Date.now() - signedInAt) % (15 * 60_000) < 60_000) say(`idle check: ${await readStatus()}; credentials: ${JSON.stringify(authInfo())}`);
  }
  const before = authInfo();
  const refreshesBefore = eventLog().filter((l) => / refresh\.done$/.test(l)).length;
  await goto(page, '/decks');
  await page.locator('.deck-row').first().waitFor();
  const preferred = page.locator('.deck-row', { hasText: 'Edge 實戰牌組 CG3' });
  const row = (await preferred.count()) > 0 ? preferred.first() : page.locator('.deck-row').first();
  await row.getByRole('link', { name: 'AI 展開分析' }).click();
  const select = page.getByLabel('模型（目前帳號可用）');
  let modelsLoaded = false;
  for (let i = 0; i < 30 && !modelsLoaded; i++) {
    modelsLoaded = (await select.locator('option').count().catch(() => 0)) > 1;
    if (!modelsLoaded) await page.waitForTimeout(2000);
  }
  const after = authInfo();
  await goto(page, '/settings');
  await page.waitForTimeout(3000);
  const finalStatus = await readStatus();
  say(`REFRESH CHECK: models loaded with a fresh token=${modelsLoaded}; credentials before=${JSON.stringify(before)} after=${JSON.stringify(after)}; status: ${finalStatus}`);
  say(`event log (non-secret): ${JSON.stringify(eventLog())}`);
  await page.screenshot({ path: join(outDir, '02-after-refresh.png'), mask: [page.getByText(/已登入：|已連線：/)] });
  // The service writes `refresh.done` only after the new tokens are saved. (A file timestamp read from this process
  // can be stale: the first run saw the old time 3 s after the write that PowerShell then showed correctly.)
  const refreshes = eventLog().filter((l) => / refresh\.done$/.test(l)).length;
  const refreshed = modelsLoaded && /^已連線/.test(finalStatus) && refreshes > refreshesBefore;
  say(refreshed ? 'RESULT: PASS — the access token was refreshed for real and the sign-in survived' : 'RESULT: FAIL — see the event log above');
} catch (error) {
  say(`ERROR: ${error instanceof Error ? error.message : String(error)}; event log: ${JSON.stringify(eventLog())}`);
} finally {
  await app.close().catch((e) => say(`close: ${e}`));
  say('done');
}
