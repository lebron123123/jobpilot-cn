import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = String(Date.now());
const emails = [`system-test+${token}-a@example.com`, `system-test+${token}-b@example.com`];
const legacyPhone = `139${token.slice(-8)}`;

async function call(url, options = {}, cookie = '') {
  const response = await fetch(base + url, { headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...options });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { response, data, cookie: response.headers.getSetCookie?.()[0]?.split(';')[0] || '' };
}

const unauthorized = await call('/api/state');
if (unauthorized.response.status !== 401) throw new Error('unauthenticated state was not blocked');

const guestA = await call('/api/auth/guest', { method: 'POST', body: '{}' });
const guestB = await call('/api/auth/guest', { method: 'POST', body: '{}' });
if (guestA.response.status !== 201 || guestB.response.status !== 201 || !guestA.data.user.isGuest) throw new Error('guest session creation failed');
if (/; Secure/i.test(guestA.response.headers.getSetCookie?.()[0] || '')) throw new Error('HTTP guest cookie was incorrectly marked Secure');
const secureGuestResponse = await fetch(base + '/api/auth/guest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' }, body: '{}' });
const secureGuestCookie = secureGuestResponse.headers.getSetCookie?.()[0] || '';
if (!/; Secure/i.test(secureGuestCookie)) throw new Error('HTTPS forwarded guest cookie missing Secure');
await call('/api/auth/logout', { method: 'POST', body: '{}' }, secureGuestCookie.split(';')[0]);
const guestStateA = await call('/api/state', {}, guestA.cookie);
const guestStateB = await call('/api/state', {}, guestB.cookie);
if (guestStateA.data.jobs.length !== 3 || guestStateB.data.jobs.length !== 3 || !guestStateA.data.profile.facts.length) throw new Error('guest demo data missing');
await call('/api/jobs/import', { method: 'POST', body: JSON.stringify({ text: '[系统测试]游客岗位\n演示公司\n深圳 8K-10K，负责项目运营。' }) }, guestA.cookie);
const changedGuestA = await call('/api/state', {}, guestA.cookie);
const unchangedGuestB = await call('/api/state', {}, guestB.cookie);
if (changedGuestA.data.jobs.length !== 4 || unchangedGuestB.data.jobs.length !== 3) throw new Error('guest data isolation failed');
const guestBrowser = await call('/api/browser/prepare', { method: 'POST', body: JSON.stringify({ url: 'https://example.com/job' }) }, guestA.cookie);
if (guestBrowser.response.status !== 403) throw new Error('guest browser execution was not blocked');
await call('/api/auth/logout', { method: 'POST', body: '{}' }, guestA.cookie);
await call('/api/auth/logout', { method: 'POST', body: '{}' }, guestB.cookie);

async function register(email, name) {
  const sent = await call('/api/auth/send-email-code', { method: 'POST', body: JSON.stringify({ email }) });
  if (!sent.response.ok || !sent.data.devCode) throw new Error('development OTP not issued');
  const repeated = await call('/api/auth/send-email-code', { method: 'POST', body: JSON.stringify({ email }) });
  if (repeated.response.status !== 429) throw new Error('email OTP rate limit failed');
  const wrong = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, name, password: 'TestPass123!', code: '000000' }) });
  if (wrong.response.status !== 400) throw new Error('wrong OTP was accepted');
  const result = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, name, password: 'TestPass123!', code: sent.data.devCode }) });
  if (result.response.status !== 201 || !result.cookie) throw new Error('registration failed');
  return result.cookie;
}

const cookieA = await register(emails[0], '[系统测试]用户A');
const cookieB = await register(emails[1], '[系统测试]用户B');
const seedA = await call('/api/jobs/seed', { method: 'POST', body: '{}' }, cookieA);
if (seedA.data.added.length !== 3) throw new Error('user A seed failed');
const stateA = await call('/api/state', {}, cookieA);
const stateB = await call('/api/state', {}, cookieB);
if (stateA.data.jobs.length !== 3 || stateB.data.jobs.length !== 0) throw new Error('user data isolation failed');

const tailored = await call('/api/tailor/batch', { method: 'POST', body: JSON.stringify({ jobIds: [stateA.data.jobs[0].id] }) }, cookieA);
const version = tailored.data.versions[0];
const file = path.join(projectDir, 'generated', version.filename);
if (!fs.existsSync(file) || fs.statSync(file).size < 1000) throw new Error('protected DOCX generation failed');
const downloadA = await fetch(base + version.download, { headers: { Cookie: cookieA } });
const downloadB = await fetch(base + version.download, { headers: { Cookie: cookieB } });
if (!downloadA.ok || downloadB.status !== 404) throw new Error('generated file ownership check failed');

const logout = await call('/api/auth/logout', { method: 'POST', body: '{}' }, cookieA);
const afterLogout = await call('/api/state', {}, cookieA);
if (!logout.response.ok || afterLogout.response.status !== 401) throw new Error('logout failed');

const emailLogin = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ account: emails[0].toUpperCase(), password: 'TestPass123!' }) });
if (!emailLogin.response.ok || emailLogin.data.user.email !== emails[0]) throw new Error('case-insensitive email login failed');
const legacyCode = await call('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ phone: legacyPhone }) });
const legacyRegister = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ phone: legacyPhone, name: '[系统测试]旧手机号用户', password: 'TestPass123!', code: legacyCode.data.devCode }) });
const legacyLogin = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: legacyPhone, password: 'TestPass123!' }) });
if (!legacyRegister.response.ok || !legacyLogin.response.ok || legacyLogin.data.user.phone !== legacyPhone) throw new Error('legacy phone auth compatibility failed');

console.log(JSON.stringify({ ok: true, unauthorized: 401, guestMode: true, guestIsolation: true, guestBrowserBlocked: true, emailUsersCreated: 2, emailOtpRateLimited: true, emailLogin: true, legacyPhoneLogin: true, isolatedJobs: [stateA.data.jobs.length, stateB.data.jobs.length], protectedDownload: true, logout: true }, null, 2));
