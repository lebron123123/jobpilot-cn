const crypto = require('crypto');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key, value, encoding) => crypto.createHmac('sha256', key).update(value).digest(encoding);

async function sendTencentEmail(env, email, code, fetcher = fetch, timestamp = Math.floor(Date.now() / 1000)) {
  const required = ['TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY', 'TENCENT_SES_FROM_EMAIL', 'TENCENT_SES_TEMPLATE_ID'];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`腾讯云邮件缺少配置：${missing.join('、')}`);
  const host = 'ses.tencentcloudapi.com', action = 'SendEmail', version = '2020-10-02', region = env.TENCENT_SES_REGION || 'ap-guangzhou';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payload = JSON.stringify({
    FromEmailAddress: env.TENCENT_SES_FROM_EMAIL,
    Destination: [email],
    Subject: env.TENCENT_SES_SUBJECT || 'JobPilot CN 注册验证码',
    Template: {
      TemplateID: Number(env.TENCENT_SES_TEMPLATE_ID),
      TemplateData: JSON.stringify({ code, minutes: String(env.EMAIL_CODE_MINUTES || '5') })
    },
    TriggerType: 1,
    ...(env.TENCENT_SES_REPLY_TO ? { ReplyToAddresses: env.TENCENT_SES_REPLY_TO } : {})
  });
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`, signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256(payload)}`;
  const credentialScope = `${date}/ses/tc3_request`, stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`;
  const secretDate = hmac(`TC3${env.TENCENT_SECRET_KEY}`, date), secretService = hmac(secretDate, 'ses'), secretSigning = hmac(secretService, 'tc3_request');
  const signature = hmac(secretSigning, stringToSign, 'hex');
  const authorization = `TC3-HMAC-SHA256 Credential=${env.TENCENT_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetcher(`https://${host}`, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json; charset=utf-8', Host: host, 'X-TC-Action': action, 'X-TC-Timestamp': String(timestamp), 'X-TC-Version': version, 'X-TC-Region': region }, body: payload });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.Response?.Error) throw new Error(result.Response?.Error?.Message || '腾讯云邮件发送失败');
  return { sent: true, mode: 'tencent-ses', requestId: result.Response?.RequestId || '', messageId: result.Response?.MessageId || '' };
}

module.exports = { sendTencentEmail };
