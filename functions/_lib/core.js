import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

const encoder = new TextEncoder();
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL = 5 * 60 * 1000;
const COOKIE = 'jobpilot_session';
const DICT = ['低空经济','无人机','解决方案','项目运营','客户运营','业务运营','销售运营','客户成功','项目管理','需求分析','方案撰写','产品演示','客户沟通','客户维护','跨部门','数据分析','Excel','PowerPoint','SOP','台账','复盘','金融','国有企业','To B','招投标','交付','出差'];

const nowIso = () => new Date().toISOString();
const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const makeId = (prefix) => `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
const hex = (buffer) => [...new Uint8Array(buffer)].map((item) => item.toString(16).padStart(2, '0')).join('');
const randomHex = (size = 16) => hex(crypto.getRandomValues(new Uint8Array(size)));
const validPhone = (phone) => /^1[3-9]\d{9}$/.test(String(phone || ''));
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const emptyData = (name = '', phone = '') => ({ profile: { name, location: '', phone, email: '', targetRoles: [], salaryMin: null, salaryMax: null, constraints: [], skills: [], facts: [], resumeText: '', resumeFile: '', updatedAt: null }, jobs: [], versions: [], applications: [], interviewSessions: [], qa: [] });
const publicUser = (user) => ({ id: user.id, phone: user.phone, name: user.name, phoneVerifiedAt: user.phone_verified_at, createdAt: user.created_at });

async function sha256(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, key, 256));
}
function constantEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}
function parseCookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map((item) => item.trim().split('=').map(decodeURIComponent)).filter((item) => item.length === 2));
}
function sessionCookie(token, maxAge = SESSION_TTL / 1000) { return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAge)}`; }
async function requestBody(request) { try { return await request.json(); } catch { throw new Error('JSON格式错误'); } }
function keywords(text) { const value = String(text || '').toLowerCase(); return DICT.filter((item) => value.includes(item.toLowerCase())); }

function scoreJob(job, profile) {
  const text = `${job.title} ${job.company} ${job.description}`;
  const jd = keywords(text);
  const corpus = [...(profile.skills || []), ...(profile.facts || []), ...(profile.targetRoles || [])].join(' ').toLowerCase();
  const matched = jd.filter((item) => corpus.includes(item.toLowerCase()));
  const requiresTravel = /(需要|接受|频繁|经常|不定期|适应|可)出差|驻场|全国调配/.test(text) && !/不接受出差|无需出差|不出差/.test(text);
  const gaps = jd.filter((item) => !matched.includes(item) && (item !== '出差' || requiresTravel)).slice(0, 6);
  let score = 48 + Math.min(38, matched.length * 6);
  if (requiresTravel && (profile.constraints || []).some((item) => item.includes('不接受出差'))) score -= 25;
  if (job.salaryMin && profile.salaryMin && job.salaryMin < profile.salaryMin) score -= 8;
  score = Math.max(0, Math.min(96, score));
  return { score, matched, gaps, requiresTravel, verdict: score >= 78 ? '强匹配' : score >= 62 ? '转型可投' : score >= 45 ? '谨慎评估' : '不建议' };
}
function parseJob(raw, index = 0) {
  const lines = String(raw || '').split(/\r?\n/).map(clean).filter(Boolean);
  const salary = String(raw || '').match(/(\d{1,2})[kK千]\s*[-—至]\s*(\d{1,2})[kK千]/);
  return { id: makeId('job'), title: (lines[0] || `导入岗位${index + 1}`).slice(0, 60), company: lines[1]?.slice(0, 50) || '待识别公司', location: /深圳/.test(raw) ? '深圳' : '待确认', salaryMin: salary ? Number(salary[1]) * 1000 : null, salaryMax: salary ? Number(salary[2]) * 1000 : null, description: clean(raw), source: '手动导入', url: '', createdAt: nowIso() };
}
async function extractDocx(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('DOCX缺少正文');
  return clean(xml.replace(/<w:tab\/?[^>]*>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
}
function fromBase64(value) { const binary = atob(value); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }
function inferProfile(text, profile) {
  const facts = [];
  for (const expression of [/维护[^。；]{0,20}\d+[^。；]{0,10}客户/g, /拜访[^。；]{0,20}\d+[^。；]*/g, /完成[^。；]{0,20}\d+[^。；]{0,20}元/g, /累计[^。；]{0,30}\d+[^。；]*/g]) for (const match of text.match(expression) || []) facts.push(clean(match));
  return { ...profile, phone: text.match(/1[3-9]\d{9}/)?.[0] || profile.phone, email: text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || profile.email, resumeText: text, skills: [...new Set([...(profile.skills || []), ...keywords(text)])], facts: [...new Set([...(profile.facts || []), ...facts])].slice(0, 20), updatedAt: nowIso() };
}
function tailored(profile, job) {
  const scored = scoreJob(job, profile), facts = (profile.facts || []).slice(0, 5), skills = (profile.skills || []).slice(0, 6);
  return { title: `${job.title || '目标岗位'}定制版`, summary: `${profile.name || '候选人'}希望应聘${job.title || '目标岗位'}，具备${skills.join('、') || '待从主简历提取'}等能力，以下内容全部来自本人事实库。`, bullets: facts.length ? facts : ['主简历尚未提取到可验证的量化成果，请补充后再投递。'], matched: scored.matched, gaps: scored.gaps, score: scored.score, truthNote: '仅重排和改写当前用户事实库内容，不新增未经验证的经历。' };
}
async function resumeDocx(profile, job, content) {
  const children = [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: profile.name || '候选人', bold: true, size: 34, font: 'Microsoft YaHei' })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${job.title}｜${profile.location || job.location || '地点待确认'}｜${profile.phone || ''}｜${profile.email || ''}`, size: 19, font: 'Microsoft YaHei' })] }), new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '职业概述', bold: true })] }), new Paragraph({ children: [new TextRun({ text: content.summary, size: 20 })] }), new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '核心证据', bold: true })] }), ...content.bullets.map((item) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: item, size: 20 })] }))];
  const document = new Document({ sections: [{ children }] });
  return Packer.toBuffer(document);
}

async function loadData(env, user) {
  const row = await env.DB.prepare('SELECT state_json FROM user_states WHERE user_id = ?').bind(user.id).first();
  return row ? JSON.parse(row.state_json) : emptyData(user.name, user.phone);
}
async function saveData(env, userId, data) {
  await env.DB.prepare('INSERT INTO user_states(user_id,state_json,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at').bind(userId, JSON.stringify(data), nowIso()).run();
}
async function getUser(request, env) {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  return env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token), Date.now()).first();
}
async function audit(request, env, userId, action, detail = '') {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.DB.prepare('INSERT INTO audit_logs(id,user_id,action,detail,ip_hash,created_at) VALUES(?,?,?,?,?,?)').bind(makeId('aud'), userId || null, action, detail.slice(0, 500), await sha256(ip), nowIso()).run();
}
async function putFile(env, key, bytes, contentType) {
  if (env.FILES_KV) return env.FILES_KV.put(key, bytes, { metadata: { contentType } });
  if (env.FILES) return env.FILES.put(key, bytes, { httpMetadata: { contentType } });
  throw new Error('文件存储未绑定');
}
async function getFile(env, key) {
  if (env.FILES_KV) { const result = await env.FILES_KV.getWithMetadata(key, 'stream'); return result.value ? { body: result.value, contentType: result.metadata?.contentType } : null; }
  if (env.FILES) { const object = await env.FILES.get(key); return object ? { body: object.body, contentType: object.httpMetadata?.contentType } : null; }
  throw new Error('文件存储未绑定');
}
async function deliverOtp(env, phone, code) {
  if (!env.SMS_WEBHOOK_URL) {
    if (env.ALLOW_DEV_OTP === 'true') return { sent: false, mode: 'development', devCode: code };
    const error = new Error('生产短信服务尚未配置'); error.status = 503; throw error;
  }
  const response = await fetch(env.SMS_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.SMS_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify({ phone, code, purpose: 'register', product: 'JobPilot CN' }) });
  if (!response.ok) throw new Error('短信供应商发送失败');
  return { sent: true, mode: 'provider' };
}

async function authRoute(request, env, pathname) {
  if (request.method === 'POST' && pathname === '/api/auth/send-code') {
    const input = await requestBody(request), phone = String(input.phone || '');
    if (!validPhone(phone)) return json({ error: '请输入有效的中国大陆手机号' }, 400);
    if (await env.DB.prepare('SELECT id FROM users WHERE phone=?').bind(phone).first()) return json({ error: '该手机号已注册，请直接登录' }, 409);
    const last = await env.DB.prepare('SELECT created_at FROM otps WHERE phone=? ORDER BY created_at DESC LIMIT 1').bind(phone).first();
    if (last && Date.now() - last.created_at < 60000) return json({ error: '验证码发送过于频繁，请稍后再试' }, 429);
    const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000), salt = randomHex(12);
    const delivery = await deliverOtp(env, phone, code);
    await env.DB.prepare('INSERT INTO otps(id,phone,code_hash,salt,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(makeId('otp'), phone, await sha256(`${phone}:${code}:${salt}`), salt, Date.now(), Date.now() + OTP_TTL).run();
    return json({ ...delivery, expiresIn: 300 });
  }
  if (request.method === 'POST' && pathname === '/api/auth/register') {
    const input = await requestBody(request), phone = String(input.phone || ''), name = clean(input.name).slice(0, 30), password = String(input.password || ''), code = String(input.code || '');
    if (!validPhone(phone) || !name || password.length < 8) return json({ error: '请填写姓名、有效手机号和至少8位密码' }, 400);
    if (await env.DB.prepare('SELECT id FROM users WHERE phone=?').bind(phone).first()) return json({ error: '该手机号已注册' }, 409);
    const otp = await env.DB.prepare('SELECT * FROM otps WHERE phone=? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1').bind(phone).first();
    if (!otp || otp.expires_at <= Date.now()) return json({ error: '验证码不存在或已过期' }, 400);
    if (otp.attempts >= 5) return json({ error: '验证码尝试次数过多，请重新获取' }, 429);
    await env.DB.prepare('UPDATE otps SET attempts=attempts+1 WHERE id=?').bind(otp.id).run();
    if (!constantEqual(await sha256(`${phone}:${code}:${otp.salt}`), otp.code_hash)) return json({ error: '验证码错误' }, 400);
    const user = { id: makeId('usr'), phone, name, phone_verified_at: nowIso(), created_at: nowIso() }, passwordSalt = randomHex(16), passwordValue = await passwordHash(password, passwordSalt);
    await env.DB.batch([env.DB.prepare('INSERT INTO users(id,phone,name,password_hash,password_salt,phone_verified_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.id, phone, name, passwordValue, passwordSalt, user.phone_verified_at, user.created_at), env.DB.prepare('INSERT INTO user_states(user_id,state_json,updated_at) VALUES(?,?,?)').bind(user.id, JSON.stringify(emptyData(name, phone)), nowIso()), env.DB.prepare('UPDATE otps SET used_at=? WHERE id=?').bind(Date.now(), otp.id)]);
    const token = randomHex(32); await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)').bind(makeId('ses'), user.id, await sha256(token), Date.now(), Date.now() + SESSION_TTL).run(); await audit(request, env, user.id, 'register');
    return json({ user: publicUser(user) }, 201, { 'Set-Cookie': sessionCookie(token) });
  }
  if (request.method === 'POST' && pathname === '/api/auth/login') {
    const input = await requestBody(request), phone = String(input.phone || ''), user = await env.DB.prepare('SELECT * FROM users WHERE phone=?').bind(phone).first();
    if (!user || !constantEqual(await passwordHash(String(input.password || ''), user.password_salt), user.password_hash)) return json({ error: '手机号或密码错误' }, 401);
    const token = randomHex(32); await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)').bind(makeId('ses'), user.id, await sha256(token), Date.now(), Date.now() + SESSION_TTL).run(); await audit(request, env, user.id, 'login');
    return json({ user: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(token) });
  }
  if (request.method === 'POST' && pathname === '/api/auth/logout') { const token = parseCookies(request)[COOKIE]; if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run(); return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) }); }
  if (request.method === 'GET' && pathname === '/api/auth/me') { const user = await getUser(request, env); return user ? json({ user: publicUser(user) }) : json({ error: '未登录' }, 401); }
  return null;
}

async function userRoute(request, env, pathname, user) {
  const data = await loadData(env, user);
  if (request.method === 'GET' && pathname === '/api/state') return json({ ...data, user: publicUser(user) });
  if (request.method === 'POST' && pathname === '/api/resume/analyze') {
    const input = await requestBody(request), bytes = fromBase64(input.base64 || ''), name = clean(input.name).slice(0, 120), extension = name.toLowerCase().split('.').pop();
    if (!bytes.length) return json({ error: '未收到文件' }, 400); if (bytes.length > 10 * 1024 * 1024) return json({ error: '文件不能超过10MB' }, 413); if (extension !== 'docx') return json({ error: '云端版本当前先支持DOCX，PDF/OCR正在迁移' }, 415);
    const text = await extractDocx(bytes), objectKey = `${user.id}/source/${makeId('resume')}_${name}`; await putFile(env, objectKey, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    data.profile = inferProfile(text, data.profile); data.profile.resumeFile = name; data.profile.resumeObjectKey = objectKey; await saveData(env, user.id, data); await audit(request, env, user.id, 'resume.upload', name);
    return json({ profile: data.profile, chars: text.length, keywords: keywords(text) });
  }
  if (request.method === 'POST' && pathname === '/api/jobs/import') { const input = await requestBody(request), chunks = Array.isArray(input.jobs) ? input.jobs : String(input.text || '').split(/\n\s*---+\s*\n/), added = []; for (const [index, chunk] of chunks.entries()) { if (!clean(chunk)) continue; const job = parseJob(chunk, index); Object.assign(job, scoreJob(job, data.profile)); if (!data.jobs.some((item) => item.title === job.title && item.company === job.company)) { data.jobs.push(job); added.push(job); } } await saveData(env, user.id, data); return json({ added, total: data.jobs.length }); }
  if (request.method === 'POST' && pathname === '/api/jobs/seed') { const seeds = [['低空项目运营','示例科技','深圳','负责项目运营、客户沟通、SOP与数据台账，薪资8K-12K，无需出差。'],['客户成功经理','示例云服务','深圳','负责客户需求分析、SaaS交付和客户运营规划，薪资9K-13K。'],['解决方案支持','示例智能','深圳','负责产品演示、方案撰写、需求分析与跨部门协作。']], added=[]; for(const [title,company,location,description] of seeds){if(data.jobs.some(x=>x.title===title&&x.company===company))continue;const job={id:makeId('job'),title,company,location,description,source:'示例岗位池',url:'',createdAt:nowIso()};Object.assign(job,scoreJob(job,data.profile));data.jobs.push(job);added.push(job)}await saveData(env,user.id,data);return json({added,total:data.jobs.length}); }
  if (request.method === 'POST' && pathname === '/api/tailor/batch') { const input=await requestBody(request),made=[];for(const job of data.jobs.filter(x=>(input.jobIds||[]).includes(x.id))){const content=tailored(data.profile,job),safe=`${job.company}_${job.title}`.replace(/[\\/:*?"<>|\s]+/g,'_').slice(0,60),filename=`${safe}_${Date.now()}.docx`,objectKey=`${user.id}/generated/${makeId('version')}_${filename}`,buffer=await resumeDocx(data.profile,job,content);await putFile(env,objectKey,buffer,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');const version={id:makeId('ver'),jobId:job.id,jobTitle:job.title,company:job.company,filename,objectKey,download:`/generated/${encodeURIComponent(filename)}`,content,createdAt:nowIso()};data.versions.push(version);made.push(version)}await saveData(env,user.id,data);return json({versions:made}); }
  if (request.method === 'POST' && pathname === '/api/applications/queue') { const input=await requestBody(request),queued=[];for(const item of input.items||[]){if(data.applications.some(x=>x.jobId===item.jobId&&x.status!=='失败'))continue;const app={id:makeId('app'),jobId:item.jobId,versionId:item.versionId||null,platform:item.platform||'待确认',url:item.url||'',status:'待批准',createdAt:nowIso(),history:[{at:nowIso(),status:'待批准'}]};data.applications.push(app);queued.push(app)}await saveData(env,user.id,data);return json({queued,total:data.applications.length}); }
  if (request.method === 'PATCH' && pathname.startsWith('/api/applications/')) { const input=await requestBody(request),app=data.applications.find(x=>x.id===pathname.split('/').pop());if(!app)return json({error:'记录不存在'},404);app.status=input.status||app.status;if(typeof input.url==='string')app.url=input.url;if(typeof input.platform==='string')app.platform=input.platform;app.history.push({at:nowIso(),status:app.status,note:input.note||''});await saveData(env,user.id,data);return json({application:app}); }
  if (request.method === 'POST' && pathname === '/api/interview/session') { const input=await requestBody(request),role=clean(input.role)||'目标岗位',session={id:makeId('iv'),role,questions:[`请做一个与${role}相关的自我介绍。`,'为什么选择这个岗位方向？','讲一次你推进复杂任务并获得结果的真实经历。','客户需求变化时如何推动交付？','你与岗位之间最大的差距是什么？'],answers:[],createdAt:nowIso()};data.interviewSessions.push(session);await saveData(env,user.id,data);return json({session}); }
  if (request.method === 'POST' && pathname === '/api/interview/answer') { const input=await requestBody(request),session=data.interviewSessions.find(x=>x.id===input.sessionId);if(!session)return json({error:'会话不存在'},404);const answer=clean(input.answer),score=Math.min(95,40+(answer.length>80?20:0)+(answer.length>180?15:0)+(/\d/.test(answer)?10:0)+(/结果|复盘|改进/.test(answer)?10:0)),feedback=score>=75?'结构较完整，继续补充岗位关联和复盘。':'建议使用STAR结构，并加入真实数字、个人行动和结果。';session.answers.push({question:input.question,answer,score,feedback,at:nowIso()});await saveData(env,user.id,data);return json({score,feedback}); }
  if (request.method === 'POST' && pathname === '/api/qa') { const input=await requestBody(request),item={id:makeId('qa'),question:clean(input.question),answer:clean(input.answer),tags:input.tags||[],createdAt:nowIso()};data.qa.push(item);await saveData(env,user.id,data);return json({item}); }
  if (pathname.startsWith('/api/browser/')) return json({error:'浏览器投递服务需要独立执行节点，Cloudflare迁移尚未完成'},501);
  return json({ error: 'API不存在' }, 404);
}

export async function handleApi(context) {
  const { request, env } = context, pathname = new URL(request.url).pathname;
  try {
    if (!env.DB) return json({ error: 'D1数据库未绑定' }, 503);
    const auth = await authRoute(request, env, pathname); if (auth) return auth;
    const user = await getUser(request, env); if (!user) return json({ error: '请先登录' }, 401);
    return userRoute(request, env, pathname, user);
  } catch (error) { console.error(error); return json({ error: error.message || '服务器错误' }, error.status || 500); }
}

export async function handleDownload(context) {
  const { request, env } = context;
  try {
    const user = await getUser(request, env); if (!user) return json({ error: '请先登录' }, 401);
    const filename = decodeURIComponent(new URL(request.url).pathname.split('/').pop()), data = await loadData(env, user), version = data.versions.find((item) => item.filename === filename);
    if (!version?.objectKey) return json({ error: '文件不存在' }, 404);
    const object = await getFile(env, version.objectKey); if (!object) return json({ error: '文件不存在' }, 404);
    return new Response(object.body, { headers: { 'Content-Type': object.contentType || 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Cache-Control': 'private, no-store' } });
  } catch (error) { return json({ error: error.message || '下载失败' }, 500); }
}
