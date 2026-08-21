# 腾讯云正式部署手册

当前主部署目标是腾讯云中国大陆 CVM 或轻量应用服务器。Cloudflare Pages 只保留历史兼容代码，不再作为中国大陆正式入口。

## 1. 上线前必须准备

1. 一个企业实名认证的腾讯云账号。
2. 一个自有域名，并完成 ICP 备案。服务器选择中国大陆地域（深圳/广州优先），包年包月至少 3 个月且公网带宽不能为 0。
3. 一台安装了 Docker Engine 与 Docker Compose Plugin 的 Ubuntu 22.04/24.04 服务器，安全组开放 TCP 22、80、443 和 UDP 443。
4. DNS 添加一条 A 记录，把正式域名指向服务器公网 IP。
5. 一个自有域名，以及腾讯云 SES 已验证的发信子域名、发信地址和验证码模板。模板变量使用：`{{code}}` 验证码、`{{minutes}}` 有效分钟数。
6. 一个仅有 SES 邮件发送权限的腾讯云 CAM 子用户密钥，禁止使用主账号永久密钥。企业短信资质办好后可在同一账号补充短信权限。

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
| `TENCENT_SES_FROM_EMAIL` | 已验证发信地址，如 `JobPilot CN <noreply@mail.example.com>` | 否 |
| `TENCENT_SES_TEMPLATE_ID` | 已审核通过的邮件验证码模板 ID | 否 |
| `TENCENT_SES_REGION` | 推荐 `ap-guangzhou` | 否 |
| `TENCENT_SES_SUBJECT` | `JobPilot CN 注册验证码` | 否 |
| `TENCENT_SES_REPLY_TO` | 可选的回复邮箱 | 否 |
| `EMAIL_CODE_MINUTES` | 当前必须是 `5` | 否 |
| `TENCENT_SMS_SDK_APP_ID` | 短信控制台应用 SDK AppID | 否 |
| `TENCENT_SMS_SIGN_NAME` | 审核通过的签名文字，不带方括号 | 否 |
| `TENCENT_SMS_TEMPLATE_ID` | 审核通过的验证码模板 ID | 否 |
| `TENCENT_SMS_REGION` | 推荐 `ap-guangzhou` | 否 |
| `SMS_CODE_MINUTES` | 当前必须是 `5` | 否 |

当前新用户默认使用邮箱验证码注册，手机号选填；旧手机号账号仍可登录。`SMS_WEBHOOK_URL` 与 `SMS_WEBHOOK_TOKEN` 仅供已有自建短信网关时备用，企业短信资质通过后再开启短信注册入口。

## 4. 更新、日志与回滚

```bash
git pull --ff-only
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production logs --tail=200 app
git log --oneline -5
```

发布前记录当前 Git commit。若新版本异常，切回已验证 commit 后重新执行 `docker compose ... up -d --build`。数据卷不会随容器重建删除。

### GitHub Actions 自动部署

仓库包含 `.github/workflows/deploy-tencent.yml`。默认情况下，推送 `main` 不会部署；只有仓库变量 `TENCENT_AUTO_DEPLOY=true` 后才会自动部署。`v1.0.0`、`v1.1.0` 等版本标签和手动运行工作流始终会触发部署。

在服务器生成专用密钥（不要使用服务器登录密码）：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/jobpilot_github_actions -N '' -C github-actions-jobpilot
cat ~/.ssh/jobpilot_github_actions.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

先把私钥转换成不会因网页粘贴而损坏的单行 Base64 文本：

```bash
base64 -w 0 ~/.ssh/jobpilot_github_actions
```

只把这条命令输出的完整单行内容粘贴到 GitHub，禁止截图或发送到聊天。在 GitHub 仓库 `Settings > Secrets and variables > Actions` 添加4个 Repository secrets：

| Secret | 值 |
| --- | --- |
| `TENCENT_SERVER_HOST` | 服务器公网IP |
| `TENCENT_SERVER_USER` | `ubuntu` |
| `TENCENT_SERVER_SSH_KEY_B64` | `base64 -w 0 ~/.ssh/jobpilot_github_actions` 输出的完整单行文本 |
| `TENCENT_SERVER_KNOWN_HOSTS` | 下方命令输出的完整一行 |

生成已固定的服务器Host Key记录：

```bash
printf '%s ' '你的服务器公网IP'; sudo awk '{print $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

最后在 GitHub `Variables` 新建 `TENCENT_AUTO_DEPLOY=true`，再进入 `Actions > Deploy Tencent Production > Run workflow` 做首次联调。有正式用户后把该变量改为 `false`，只用版本标签发布：

```bash
git tag -a v1.0.0 -m 'JobPilot CN v1.0.0'
git push origin v1.0.0
```

自动部署会锁定精确Git提交、执行快进更新、重建容器并验证应用健康状态。部署失败会在Actions中标红并输出末尾日志；当前单机阶段尚未实现自动回滚。

## 5. 数据备份与当前边界

首台服务器使用 Docker 持久卷保存账号状态和生成文件。每日备份 `jobpilot_data` 和 `jobpilot_generated` 两个卷，并在异机做恢复演练。

这套方式能稳定支撑单机试运营，但不是最终的多实例数据层。正式扩大流量前必须迁移为腾讯云 MySQL（结构化数据）、COS（简历/生成文件）、Redis（验证码、会话、限流），并补充云监控告警、WAF、数据导出/注销、隐私政策与等保评估。
