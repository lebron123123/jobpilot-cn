import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = String(Date.now());
const phones = [`139${token.slice(-8)}`, `138${token.slice(-8)}`];

async function call(url, options = {}, cookie = '') {
  const response = await fetch(base + url, { headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...options });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { response, data, cookie: response.headers.getSetCookie?.()[0]?.split(';')[0] || '' };
}

const unauthorized = await call('/api/state');
if (unauthorized.response.status !== 401) throw new Error('unauthenticated state was not blocked');

async function register(phone, name) {
  const sent = await call('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ phone }) });
  if (!sent.response.ok || !sent.data.devCode) throw new Error('development OTP not issued');
  const wrong = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ phone, name, password: 'TestPass123!', code: '000000' }) });
  if (wrong.response.status !== 400) throw new Error('wrong OTP was accepted');
  const result = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ phone, name, password: 'TestPass123!', code: sent.data.devCode }) });
  if (result.response.status !== 201 || !result.cookie) throw new Error('registration failed');
  return result.cookie;
}

const cookieA = await register(phones[0], '[系统测试]用户A');
const cookieB = await register(phones[1], '[系统测试]用户B');
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

console.log(JSON.stringify({ ok: true, unauthorized: 401, usersCreated: 2, isolatedJobs: [stateA.data.jobs.length, stateB.data.jobs.length], protectedDownload: true, logout: true }, null, 2));
