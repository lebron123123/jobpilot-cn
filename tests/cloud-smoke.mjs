const base = process.env.CLOUD_SMOKE_BASE;
const phone = process.env.CLOUD_SMOKE_PHONE;
const password = process.env.CLOUD_SMOKE_PASSWORD;
if (!base || !phone || !password) throw new Error('CLOUD_SMOKE_BASE/PHONE/PASSWORD are required');

let cookie = '';
async function call(url, options = {}, expected = 200) {
  const response = await fetch(base + url, { headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...options });
  const setCookie = response.headers.getSetCookie?.()[0];
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (response.status !== expected) throw new Error(`${url}: expected ${expected}, got ${response.status}: ${text}`);
  return { response, data };
}

await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
const initial = await call('/api/state');
if (initial.data.user.phone !== phone || initial.data.jobs.length !== 0) throw new Error('isolated initial state invalid');
const seeded = await call('/api/jobs/seed', { method: 'POST', body: '{}' });
if (seeded.data.added.length !== 3) throw new Error('cloud seed failed');
const state = await call('/api/state');
const tailored = await call('/api/tailor/batch', { method: 'POST', body: JSON.stringify({ jobIds: [state.data.jobs[0].id] }) });
const version = tailored.data.versions[0];
if (!version?.download) throw new Error('cloud tailor failed');
const download = await fetch(base + version.download, { headers: { Cookie: cookie } });
const bytes = new Uint8Array(await download.arrayBuffer());
if (!download.ok || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('protected cloud DOCX invalid');
const item = { jobId: state.data.jobs[0].id, versionId: version.id, platform: 'Cloud Smoke' };
const queued = await call('/api/applications/queue', { method: 'POST', body: JSON.stringify({ items: [item] }) });
const duplicate = await call('/api/applications/queue', { method: 'POST', body: JSON.stringify({ items: [item] }) });
if (queued.data.queued.length !== 1 || duplicate.data.queued.length !== 0) throw new Error('cloud dedupe failed');
const interview = await call('/api/interview/session', { method: 'POST', body: JSON.stringify({ role: '项目运营' }) });
const answer = await call('/api/interview/answer', { method: 'POST', body: JSON.stringify({ sessionId: interview.data.session.id, question: interview.data.session.questions[0], answer: '我负责推进30个客户任务，完成2个项目结果，并通过复盘持续改进。' }) });
await call('/api/auth/logout', { method: 'POST', body: '{}' });
console.log(JSON.stringify({ ok: true, user: initial.data.user.name, jobs: state.data.jobs.length, docxBytes: bytes.length, dedupe: true, interviewScore: answer.data.score }, null, 2));

