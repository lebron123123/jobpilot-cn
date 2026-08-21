# 腾讯云服务器操作教程（零基础版）

这份教程只讲“腾讯云服务器”。可以把服务器理解成一台放在腾讯机房、24 小时开机的远程电脑。网站代码、Docker 和网站数据都放在这台电脑里。

> 安全提醒：密码、私钥、腾讯云 SecretId、SecretKey、短信验证码都不能发到聊天、截图或提交到 GitHub。

## 1. 我们已经完成了什么

- 购买了腾讯云轻量应用服务器：Ubuntu 22.04、2 核 CPU、4 GB 内存。
- 安装了 Git、Docker 和 Docker Compose。
- 从 GitHub 下载了 `jobpilot-cn` 项目。
- 使用 Docker 启动了网站程序和 Caddy 网关。
- 在腾讯云防火墙开放了 80、443 端口。
- 网站已经可以通过服务器公网 IP 访问。
- GitHub Actions 已经能够自动连接服务器并更新网站。

## 2. 每个名词是什么意思

| 名词 | 小学生版解释 |
| --- | --- |
| Ubuntu | 服务器使用的操作系统，类似 Windows。 |
| 终端 | 输入命令的黑色窗口。 |
| SSH | 安全地远程控制服务器的方法。 |
| Git | 管理代码版本的工具，像代码的“时光机”。 |
| GitHub | 存放 Git 代码的网上仓库。 |
| Docker | 把网站和运行环境装进标准“盒子”。 |
| 镜像 | 制作 Docker 盒子的模板。 |
| 容器 | 根据镜像真正运行起来的程序。 |
| Docker Compose | 一次管理多个容器的工具。 |
| Caddy | 网站的门卫，把 80/443 端口的访问交给网站程序。 |
| 端口 | 服务器上的门牌号；网页通常使用 80 和 443。 |
| 环境变量 | 网站运行时使用的配置，例如域名和短信密钥。 |
| 健康检查 | 询问网站“你还活着吗”。返回 200 就表示正常。 |

## 3. 如何进入服务器终端

1. 打开腾讯云控制台。
2. 进入“轻量应用服务器”。
3. 找到自己的 Ubuntu 服务器。
4. 点击“登录”。
5. 看到类似下面的绿色提示符，就已经进入服务器：

```text
ubuntu@VM-0-9-ubuntu:~$
```

提示符后面才是输入命令的位置。不要把网页说明文字一起粘贴进去。

## 4. 最常用的三个动作

### 4.1 进入项目文件夹

```bash
cd ~/jobpilot-cn
```

- `cd` 的意思是“进入文件夹”。
- `~` 代表当前用户的家目录，即 `/home/ubuntu`。
- 成功后提示符会包含 `jobpilot-cn`。

查看自己现在在哪里：

```bash
pwd
```

正常结果：

```text
/home/ubuntu/jobpilot-cn
```

### 4.2 查看网站是否运行

```bash
cd ~/jobpilot-cn
docker compose --env-file .env.production ps
```

正常时应看到：

- `app` 是 `Up` 或 `healthy`。
- `caddy` 是 `Up`。
- 80 和 443 端口已经映射。

### 4.3 查看网站日志

```bash
cd ~/jobpilot-cn
docker compose --env-file .env.production logs --tail=100 app
```

- `logs` 是查看日志。
- `--tail=100` 是只看最后 100 行。
- 只看不修改任何东西，可以放心执行。

查看 Caddy 日志：

```bash
docker compose --env-file .env.production logs --tail=100 caddy
```

## 5. 当初安装环境时做了什么

以下命令已经执行过，通常不需要重复执行。

### 5.1 更新软件清单

```bash
sudo apt update
```

- `sudo` 表示临时使用管理员权限。
- `apt update` 只是更新“可安装软件清单”，不是更新网站。

### 5.2 安装 Docker

```bash
sudo apt install -y docker.io
sudo systemctl enable --now docker
```

- 第一行安装 Docker。
- 第二行立即启动 Docker，并设置服务器重启后自动启动。

### 5.3 安装 Docker Compose

```bash
sudo apt install -y docker-compose-v2
```

检查是否安装成功：

```bash
docker --version
docker compose version
```

只要两条命令都显示版本号，就表示正常。

### 5.4 让 ubuntu 用户可以使用 Docker

```bash
sudo usermod -aG docker ubuntu
newgrp docker
```

- 第一行把 `ubuntu` 加入 Docker 用户组。
- 第二行让权限立即生效。

测试 Docker：

```bash
docker run --rm hello-world
```

如果显示 `Hello from Docker!`，表示 Docker 正常。

## 6. 当初下载和启动网站时做了什么

### 6.1 从 GitHub 下载代码

```bash
git clone https://github.com/lebron123123/jobpilot-cn.git
cd jobpilot-cn
```

- `git clone` 是第一次把完整项目下载到服务器。
- 以后更新不要再次 clone，而是使用自动部署或 `git pull`。

### 6.2 创建正式环境配置

```bash
cp .env.production.example .env.production
nano .env.production
```

- `cp` 是复制文件。
- `.env.production` 是正式服务器配置，Git 不会上传它。
- `nano` 是终端里的文本编辑器。

在 Nano 中：

- 保存：按 `Ctrl + O`，再按回车。
- 退出：按 `Ctrl + X`。
- 放弃未保存内容：按 `Ctrl + X`，再按 `N`。

目前基础配置类似：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=4173
APP_DOMAIN=http://你的服务器公网IP
ACME_EMAIL=你的邮箱
```

当前个人开发阶段使用腾讯云 SES 邮箱验证码。必须先拥有域名，并完成发信域名、发信地址和邮件模板配置；真实密钥只能写在服务器 `.env.production` 中。企业短信资质办好后再补充短信变量。

### 6.3 检查配置是否能被 Docker 读取

```bash
docker compose --env-file .env.production config --quiet
```

没有任何输出通常就是成功；显示红色错误就不要继续启动。

### 6.4 构建并启动网站

```bash
docker compose --env-file .env.production up -d --build
```

- `up` 是启动。
- `-d` 是放到后台运行，关闭终端网站也不会停。
- `--build` 是用最新代码重新制作镜像。
- 第一次可能需要几分钟，看到 `Healthy` 和 `Started` 表示成功。

## 7. 腾讯云防火墙为什么要开放端口

在腾讯云控制台进入服务器的“防火墙”，添加 TCP 规则：

| 来源 | 协议 | 端口 | 策略 | 用途 |
| --- | --- | --- | --- | --- |
| 全部 IPv4 地址 | TCP | `80,443` | 允许 | 访问 HTTP 和 HTTPS 网站 |

22 端口用于 SSH 登录。如果已经有系统自动创建的 SSH 规则，不要重复添加。

不要为了省事开放数据库端口，也不要随便开放全部端口。

## 8. 如何检查网站是否真正正常

### 8.1 在服务器内部检查

```bash
curl -fsS http://127.0.0.1/healthz
```

正常返回类似：

```json
{"ok":true,"service":"jobpilot-cn"}
```

这里的 `127.0.0.1` 代表服务器自己。

### 8.2 查看端口是否有人监听

```bash
sudo ss -lntp | grep -E ':(80|443)'
```

正常时会看到 80、443 和 `docker-proxy`。

### 8.3 在自己的电脑浏览器检查

在浏览器地址栏输入：

```text
http://你的服务器公网IP/
```

如果内部健康检查成功，但外部打不开，优先检查腾讯云防火墙的 80 端口。

## 9. 网站更新的两种方式

### 9.1 推荐：GitHub Actions 自动更新

现在已经启用。代码推送到 GitHub `main` 分支后，GitHub 会自动连接服务器、更新代码、重建容器并检查健康状态。详细操作见 `GITHUB_ACTIONS_BEGINNER_GUIDE.md`。

### 9.2 备用：手动更新

只有自动部署故障时才使用：

```bash
cd ~/jobpilot-cn
git pull --ff-only
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
curl -fsS http://127.0.0.1/healthz
```

每一行的意思：

1. 进入项目目录。
2. 从 GitHub 下载最新代码，而且禁止危险的自动合并。
3. 重新构建并启动网站。
4. 查看容器状态。
5. 检查网站是否健康。

## 10. 停止、重启和恢复

### 10.1 只重启网站

```bash
cd ~/jobpilot-cn
docker compose --env-file .env.production restart
```

### 10.2 停止网站

```bash
docker compose --env-file .env.production stop
```

网站会暂时无法访问，但数据卷不会删除。

### 10.3 再次启动网站

```bash
docker compose --env-file .env.production start
```

### 10.4 服务器重启后检查

```bash
cd ~/jobpilot-cn
docker compose --env-file .env.production ps
curl -fsS http://127.0.0.1/healthz
```

## 11. 版本出问题时如何回滚

先查看最近版本：

```bash
cd ~/jobpilot-cn
git log --oneline -5
```

记住上一个正常版本的短编号，例如 `9099b67`。回滚会改变服务器代码版本，不熟悉时先停止并询问，不要自行运行 `git reset --hard`。

安全做法是使用已经验证的版本标签发布，或者由开发人员确认精确提交后再切换和重建。

## 12. 常见错误怎么判断

### 错误一：`docker: command not found`

原因：Docker 没安装。回到第 5 节安装。

### 错误二：`permission denied while trying to connect to Docker`

原因：当前用户还没有 Docker 权限。执行：

```bash
sudo usermod -aG docker ubuntu
newgrp docker
```

### 错误三：拉取 Docker 镜像超时

原因：中国大陆访问 Docker Hub 可能不稳定。我们已经配置过镜像加速；不要反复卸载 Docker。

### 错误四：容器显示 `unhealthy`

先看日志：

```bash
docker compose --env-file .env.production logs --tail=200 app
```

不要立即删除容器或数据卷。

### 错误五：服务器内部正常，浏览器打不开

检查：

1. 腾讯云防火墙是否允许 TCP 80。
2. `docker compose ... ps` 中 Caddy 是否运行。
3. `sudo ss -lntp | grep -E ':(80|443)'` 是否有结果。

## 13. 绝对不要执行的危险命令

没有确认精确目标前，不要执行：

```text
rm -rf ...
docker volume rm ...
docker system prune --volumes
git reset --hard
```

这些命令可能删除网站、用户数据或未提交配置。看到网上教程要求执行时，先询问。

## 14. 每次维护的最短检查清单

```bash
cd ~/jobpilot-cn
git log -1 --oneline
docker compose --env-file .env.production ps
curl -fsS http://127.0.0.1/healthz
docker compose --env-file .env.production logs --tail=30 app
```

四项都正常，再在自己电脑浏览器打开网站检查登录、上传和主要页面。
