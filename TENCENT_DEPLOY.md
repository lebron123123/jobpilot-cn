# 腾讯云正式部署手册

当前主部署目标是腾讯云中国大陆 CVM 或轻量应用服务器。Cloudflare Pages 只保留历史兼容代码，不再作为中国大陆正式入口。

## 1. 上线前必须准备

1. 一个企业实名认证的腾讯云账号。
2. 一个自有域名，并完成 ICP 备案。服务器选择中国大陆地域（深圳/广州优先），包年包月至少 3 个月且公网带宽不能为 0。
3. 一台安装了 Docker Engine 与 Docker Compose Plugin 的 Ubuntu 22.04/24.04 服务器，安全组开放 TCP 22、80、443 和 UDP 443。
4. DNS 添加一条 A 记录，把正式域名指向服务器公网 IP。
5. 腾讯云短信应用、已审核通过的国内短信签名和验证码模板。模板变量顺序必须是：`{1}` 验证码、`{2}` 有效分钟数。
6. 一个仅有短信发送权限的腾讯云 CAM 子用户密钥，禁止使用主账号永久密钥。

## 2. 从 Git 手动部署

```bash
git clone https://github.com/lebron123123/jobpilot-cn.git
cd jobpilot-cn
cp .env.production.example .env.production
nano .env.production
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
curl -fsS https://你的域名/healthz
```

Caddy 会在 DNS 已生效且 80/443 端口可访问时自动申请并续期 HTTPS 证书。不要把 `.env.production` 提交到 Git。

## 3. 必填环境变量

| 变量 | 示例/来源 | 是否保密 |
| --- | --- | --- |
| `NODE_ENV` | 固定 `production` | 否 |
| `HOST` | 固定 `0.0.0.0` | 否 |
| `PORT` | 固定 `4173` | 否 |
| `APP_DOMAIN` | 已备案域名，如 `jobs.example.com` | 否 |
| `ACME_EMAIL` | HTTPS 证书通知邮箱 | 否 |
| `TENCENT_SECRET_ID` | CAM 子用户 API 密钥 | 是 |
| `TENCENT_SECRET_KEY` | CAM 子用户 API 密钥 | **是** |
| `TENCENT_SMS_SDK_APP_ID` | 短信控制台应用 SDK AppID | 否 |
| `TENCENT_SMS_SIGN_NAME` | 审核通过的签名文字，不带方括号 | 否 |
| `TENCENT_SMS_TEMPLATE_ID` | 审核通过的验证码模板 ID | 否 |
| `TENCENT_SMS_REGION` | 推荐 `ap-guangzhou` | 否 |
| `SMS_CODE_MINUTES` | 当前必须是 `5` | 否 |

`SMS_WEBHOOK_URL` 与 `SMS_WEBHOOK_TOKEN` 仅供已有自建短信网关时备用；配置了腾讯云密钥后会优先直连腾讯云短信。

## 4. 更新、日志与回滚

```bash
git pull --ff-only
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production logs --tail=200 app
git log --oneline -5
```

发布前记录当前 Git commit。若新版本异常，切回已验证 commit 后重新执行 `docker compose ... up -d --build`。数据卷不会随容器重建删除。

## 5. 数据备份与当前边界

首台服务器使用 Docker 持久卷保存账号状态和生成文件。每日备份 `jobpilot_data` 和 `jobpilot_generated` 两个卷，并在异机做恢复演练。

这套方式能稳定支撑单机试运营，但不是最终的多实例数据层。正式扩大流量前必须迁移为腾讯云 MySQL（结构化数据）、COS（简历/生成文件）、Redis（验证码、会话、限流），并补充云监控告警、WAF、数据导出/注销、隐私政策与等保评估。
