# SSH 管理（@local/dsh-ssh-hosts）

一个 DSH Web 插件：在左侧面板列表的「自动化任务」入口下方加入 **SSH 管理**，打开后可以维护远程 SSH 主机、从 `~/.ssh/config` 导入，并对主机做一次 SSH 连通性检查。

## 功能

- **主机列表**：显示名称、`user@host:port`、连接状态与失败原因。
- **添加 / 编辑**：名称、主机、端口、用户、密钥文件、密码、私钥口令、跳板、默认工作区、远端 CLI 安装方式、API 密钥存放位置；支持「使用 `~/.ssh/config` 补全未设置的连接参数」。
- **从 `~/.ssh/config` 导入**：解析 `Host` 块、全局默认值、`Host *` 默认值和 `Include`（含通配符），在对话框里勾选后导入。
- **连接**：调用本机 OpenSSH 客户端执行一次有超时上限的连通性检查（`ssh ... true`），把结果与错误摘要显示在列表里。
- **删除**：删除主机记录，并一并删除 DSH 凭据中保存的密码/口令。

## 数据与安全

- 主机记录保存在 `$DSH_HOME/ssh-hosts/hosts.json`（默认 `~/.dsh/ssh-hosts/hosts.json`），文件权限 `0600`。
- 密码与私钥口令保存在 DSH 的 `credentials` 服务里，键为 `ssh-hosts/host-<id>`，**不会**写入 `hosts.json`。
- 连接检查通过 `ctx.subprocess` 以 argv 数组启动 `ssh`，不经过 shell；密码/口令通过一个权限为 `0700` 的临时 askpass 脚本和子进程环境变量传给 `ssh`。
- 首次连接使用 `StrictHostKeyChecking=accept-new`（TOFU），之后沿用 `known_hosts` 校验。

## 安装

包名 `@local/dsh-ssh-hosts`，本身就是一个 DSH bundle（`cordis.patch.yml` 会注册 `ssh-hosts` 条目）。

- **本地开发**：在 profile 的 `package.json` 依赖里写成 `"@local/dsh-ssh-hosts": "link:/path/to/dsh-ssh-remote"`，并在 `dsh.profile.bundles` 中列出。
- **从 GitHub 安装**：在 Web 的「插件」页安装或用 `plugin_manager` 工具 `install_bundle`，spec 为
  `https://github.com/SQDR2/dsh-ssh-remote.git`（也可用 `git+https://github.com/SQDR2/dsh-ssh-remote.git`）。
  如果所在网络无法直连 GitHub，可先在本地克隆再用 `link:` 方式。

## 使用

启用后刷新 Web 页面，在左侧面板列表的「自动化任务」下方点「SSH 管理」。或者直接在插件管理页看到 `SSH hosts` 条目。

## 当前范围

「连接」是连通性检查，不会建立常驻的远程会话，也不会在远端启动 DSH。若后续需要真正的远程会话，可以在这个主机记录之上接入 `ctx.ssh` / `subprocess-ssh` 或打开远程终端。

「默认工作区」「远端 CLI 安装方式」「API 密钥存放位置」目前会保存在主机记录中，供后续远程会话能力使用，连通性检查不会读取它们。
