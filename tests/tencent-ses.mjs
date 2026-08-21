import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sendTencentEmail } = require('../services/tencent-ses');
const env = { TENCENT_SECRET_ID: '[系统测试]secret-id', TENCENT_SECRET_KEY: '[系统测试]secret-key', TENCENT_SES_FROM_EMAIL: 'JobPilot CN <noreply@mail.example.com>', TENCENT_SES_TEMPLATE_ID: '100000', TENCENT_SES_REGION: 'ap-guangzhou' };
let captured;
const fetcher = async (url, options) => { captured = { url, options }; return new Response(JSON.stringify({ Response: { MessageId: '[系统测试]message', RequestId: '[系统测试]request' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
const result = await sendTencentEmail(env, 'system-test@example.com', '123456', fetcher, 1787184000);
assert.equal(result.mode, 'tencent-ses');
assert.equal(captured.url, 'https://ses.tencentcloudapi.com');
assert.match(captured.options.headers.Authorization, /^TC3-HMAC-SHA256 Credential=\[系统测试\]secret-id\//);
const payload = JSON.parse(captured.options.body);
assert.deepEqual(payload.Destination, ['system-test@example.com']);
assert.equal(payload.Template.TemplateID, 100000);
assert.deepEqual(JSON.parse(payload.Template.TemplateData), { code: '123456', minutes: '5' });
assert.equal(payload.TriggerType, 1);
await assert.rejects(() => sendTencentEmail({}, 'system-test@example.com', '123456', fetcher), /缺少配置/);
console.log(JSON.stringify({ ok: true, provider: 'tencent-ses', tc3Signed: true }));
