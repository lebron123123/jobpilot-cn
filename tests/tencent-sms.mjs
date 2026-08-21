import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sendTencentSms } = require('../services/tencent-sms');
const env = { TENCENT_SECRET_ID: '[系统测试]secret-id', TENCENT_SECRET_KEY: '[系统测试]secret-key', TENCENT_SMS_SDK_APP_ID: '1400000000', TENCENT_SMS_SIGN_NAME: '[系统测试]JobPilot', TENCENT_SMS_TEMPLATE_ID: '1000000', TENCENT_SMS_REGION: 'ap-guangzhou' };
let captured;
const fetcher = async (url, options) => { captured = { url, options }; return new Response(JSON.stringify({ Response: { SendStatusSet: [{ Code: 'Ok', Message: 'send success' }], RequestId: '[系统测试]request' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
const result = await sendTencentSms(env, '13900000000', '123456', fetcher, 1787184000);
assert.equal(result.mode, 'tencent');
assert.equal(captured.url, 'https://sms.tencentcloudapi.com');
assert.match(captured.options.headers.Authorization, /^TC3-HMAC-SHA256 Credential=\[系统测试\]secret-id\//);
assert.deepEqual(JSON.parse(captured.options.body).PhoneNumberSet, ['+8613900000000']);
assert.deepEqual(JSON.parse(captured.options.body).TemplateParamSet, ['123456', '5']);
await assert.rejects(() => sendTencentSms({}, '13900000000', '123456', fetcher), /缺少配置/);
console.log(JSON.stringify({ ok: true, provider: 'tencent', tc3Signed: true }));
