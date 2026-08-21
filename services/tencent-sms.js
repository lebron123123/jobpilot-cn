const crypto = require('crypto');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key, value, encoding) => crypto.createHmac('sha256', key).update(value).digest(encoding);

async function sendTencentSms(env, phone, code, fetcher = fetch, timestamp = Math.floor(Date.now() / 1000)) {
  const required = ['TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY', 'TENCENT_SMS_SDK_APP_ID', 'TENCENT_SMS_SIGN_NAME', 'TENCENT_SMS_TEMPLATE_ID'];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`腾讯云短信缺少配置：${missing.join('、')}`);
  const host = 'sms.tencentcloudapi.com', action = 'SendSms', version = '2021-01-11', region = env.TENCENT_SMS_REGION || 'ap-guangzhou';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payload = JSON.stringify({ PhoneNumberSet: [`+86${phone}`], SmsSdkAppId: env.TENCENT_SMS_SDK_APP_ID, SignName: env.TENCENT_SMS_SIGN_NAME, TemplateId: env.TENCENT_SMS_TEMPLATE_ID, TemplateParamSet: [code, String(env.SMS_CODE_MINUTES || '5')] });
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`, signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256(payload)}`;
  const credentialScope = `${date}/sms/tc3_request`, stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`;
  const secretDate = hmac(`TC3${env.TENCENT_SECRET_KEY}`, date), secretService = hmac(secretDate, 'sms'), secretSigning = hmac(secretService, 'tc3_request');
  const signature = hmac(secretSigning, stringToSign, 'hex');
  const authorization = `TC3-HMAC-SHA256 Credential=${env.TENCENT_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetcher(`https://${host}`, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json; charset=utf-8', Host: host, 'X-TC-Action': action, 'X-TC-Timestamp': String(timestamp), 'X-TC-Version': version, 'X-TC-Region': region }, body: payload });
  const result = await response.json().catch(() => ({})), status = result.Response?.SendStatusSet?.[0];
  if (!response.ok || result.Response?.Error || (status && status.Code !== 'Ok')) throw new Error(result.Response?.Error?.Message || status?.Message || '腾讯云短信发送失败');
  return { sent: true, mode: 'tencent', requestId: result.Response?.RequestId || '' };
}

module.exports = { sendTencentSms };
