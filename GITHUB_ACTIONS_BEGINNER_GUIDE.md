# GitHub Actions 自动部署教程（零基础版）

这份教程只讲“GitHub Actions 如何自动更新腾讯云网站”。

可以把它理解成一个自动快递员：代码放进 GitHub 后，快递员登录腾讯云服务器，把新代码送过去，重新启动网站，再检查网站有没有正常工作。

> 安全提醒：私钥和 Secrets 只能粘贴到 GitHub 的 Secret 输入框，不能提交到代码、发到聊天或截图。

## 1. 自动部署现在是什么状态

- 工作流名称：`Deploy Tencent Production`。
- 工作流文件：`.github/workflows/deploy-tencent.yml`。
- 腾讯云服务器项目目录：`/home/ubuntu/jobpilot-cn`。
- 自动部署变量：`TENCENT_AUTO_DEPLOY=true`。
- 推送到 `main` 分支后会自动部署。
- 第一次手动联调已经成功，耗时约 1 分钟。

## 2. 完整流程图

```text
本地修改代码
    ↓
测试通过
    ↓
提交并推送到 GitHub main
    ↓
GitHub Actions 自动启动
    ↓
使用专用 SSH 私钥登录腾讯云服务器
    ↓
服务器下载指定的 Git 提交
    ↓
Docker 重新构建并启动网站
    ↓
检查 /healthz
    ↓
绿色 Success = 发布完成
```

## 3. GitHub 页面入口在哪里

打开项目仓库：

```text
https://github.com/lebron123123/jobpilot-cn
```

常用入口：

- `Code`：查看代码。
- `Actions`：查看自动部署。
- `Settings`：管理 Secrets 和 Variables。

如果看不到 `Settings`，说明当前 GitHub 账号没有该仓库的管理员权限。

## 4. Secrets 和 Variables 有什么区别

| 类型 | 用途 | 页面是否显示内容 |
| --- | --- | --- |
| Secret | 保存私钥等机密 | 保存后不再显示原文 |
| Variable | 保存普通开关 | 可以看到和修改 |

进入位置：

```text
仓库 → Settings → Secrets and variables → Actions
```

然后会看到：

- `Secrets` 标签页。
- `Variables` 标签页。

## 5. 自动部署需要的四个 Secrets

在 `Secrets` 页面点击 `New repository secret`：

| Secret 名称 | 填什么 | 是否机密 |
| --- | --- | --- |
| `TENCENT_SERVER_HOST` | 腾讯云服务器公网 IP | 一般信息 |
| `TENCENT_SERVER_USER` | `ubuntu` | 一般信息 |
| `TENCENT_SERVER_KNOWN_HOSTS` | 服务器 Host Key 完整一行 | 用于确认服务器身份 |
| `TENCENT_SERVER_SSH_KEY_B64` | 专用私钥的单行 Base64 文本 | **高度机密** |

旧的 `TENCENT_SERVER_SSH_KEY` 已经不再使用，可以删除。

## 6. 为什么私钥要变成 Base64

SSH 私钥原来有很多行。网页复制时，如果少了换行或多了空格，GitHub 运行器就会报：

```text
Load key ...: error in libcrypto
```

Base64 会把多行私钥变成一长行，复制时不容易损坏。它只是改变保存形式，不是新的密码，也不是加密，所以仍然必须保密。

## 7. 如何生成 Base64 私钥

在腾讯云服务器终端运行：

```bash
base64 -w 0 ~/.ssh/jobpilot_github_actions
```

终端可能因为窗口宽度看起来有三行，但实际是一整行。

复制规则：

1. 从输出的第一个字符开始复制。
2. 一直复制到绿色 `ubuntu@VM...` 提示符之前。
3. 不要复制命令本身。
4. 不要复制绿色提示符。
5. 不要把内容发到聊天。

然后创建 Secret：

```text
Name: TENCENT_SERVER_SSH_KEY_B64
Secret: 粘贴完整 Base64 内容
```

## 8. Host Key 是什么

Host Key 相当于服务器的身份证。它可以防止自动部署连接到冒充的服务器。

在服务器运行：

```bash
printf '%s ' '你的服务器公网IP'; sudo awk '{print $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

把输出的完整一行保存到：

```text
TENCENT_SERVER_KNOWN_HOSTS
```

服务器重装系统后 Host Key 会改变，需要重新生成并更新这个 Secret。

## 9. 自动部署开关怎么使用

进入：

```text
Settings → Secrets and variables → Actions → Variables
```

变量名称：

```text
TENCENT_AUTO_DEPLOY
```

两种值：

| 值 | 效果 |
| --- | --- |
| `true` | 每次推送 `main` 都自动部署 |
| `false` | 推送 `main` 不部署，但仍可手动运行 |

目前还没有正式用户，使用 `true` 方便快速开发。有正式用户后建议改为 `false`，只在确认版本后手动或用版本标签发布。

## 10. 如何手动运行一次部署

1. 进入仓库的 `Actions`。
2. 左侧点击 `Deploy Tencent Production`。
3. 点击右侧 `Run workflow`。
4. Branch 选择 `main`。
5. 再点击绿色 `Run workflow`。
6. 等待新任务出现并点进去查看。

正常需要 1–5 分钟。40 秒还在运行完全正常，因为服务器正在下载代码和重建 Docker 镜像。

如果工作流刚刚被修改，不要点击旧任务的 `Re-run jobs`，应使用 `Run workflow` 创建一次新任务，这样才会使用最新工作流。

## 11. 如何看懂运行结果

| 图标/状态 | 意思 | 下一步 |
| --- | --- | --- |
| 黄色圆圈 / In progress | 正在运行 | 等待，不要重复点击 |
| 绿色对勾 / Success | 部署成功 | 刷新网站检查功能 |
| 红色叉号 / Failure | 部署失败 | 点开红色步骤查看错误 |
| 灰色 / Skipped | 条件不满足，任务被跳过 | 检查自动部署变量和触发方式 |

点开 `deploy` 后会看到几个步骤：

### `Set up job`

GitHub 正在准备一台临时运行电脑。

### `Configure dedicated SSH key`

把 Base64 私钥还原成 SSH 私钥，并检查格式是否有效。

### `Deploy exact Git revision`

登录服务器，下载这次指定版本，运行部署脚本并做健康检查。

## 12. 每次自动部署实际执行了什么

工作流会连接服务器并完成以下动作：

1. 进入 `/home/ubuntu/jobpilot-cn`。
2. 从 GitHub 获取最新提交和版本标签。
3. 只允许安全的快进更新。
4. 确认服务器正好使用本次 Git 提交。
5. 检查 Docker Compose 配置。
6. 重建并启动容器。
7. 等待应用变为健康状态。
8. 请求 `/healthz`。
9. 成功后清理旧的无用镜像。

如果健康检查失败，Actions 会标红并输出末尾日志，但不会删除持久数据卷。

## 13. 日常开发时怎么触发自动更新

开发人员在本地确认测试通过后执行：

```bash
git add -A
git commit -m "说明这次修改了什么"
git push origin main
```

意思分别是：

1. 把本次文件修改放入待提交区。
2. 制作一个有说明文字的代码版本。
3. 上传到 GitHub `main`，自动部署随即启动。

不要在测试失败时推送，也不要把 `.env.production` 或任何密钥提交进去。

## 14. 有正式用户后如何发布版本

正式运营后，不建议每个小修改都立刻更新用户网站。

先把变量改为：

```text
TENCENT_AUTO_DEPLOY=false
```

经过测试后创建版本标签：

```bash
git tag -a v1.0.0 -m "JobPilot CN v1.0.0"
git push origin v1.0.0
```

下一次正式版本可以是：

```text
v1.0.1  小问题修复
v1.1.0  增加新功能
v2.0.0  大版本升级
```

当前工作流遇到 `v1.0.0` 这类标签也会自动部署。

## 15. 常见错误怎么解决

### 错误一：`error in libcrypto`

原因：私钥换行损坏或 Secret 填错。

解决：重新运行 Base64 命令，完整复制一行并更新 `TENCENT_SERVER_SSH_KEY_B64`。

### 错误二：`Permission denied (publickey,password)`

原因可能是：

- 私钥不正确。
- 服务器用户名不是 `ubuntu`。
- 对应公钥没有放入服务器的 `authorized_keys`。

服务器上可以检查：

```bash
ls -l ~/.ssh/authorized_keys
```

不要把文件内容截图或发到聊天。

### 错误三：`Host key verification failed`

原因：`TENCENT_SERVER_KNOWN_HOSTS` 缺失或服务器重装后身份证改变。

解决：重新生成 Host Key 完整一行并更新 Secret。

### 错误四：`Missing TENCENT_SERVER_SSH_KEY_B64`

原因：新 Secret 没创建、名字拼错，或者创建在 Environment secrets 而工作流无法读取。

确认名称必须完全一致，不能多空格：

```text
TENCENT_SERVER_SSH_KEY_B64
```

### 错误五：部署一直黄色

1–5 分钟通常正常。如果超过 10 分钟：

1. 点开正在运行的步骤。
2. 查看停在哪一条命令。
3. 不要连续多次点击 Run workflow。
4. 可以按右上角取消任务，再根据日志处理。

### 错误六：显示 Success，但网站内容没变化

检查：

1. Actions 显示的短提交号是否是最新提交。
2. 浏览器按 `Ctrl + F5` 强制刷新。
3. 服务器运行 `git log -1 --oneline` 查看当前版本。
4. 服务器运行健康检查和容器状态检查。

## 16. 密钥管理规则

必须遵守：

- 私钥只能保存在 GitHub Secret 中。
- 公钥可以放在服务器 `authorized_keys` 中。
- Secret 保存后 GitHub 不会再次显示原文，这是正常的。
- 不在代码、Issue、聊天、截图、日志中粘贴私钥。
- 怀疑泄露时，立即删除旧公钥和 Secret，生成一套新密钥。
- 不使用服务器登录密码做自动部署。
- 不使用个人日常 SSH 私钥做自动部署。

当前部署已经验证成功后，旧的 `TENCENT_SERVER_SSH_KEY` 可以从 GitHub 删除，只保留 `TENCENT_SERVER_SSH_KEY_B64`。

## 17. 每次发布后的检查清单

1. GitHub Actions 是否为绿色 `Success`。
2. 显示的 Git 提交号是否正确。
3. 网站首页是否能打开。
4. 浏览器强制刷新后是否看到新功能。
5. 登录、上传简历等关键功能是否正常。
6. 服务器 `/healthz` 是否成功。
7. 发现异常时先记录提交号和日志，不要删除数据卷。

## 18. 当前阶段推荐做法

- 开发阶段：`TENCENT_AUTO_DEPLOY=true`，每次通过测试的 `main` 提交自动更新。
- 有首批真实用户后：改为 `false`，按 `v1.0.0`、`v1.1.0` 发布。
- 每次发布前：测试、备份、记录旧版本号。
- 每次发布后：检查 Actions、网站页面、登录和健康接口。
