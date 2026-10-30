window.__ModuleLoader__.load({
  id: '@local/dsh-ssh-hosts',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Main-panel and sidebar-entry identity. */
    const PANEL_ID = 'ssh-hosts'
    /** Client locale namespace. */
    const NS = 'sshHosts'

    const LOCALES = {
      en: {
        'menu.label': 'SSH hosts',
        title: 'SSH hosts',
        subtitle: 'Manage SSH hosts for remote development and operations. Connect runs a quick reachability check.',
        'action.add': 'Add host',
        'action.import': 'Import from ~/.ssh/config',
        'action.connect': 'Connect',
        'action.connecting': 'Connecting…',
        'action.edit': 'Edit',
        'action.delete': 'Delete',
        'action.cancel': 'Cancel',
        'action.save': 'Save',
        'action.saving': 'Saving…',
        'action.importSelected': 'Import {count}',
        'action.selectAll': 'Select all',
        'action.back': 'Back',
        'action.retry': 'Retry',
        'status.unknown': 'Not connected',
        'status.connected': 'Connected',
        'status.disconnected': 'Disconnected',
        'status.testing': 'Connecting…',
        'list.loading': 'Loading hosts…',
        'list.loadFailed': 'Could not load SSH hosts.',
        'list.emptyTitle': 'No SSH hosts yet',
        'list.emptyBody': 'Add a host or import one from ~/.ssh/config.',
        'list.connectFailed': 'Could not connect to {name}. Check the network and SSH configuration.',
        'list.timeout': 'Connecting to {name} timed out.',
        'list.sshMissing': 'The ssh command is not available on this machine.',
        'list.alias': '~/.ssh/config',
        'notice.added': 'Host added.',
        'notice.saved': 'Host saved.',
        'notice.deleted': 'Host deleted.',
        'notice.imported': 'Imported {count} host(s).',
        'form.addTitle': 'Add SSH host',
        'form.editTitle': 'Edit SSH host',
        'form.name': 'Name',
        'form.namePlaceholder': 'e.g. production-server',
        'form.host': 'Host',
        'form.hostPlaceholder': 'hostname or IP address',
        'form.port': 'Port',
        'form.useConfig': 'Use ~/.ssh/config to fill unset connection parameters',
        'form.useConfigHint': 'When enabled, the name is used as the Host alias; empty fields are resolved by SSH configuration.',
        'form.user': 'User',
        'form.userPlaceholder': 'SSH user',
        'form.identity': 'Identity file',
        'form.identityPlaceholder': '~/.ssh/id_ed25519',
        'form.password': 'Password (optional)',
        'form.passwordHint': 'Saved in DSH credentials, never written to the host file.',
        'form.passwordStored': 'A password is saved. Leave blank to keep it.',
        'form.passphrase': 'Private key passphrase (optional)',
        'form.passphraseHint': 'Only used to unlock an encrypted private key file.',
        'form.passphraseStored': 'A passphrase is saved. Leave blank to keep it.',
        'form.jump': 'Jump host',
        'form.jumpPlaceholder': 'user@bastion or a ~/.ssh/config alias',
        'form.workspace': 'Default workspace',
        'form.workspacePlaceholder': '/home/user/project',
        'form.install': 'Remote CLI install',
        'form.apiKey': 'API key storage',
        'form.install.auto': 'Auto',
        'form.install.off': 'Do not install',
        'form.install.always': 'Always install',
        'form.apiKey.remote': 'On the remote host',
        'form.apiKey.local': 'On the local host',
        'form.nameRequired': 'Enter a name.',
        'form.hostRequired': 'Enter a host, or enable ~/.ssh/config lookup.',
        'form.portInvalid': 'Port must be a number from 1 to 65535.',
        'form.nameTaken': 'Another host already uses this name.',
        'form.saveFailed': 'Could not save the host.',
        'form.credentialsUnavailable': 'Password storage is unavailable in this profile.',
        'import.title': 'Import from ~/.ssh/config',
        'import.loading': 'Reading ~/.ssh/config…',
        'import.empty': 'No importable hosts were found in {path}.',
        'import.failed': 'Could not read ~/.ssh/config.',
        'import.alreadyAdded': 'Added',
        'import.count': '{count} host(s) found',
        'import.nothing': 'Nothing to import.',
        'delete.title': 'Delete SSH host',
        'delete.body': 'Delete “{name}”? This removes its saved password and passphrase, but no remote files.',
        'delete.confirm': 'Delete',
        'delete.busy': 'Deleting…',
        'error.unknown': 'Something went wrong.',
      },
      zh: {
        'menu.label': 'SSH 管理',
        title: '远程 SSH 主机',
        subtitle: '管理用于远程开发与运维的 SSH 主机；「连接」会执行一次 SSH 连通性检查。',
        'action.add': '添加主机',
        'action.import': '从 ~/.ssh/config 导入',
        'action.connect': '连接',
        'action.connecting': '连接中…',
        'action.edit': '编辑',
        'action.delete': '删除',
        'action.cancel': '取消',
        'action.save': '保存',
        'action.saving': '保存中…',
        'action.importSelected': '导入所选（{count}）',
        'action.selectAll': '全选',
        'action.back': '返回',
        'action.retry': '重试',
        'status.unknown': '未连接',
        'status.connected': '已连接',
        'status.disconnected': '已断开',
        'status.testing': '连接中…',
        'list.loading': '正在加载主机…',
        'list.loadFailed': '无法加载 SSH 主机。',
        'list.emptyTitle': '还没有 SSH 主机',
        'list.emptyBody': '添加一台主机，或从 ~/.ssh/config 导入。',
        'list.connectFailed': '无法连接到 {name}，请检查网络和 SSH 配置。',
        'list.timeout': '连接 {name} 超时。',
        'list.sshMissing': '本机找不到 ssh 命令。',
        'list.alias': '~/.ssh/config',
        'notice.added': '主机已添加。',
        'notice.saved': '主机已保存。',
        'notice.deleted': '主机已删除。',
        'notice.imported': '已导入 {count} 台主机。',
        'form.addTitle': '添加 SSH 主机',
        'form.editTitle': '编辑 SSH 主机',
        'form.name': '名称',
        'form.namePlaceholder': '例如：生产服务器',
        'form.host': '主机',
        'form.hostPlaceholder': '主机名或 IP 地址',
        'form.port': '端口',
        'form.useConfig': '使用 ~/.ssh/config 补全未设置的连接参数',
        'form.useConfigHint': '启用后，名称会作为 Host 别名；留空的参数由 SSH 配置补全。',
        'form.user': '用户',
        'form.userPlaceholder': 'SSH 用户',
        'form.identity': '密钥文件',
        'form.identityPlaceholder': '~/.ssh/id_ed25519',
        'form.password': '密码（可选）',
        'form.passwordHint': '保存在 DSH 凭据中，不会写入主机配置文件。',
        'form.passwordStored': '已保存密码，留空保持不变。',
        'form.passphrase': '私钥口令（可选）',
        'form.passphraseHint': '仅用于解锁加密的私钥文件。',
        'form.passphraseStored': '已保存口令，留空保持不变。',
        'form.jump': '跳板',
        'form.jumpPlaceholder': 'user@bastion 或 ~/.ssh/config 别名',
        'form.workspace': '默认工作区',
        'form.workspacePlaceholder': '/home/user/project',
        'form.install': '远端 CLI 安装方式',
        'form.apiKey': 'API 密钥存放位置',
        'form.install.auto': '自动',
        'form.install.off': '不安装',
        'form.install.always': '总是安装',
        'form.apiKey.remote': '在远程主机上',
        'form.apiKey.local': '在本地主机上',
        'form.nameRequired': '请输入名称。',
        'form.hostRequired': '请输入主机，或启用 ~/.ssh/config 补全。',
        'form.portInvalid': '端口必须是 1 到 65535 之间的数字。',
        'form.nameTaken': '已存在同名主机。',
        'form.saveFailed': '无法保存主机。',
        'form.credentialsUnavailable': '当前配置无法保存密码（凭据服务不可用）。',
        'import.title': '从 ~/.ssh/config 导入',
        'import.loading': '正在读取 ~/.ssh/config…',
        'import.empty': '在 {path} 中没有找到可导入的主机。',
        'import.failed': '无法读取 ~/.ssh/config。',
        'import.alreadyAdded': '已添加',
        'import.count': '找到 {count} 台主机',
        'import.nothing': '没有可导入的主机。',
        'delete.title': '删除 SSH 主机',
        'delete.body': '确定删除「{name}」吗？保存的密码和口令会一并删除，远程文件不受影响。',
        'delete.confirm': '删除',
        'delete.busy': '删除中…',
        'error.unknown': '出现未知错误。',
      },
    }

    const CSS = `
      .dsh-ssh-hosts-page {
        box-sizing: border-box;
        height: 100%;
        overflow-x: hidden;
        overflow-y: auto;
        padding: 28px clamp(20px, 4vw, 48px) 48px;
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-bg-base);
      }
      .dsh-ssh-hosts-inner { width: 100%; max-width: 960px; margin: 0 auto; }
      .dsh-ssh-hosts-head {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 16px; flex-wrap: wrap; margin-bottom: 20px;
      }
      .dsh-ssh-hosts-headGroup { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .dsh-ssh-hosts-title { margin: 0; font-size: 18px; line-height: 26px; font-weight: 600; letter-spacing: -0.01em; }
      .dsh-ssh-hosts-subtitle {
        margin: 4px 0 0; font-size: 12px; line-height: 18px;
        color: var(--dsw-alias-label-secondary);
      }
      .dsh-ssh-hosts-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .dsh-ssh-hosts-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        height: 32px; padding: 0 12px; border: 0.5px solid transparent; border-radius: 8px;
        font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; white-space: nowrap;
      }
      .dsh-ssh-hosts-btn:focus-visible, .dsh-ssh-hosts-icon-btn:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px;
      }
      .dsh-ssh-hosts-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .dsh-ssh-hosts-btn--primary {
        background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary));
        color: var(--dsw-alias-label-primary-foreground, #fff);
      }
      .dsh-ssh-hosts-btn--primary:hover:not(:disabled) {
        background: var(--dsw-alias-button-primary-hover, color-mix(in srgb, var(--dsw-alias-brand-primary) 88%, #000));
      }
      .dsh-ssh-hosts-btn--outline {
        border-color: var(--dsw-alias-border-l2);
        background: transparent; color: var(--dsw-alias-label-primary);
      }
      .dsh-ssh-hosts-btn--outline:hover:not(:disabled) {
        background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
      }
      .dsh-ssh-hosts-btn--ghost { background: transparent; color: var(--dsw-alias-label-primary); }
      .dsh-ssh-hosts-btn--ghost:hover:not(:disabled) {
        background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
      }
      .dsh-ssh-hosts-btn--small { height: 30px; padding: 0 12px; font-size: 12px; border-radius: 7px; }
      .dsh-ssh-hosts-icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; padding: 0; border: 0.5px solid var(--dsw-alias-border-l2);
        border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
      }
      .dsh-ssh-hosts-icon-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
        color: var(--dsw-alias-label-primary);
      }
      .dsh-ssh-hosts-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .dsh-ssh-hosts-icon-btn--danger:hover:not(:disabled) {
        color: var(--dsw-alias-state-error-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent);
      }
      .dsh-ssh-hosts-card {
        border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 10px;
        background: var(--dsw-alias-bg-layer-1); overflow: hidden;
      }
      .dsh-ssh-hosts-row { display: flex; align-items: flex-start; gap: 16px; padding: 14px 16px; }
      .dsh-ssh-hosts-row + .dsh-ssh-hosts-row { border-top: 0.5px solid var(--dsw-alias-border-l1); }
      .dsh-ssh-hosts-rowMain { flex: 1; min-width: 0; }
      .dsh-ssh-hosts-rowTitle { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
      .dsh-ssh-hosts-name {
        font-size: 13px; line-height: 20px; font-weight: 600; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
      }
      .dsh-ssh-hosts-target {
        font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-secondary);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dsh-ssh-hosts-badge {
        display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px;
        border-radius: 999px; font-size: 11px; line-height: 18px; white-space: nowrap;
        color: var(--dsw-alias-label-secondary);
        background: color-mix(in srgb, var(--dsw-alias-label-secondary) 10%, transparent);
      }
      .dsh-ssh-hosts-dot { width: 5px; height: 5px; border-radius: 999px; background: currentColor; flex: none; }
      .dsh-ssh-hosts-badge--connected {
        color: var(--dsw-alias-state-success-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
      }
      .dsh-ssh-hosts-badge--testing { color: var(--dsw-alias-label-secondary); }
      .dsh-ssh-hosts-badge--testing .dsh-ssh-hosts-dot {
        background: var(--dsw-alias-brand-primary);
        animation: dsh-ssh-hosts-pulse 1.1s ease-in-out infinite;
      }
      @keyframes dsh-ssh-hosts-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
      .dsh-ssh-hosts-rowError {
        margin-top: 6px; font-size: 12px; line-height: 18px;
        color: var(--dsw-alias-state-error-primary);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dsh-ssh-hosts-rowActions { display: flex; align-items: center; gap: 8px; flex: none; padding-top: 1px; }
      .dsh-ssh-hosts-state {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 12px; padding: 64px 24px; font-size: 12px; color: var(--dsw-alias-label-secondary);
      }
      .dsh-ssh-hosts-empty {
        display: flex; flex-direction: column; align-items: center; text-align: center;
        gap: 6px; padding: 64px 24px; border: 0.5px dashed var(--dsw-alias-border-l2);
        border-radius: 12px; color: var(--dsw-alias-label-secondary);
      }
      .dsh-ssh-hosts-emptyIcon { opacity: 0.55; margin-bottom: 4px; }
      .dsh-ssh-hosts-emptyTitle { font-size: 14px; line-height: 22px; font-weight: 600; color: var(--dsw-alias-label-primary); }
      .dsh-ssh-hosts-emptyBody { font-size: 12px; line-height: 18px; }
      .dsh-ssh-hosts-empty .dsh-ssh-hosts-actions { margin-top: 12px; }
      .dsh-ssh-hosts-notice {
        display: flex; align-items: center; gap: 8px; margin-bottom: 14px;
        padding: 8px 12px; border-radius: 8px; font-size: 12px; line-height: 18px;
      }
      .dsh-ssh-hosts-notice--success {
        color: var(--dsw-alias-state-success-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent);
      }
      .dsh-ssh-hosts-notice--error {
        color: var(--dsw-alias-state-error-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
      }
      .dsh-ssh-hosts-form { display: flex; flex-direction: column; gap: 18px; max-width: 620px; }
      .dsh-ssh-hosts-field { display: flex; flex-direction: column; gap: 6px; }
      .dsh-ssh-hosts-label { font-size: 13px; line-height: 18px; font-weight: 500; }
      .dsh-ssh-hosts-input {
        box-sizing: border-box; width: 100%; height: 36px; padding: 0 10px;
        border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 7px;
        background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
        font: inherit; font-size: 13px; line-height: 20px;
      }
      .dsh-ssh-hosts-input::placeholder { color: var(--dsw-alias-label-secondary); opacity: 0.7; }
      .dsh-ssh-hosts-input:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
        outline-offset: 0; border-color: var(--dsw-alias-brand-primary);
      }
      .dsh-ssh-hosts-input::-webkit-outer-spin-button,
      .dsh-ssh-hosts-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      .dsh-ssh-hosts-select { cursor: pointer; }
      .dsh-ssh-hosts-hint { font-size: 11px; line-height: 17px; color: var(--dsw-alias-label-secondary); }
      .dsh-ssh-hosts-check {
        display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 20px;
        cursor: pointer; user-select: none;
      }
      .dsh-ssh-hosts-check input {
        width: 15px; height: 15px; margin: 2.5px 0 0; flex: none;
        accent-color: var(--dsw-alias-brand-primary);
      }
      .dsh-ssh-hosts-checkText { display: flex; flex-direction: column; gap: 2px; }
      .dsh-ssh-hosts-formActions { display: flex; align-items: center; gap: 8px; padding-top: 4px; }
      .dsh-ssh-hosts-formError { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); }
      .dsh-ssh-hosts-backdrop {
        position: fixed; inset: 0; z-index: 1100; display: flex; align-items: center; justify-content: center;
        padding: 24px; background: color-mix(in srgb, #000 32%, transparent);
      }
      .dsh-ssh-hosts-dialog {
        display: flex; flex-direction: column; width: min(560px, 100%); max-height: min(82vh, 680px);
        border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 12px; overflow: hidden;
        background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary);
        box-shadow: 0 18px 48px color-mix(in srgb, #000 28%, transparent);
      }
      .dsh-ssh-hosts-dialog:focus { outline: none; }
      .dsh-ssh-hosts-dialogHead { padding: 16px 18px 8px; }
      .dsh-ssh-hosts-dialogTitle { margin: 0; font-size: 15px; line-height: 22px; font-weight: 600; }
      .dsh-ssh-hosts-dialogBody { padding: 4px 18px 8px; overflow-y: auto; min-height: 0; }
      .dsh-ssh-hosts-dialogFoot {
        display: flex; align-items: center; justify-content: flex-end; gap: 8px;
        padding: 12px 18px 16px; border-top: 0.5px solid var(--dsw-alias-border-l1);
      }
      .dsh-ssh-hosts-dialogText { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
      .dsh-ssh-hosts-path {
        margin: 10px 0 12px; padding: 6px 8px; border-radius: 6px; font-size: 11px; line-height: 16px;
        color: var(--dsw-alias-label-secondary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dsh-ssh-hosts-importHead {
        display: flex; align-items: center; gap: 8px; padding: 6px 6px 8px;
        border-bottom: 0.5px solid var(--dsw-alias-border-l1); margin-bottom: 4px;
      }
      .dsh-ssh-hosts-importCount { flex: 1; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
      .dsh-ssh-hosts-importList { display: flex; flex-direction: column; }
      .dsh-ssh-hosts-importRow {
        display: flex; align-items: center; gap: 10px; padding: 9px 6px; border-radius: 6px;
      }
      .dsh-ssh-hosts-importRow:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent); }
      .dsh-ssh-hosts-importRow input {
        width: 15px; height: 15px; flex: none; margin: 0;
        accent-color: var(--dsw-alias-brand-primary);
      }
      .dsh-ssh-hosts-importText { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .dsh-ssh-hosts-importName { font-size: 13px; line-height: 19px; font-weight: 500; }
      .dsh-ssh-hosts-importTarget {
        font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dsh-ssh-hosts-tag {
        flex: none; font-size: 10px; line-height: 16px; padding: 1px 6px; border-radius: 999px;
        color: var(--dsw-alias-label-secondary);
        background: color-mix(in srgb, var(--dsw-alias-label-secondary) 12%, transparent);
      }
      @media (max-width: 640px) {
        .dsh-ssh-hosts-row { flex-wrap: wrap; }
        .dsh-ssh-hosts-rowActions { width: 100%; justify-content: flex-end; }
      }
      @media (pointer: coarse) {
        .dsh-ssh-hosts-input { font-size: 16px; }
      }
    `

    /** Module-level connection outcomes survive this panel being left and re-opened. */
    const runtimeStatus = new Map()

    /**
     * Build one API URL; document-relative so a mounted app keeps working.
     * @param {string} name - route suffix.
     * @returns {string} URL.
     */
    function apiUrl(name) {
      return `api/ssh-hosts.${name}`
    }

    /**
     * Call one Host route and decode its JSON envelope.
     * @param {string} name - route suffix.
     * @param {object} [options] - fetch options.
     * @returns {Promise<any>} decoded payload.
     */
    async function request(name, options) {
      const response = await fetch(apiUrl(name), {
        cache: 'no-store',
        ...options,
        headers: options?.body === undefined ? options?.headers : { 'content-type': 'application/json', ...(options?.headers ?? {}) },
      })
      let payload = undefined
      try {
        payload = await response.json()
      } catch {}
      if (!response.ok) {
        const error = new Error(payload?.message ?? `HTTP ${response.status}`)
        error.code = payload?.error ?? 'http'
        throw error
      }
      return payload
    }

    const api = {
      list: () => request('list'),
      save: host => request('save', { method: 'POST', body: JSON.stringify(host) }),
      remove: id => request('remove', { method: 'POST', body: JSON.stringify({ id }) }),
      test: id => request('test', { method: 'POST', body: JSON.stringify({ id }) }),
      importCandidates: () => request('import'),
      importHosts: names => request('import', { method: 'POST', body: JSON.stringify({ names }) }),
    }

    function IconArrowLeft({ size = 16 }) {
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M10 3.5 5.5 8l4.5 4.5', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    function IconPlus({ size = 14 }) {
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M8 3v10M3 8h10', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }))
    }

    function IconDownload({ size = 14 }) {
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M8 2.5v7.5m0 0L5 7m3 3 3-3M3 12.5h10', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    function IconPencil({ size = 14 }) {
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M10.9 2.6a1.4 1.4 0 0 1 2 2L5.5 12 2.8 12.7 3.5 10z', stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round' }))
    }

    function IconTrash({ size = 14 }) {
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M3 4.5h10M6 4.5V3h4v1.5M4.2 4.5l.5 8.5h6.6l.5-8.5M6.5 7v4M9.5 7v4', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    function IconSsh({ size = 16 }) {
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, fill: 'none', 'aria-hidden': 'true' },
        h('rect', { x: 1.6, y: 2.4, width: 12.8, height: 11.2, rx: 2.2, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'm4.4 6.2 2.1 1.9-2.1 1.9M8.4 10h2.8', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    /**
     * Format the compact `user@host:port` line.
     * @param {object} host - host row.
     * @returns {string} display target.
     */
    function targetText(host) {
      const hostName = typeof host.host === 'string' ? host.host.trim() : ''
      const user = typeof host.user === 'string' ? host.user.trim() : ''
      const port = Number(host.port) || 22
      const base = hostName === ''
        ? (host.name ?? '')
        : user === '' ? hostName : `${user}@${hostName}`
      return hostName !== '' && port !== 22 ? `${base}:${port}` : base
    }

    /** @returns {object} blank form values. */
    function emptyForm() {
      return {
        name: '',
        host: '',
        port: '22',
        useSshConfig: false,
        user: '',
        identityFile: '',
        password: '',
        passphrase: '',
        proxyJump: '',
        defaultWorkspace: '',
        remoteCliInstall: 'auto',
        apiKeyStorage: 'remote',
        hasPassword: false,
        hasPassphrase: false,
      }
    }

    /**
     * Turn a stored host into form values.
     * @param {object} host - host row.
     * @returns {object} form values.
     */
    function formFromHost(host) {
      return {
        ...emptyForm(),
        name: host.name ?? '',
        host: host.host ?? '',
        port: String(host.port ?? 22),
        useSshConfig: host.useSshConfig === true,
        user: host.user ?? '',
        identityFile: host.identityFile ?? '',
        proxyJump: host.proxyJump ?? '',
        defaultWorkspace: host.defaultWorkspace ?? '',
        remoteCliInstall: host.remoteCliInstall === 'off' || host.remoteCliInstall === 'always' ? host.remoteCliInstall : 'auto',
        apiKeyStorage: host.apiKeyStorage === 'local' ? 'local' : 'remote',
        hasPassword: host.hasPassword === true,
        hasPassphrase: host.hasPassphrase === true,
      }
    }

    /**
     * Map a Host failure onto localized form copy.
     * @param {Error & {code?: string}} error - failure.
     * @param {(key: string, params?: object) => string} t - translate.
     * @returns {string} display copy.
     */
    function saveErrorText(error, t) {
      if (error.code === 'host/name-required') return t('form.nameRequired')
      if (error.code === 'host/name-taken') return t('form.nameTaken')
      if (error.code === 'host/host-required') return t('form.hostRequired')
      if (error.code === 'host/port-invalid') return t('form.portInvalid')
      if (error.code === 'host/credentials-unavailable') return t('form.credentialsUnavailable')
      return error.message !== '' ? error.message : t('form.saveFailed')
    }

    /**
     * Client-side form validation.
     * @param {object} form - form values.
     * @param {(key: string) => string} t - translate.
     * @returns {string} the first error, or an empty string.
     */
    function validateForm(form, t) {
      if (form.name.trim() === '') return t('form.nameRequired')
      if (form.host.trim() === '' && !form.useSshConfig) return t('form.hostRequired')
      const port = Number(form.port)
      if (!Number.isInteger(port) || port < 1 || port > 65_535) return t('form.portInvalid')
      return ''
    }

    /**
     * One list row.
     * @param {{host: object, t: Function, busy: boolean, onConnect: Function, onEdit: Function, onDelete: Function}} props - row props.
     * @returns {object} React element.
     */
    function HostRow({ host, t, busy, onConnect, onEdit, onDelete }) {
      const status = host.status ?? { phase: 'unknown' }
      const phase = status.phase ?? 'unknown'
      const target = typeof host.host === 'string' && host.host.trim() !== '' ? targetText(host) : t('list.alias')
      const failure = phase === 'disconnected'
        ? status.code === 'ssh-missing' ? t('list.sshMissing')
          : status.code === 'timeout' ? t('list.timeout', { name: host.name })
            : t('list.connectFailed', { name: host.name })
        : ''
      return h('div', { className: 'dsh-ssh-hosts-row', role: 'listitem' },
        h('div', { className: 'dsh-ssh-hosts-rowMain' },
          h('div', { className: 'dsh-ssh-hosts-rowTitle' },
            h('span', { className: 'dsh-ssh-hosts-name', title: host.name }, host.name),
            h('span', { className: 'dsh-ssh-hosts-target', title: target }, target),
            h('span', { className: `dsh-ssh-hosts-badge dsh-ssh-hosts-badge--${phase}` },
              h('span', { className: 'dsh-ssh-hosts-dot', 'aria-hidden': 'true' }),
              t(`status.${phase}`))),
          failure !== '' && h('div', { className: 'dsh-ssh-hosts-rowError', title: status.error ?? failure }, failure)),
        h('div', { className: 'dsh-ssh-hosts-rowActions' },
          h('button', {
            type: 'button',
            className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--primary dsh-ssh-hosts-btn--small',
            disabled: busy,
            onClick: () => onConnect(host),
          }, busy ? t('action.connecting') : t('action.connect')),
          h('button', {
            type: 'button',
            className: 'dsh-ssh-hosts-icon-btn',
            title: t('action.edit'),
            'aria-label': `${t('action.edit')}: ${host.name}`,
            onClick: () => onEdit(host),
          }, h(IconPencil, { size: 14 })),
          h('button', {
            type: 'button',
            className: 'dsh-ssh-hosts-icon-btn dsh-ssh-hosts-icon-btn--danger',
            title: t('action.delete'),
            'aria-label': `${t('action.delete')}: ${host.name}`,
            onClick: () => onDelete(host),
          }, h(IconTrash, { size: 14 }))))
    }

    /**
     * One modal surface with Escape and backdrop dismissal.
     * @param {{title: string, onClose: Function, children: any, footer?: any}} props - dialog props.
     * @returns {object} React element.
     */
    function Dialog({ title, onClose, children, footer }) {
      const surface = React.useRef(null)
      React.useEffect(() => {
        const onKey = event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onClose])
      React.useEffect(() => { surface.current?.focus() }, [])
      return h('div', {
        className: 'dsh-ssh-hosts-backdrop',
        onMouseDown: event => { if (event.target === event.currentTarget) onClose() },
      },
      h('div', {
        className: 'dsh-ssh-hosts-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title,
        tabIndex: -1,
        ref: surface,
      },
      h('div', { className: 'dsh-ssh-hosts-dialogHead' }, h('h2', { className: 'dsh-ssh-hosts-dialogTitle' }, title)),
      h('div', { className: 'dsh-ssh-hosts-dialogBody' }, children),
      footer !== undefined && h('div', { className: 'dsh-ssh-hosts-dialogFoot' }, footer)))
    }

    /**
     * The add/edit form page.
     * @param {object} props - form props.
     * @returns {object} React element.
     */
    function HostForm({ t, editing, form, setForm, error, saving, onCancel, onSave }) {
      const nameInput = React.useRef(null)
      React.useEffect(() => { nameInput.current?.focus() }, [])
      const bind = key => event => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
        setForm(current => ({ ...current, [key]: value }))
      }
      const field = (key, label, options = {}) => h('div', { className: 'dsh-ssh-hosts-field' },
        h('label', { className: 'dsh-ssh-hosts-label', htmlFor: `dsh-ssh-hosts-${key}` }, label),
        h('input', {
          id: `dsh-ssh-hosts-${key}`,
          className: 'dsh-ssh-hosts-input',
          value: form[key],
          onChange: bind(key),
          type: options.type ?? 'text',
          inputMode: options.inputMode,
          placeholder: options.placeholder,
          autoComplete: options.autoComplete ?? 'off',
          spellCheck: false,
          ref: options.ref,
        }),
        options.hint !== undefined && h('div', { className: 'dsh-ssh-hosts-hint' }, options.hint))
      return h('div', { className: 'dsh-ssh-hosts-page' },
        h('div', { className: 'dsh-ssh-hosts-inner' },
          h('div', { className: 'dsh-ssh-hosts-head' },
            h('div', { className: 'dsh-ssh-hosts-headGroup' },
              h('button', {
                type: 'button',
                className: 'dsh-ssh-hosts-icon-btn',
                'aria-label': t('action.back'),
                title: t('action.back'),
                onClick: onCancel,
              }, h(IconArrowLeft, { size: 16 })),
              h('h1', { className: 'dsh-ssh-hosts-title' }, editing ? t('form.editTitle') : t('form.addTitle')))),
          h('div', { className: 'dsh-ssh-hosts-form' },
            field('name', t('form.name'), { placeholder: t('form.namePlaceholder'), ref: nameInput, autoComplete: 'off' }),
            field('host', t('form.host'), { placeholder: t('form.hostPlaceholder'), autoComplete: 'off' }),
            field('port', t('form.port'), { inputMode: 'numeric' }),
            h('label', { className: 'dsh-ssh-hosts-check' },
              h('input', { type: 'checkbox', checked: form.useSshConfig, onChange: bind('useSshConfig') }),
              h('span', { className: 'dsh-ssh-hosts-checkText' },
                h('span', null, t('form.useConfig')),
                h('span', { className: 'dsh-ssh-hosts-hint' }, t('form.useConfigHint')))),
            field('user', t('form.user'), { placeholder: t('form.userPlaceholder'), autoComplete: 'off' }),
            field('identityFile', t('form.identity'), { placeholder: t('form.identityPlaceholder'), autoComplete: 'off' }),
            field('password', t('form.password'), {
              type: 'password',
              autoComplete: 'new-password',
              placeholder: form.hasPassword ? t('form.passwordStored') : undefined,
              hint: t('form.passwordHint'),
            }),
            field('passphrase', t('form.passphrase'), {
              type: 'password',
              autoComplete: 'new-password',
              placeholder: form.hasPassphrase ? t('form.passphraseStored') : undefined,
              hint: t('form.passphraseHint'),
            }),
            field('proxyJump', t('form.jump'), { placeholder: t('form.jumpPlaceholder'), autoComplete: 'off' }),
            field('defaultWorkspace', t('form.workspace'), { placeholder: t('form.workspacePlaceholder'), autoComplete: 'off' }),
            h('div', { className: 'dsh-ssh-hosts-field' },
              h('label', { className: 'dsh-ssh-hosts-label', htmlFor: 'dsh-ssh-hosts-remoteCliInstall' }, t('form.install')),
              h('select', {
                id: 'dsh-ssh-hosts-remoteCliInstall',
                className: 'dsh-ssh-hosts-input dsh-ssh-hosts-select',
                value: form.remoteCliInstall,
                onChange: bind('remoteCliInstall'),
              },
              h('option', { value: 'auto' }, t('form.install.auto')),
              h('option', { value: 'off' }, t('form.install.off')),
              h('option', { value: 'always' }, t('form.install.always')))),
            h('div', { className: 'dsh-ssh-hosts-field' },
              h('label', { className: 'dsh-ssh-hosts-label', htmlFor: 'dsh-ssh-hosts-apiKeyStorage' }, t('form.apiKey')),
              h('select', {
                id: 'dsh-ssh-hosts-apiKeyStorage',
                className: 'dsh-ssh-hosts-input dsh-ssh-hosts-select',
                value: form.apiKeyStorage,
                onChange: bind('apiKeyStorage'),
              },
              h('option', { value: 'remote' }, t('form.apiKey.remote')),
              h('option', { value: 'local' }, t('form.apiKey.local')))),
            error !== '' && h('div', { className: 'dsh-ssh-hosts-formError', role: 'alert' }, error),
            h('div', { className: 'dsh-ssh-hosts-formActions' },
              h('button', {
                type: 'button',
                className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--outline',
                disabled: saving,
                onClick: onCancel,
              }, t('action.cancel')),
              h('button', {
                type: 'button',
                className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--primary',
                disabled: saving,
                onClick: onSave,
              }, saving ? t('action.saving') : t('action.save'))))))
    }

    /**
     * The import picker.
     * @param {object} props - dialog props.
     * @returns {object} React element.
     */
    function ImportDialog({ t, state, onClose, onToggle, onSelectAll, onImport }) {
      const selectable = state.candidates.filter(candidate => !candidate.exists)
      const allSelected = selectable.length > 0 && selectable.every(candidate => state.selected.has(candidate.name))
      const count = selectable.length
      const busy = state.phase === 'saving'
      return h(Dialog, {
        title: t('import.title'),
        onClose,
        footer: h(React.Fragment, null,
          h('button', {
            type: 'button',
            className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--outline',
            disabled: busy,
            onClick: onClose,
          }, t('action.cancel')),
          h('button', {
            type: 'button',
            className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--primary',
            disabled: busy || state.selected.size === 0,
            onClick: onImport,
          }, t('action.importSelected', { count: String(state.selected.size) }))),
      },
      state.phase === 'loading' && h('div', { className: 'dsh-ssh-hosts-state' }, t('import.loading')),
      state.phase === 'error' && h('div', { className: 'dsh-ssh-hosts-formError', role: 'alert' }, state.error || t('import.failed')),
      state.phase !== 'loading' && state.phase !== 'error' && h(React.Fragment, null,
        h('div', { className: 'dsh-ssh-hosts-path', title: state.path }, state.path),
        state.candidates.length === 0
          ? h('div', { className: 'dsh-ssh-hosts-state' },
            state.missing ? t('import.failed') : t('import.empty', { path: state.path }))
          : h(React.Fragment, null,
            h('div', { className: 'dsh-ssh-hosts-importHead' },
              h('input', {
                type: 'checkbox',
                checked: allSelected,
                disabled: count === 0,
                'aria-label': t('action.selectAll'),
                onChange: () => onSelectAll(!allSelected),
              }),
              h('span', { className: 'dsh-ssh-hosts-importCount' }, t('import.count', { count: String(state.candidates.length) }))),
            h('div', { className: 'dsh-ssh-hosts-importList' },
              state.candidates.map(candidate => h('label', {
                key: candidate.name,
                className: 'dsh-ssh-hosts-importRow',
              },
              h('input', {
                type: 'checkbox',
                checked: candidate.exists || state.selected.has(candidate.name),
                disabled: candidate.exists,
                onChange: () => onToggle(candidate.name),
              }),
              h('span', { className: 'dsh-ssh-hosts-importText' },
                h('span', { className: 'dsh-ssh-hosts-importName' }, candidate.name),
                h('span', { className: 'dsh-ssh-hosts-importTarget' }, targetText(candidate))),
              candidate.exists && h('span', { className: 'dsh-ssh-hosts-tag' }, t('import.alreadyAdded'))))))),
      state.phase === 'ready' && state.error !== '' && h('div', { className: 'dsh-ssh-hosts-formError', role: 'alert' }, state.error))
    }

    /**
     * The delete confirmation.
     * @param {object} props - dialog props.
     * @returns {object} React element.
     */
    function DeleteDialog({ t, host, busy, onClose, onConfirm }) {
      return h(Dialog, {
        title: t('delete.title'),
        onClose: busy ? () => {} : onClose,
        footer: h(React.Fragment, null,
          h('button', {
            type: 'button',
            className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--outline',
            disabled: busy,
            onClick: onClose,
          }, t('action.cancel')),
          h('button', {
            type: 'button',
            className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--primary',
            disabled: busy,
            onClick: onConfirm,
          }, busy ? t('delete.busy') : t('delete.confirm'))),
      }, h('p', { className: 'dsh-ssh-hosts-dialogText' }, t('delete.body', { name: host.name })))
    }

    /**
     * The main management page.
     * @param {{t: Function}} props - locale seat.
     * @returns {object} React element.
     */
    function SshHostsPage({ t }) {
      const [hosts, setHosts] = React.useState([])
      const [phase, setPhase] = React.useState('loading')
      const [loadError, setLoadError] = React.useState('')
      const [view, setView] = React.useState({ kind: 'list' })
      const [editing, setEditing] = React.useState(null)
      const [form, setForm] = React.useState(emptyForm)
      const [formError, setFormError] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [busy, setBusy] = React.useState({})
      const [deleting, setDeleting] = React.useState(null)
      const [deleteBusy, setDeleteBusy] = React.useState(false)
      const [importing, setImporting] = React.useState(null)
      const [notice, setNotice] = React.useState(null)

      React.useEffect(() => {
        if (notice === null) return
        const timer = setTimeout(() => setNotice(null), 4200)
        return () => clearTimeout(timer)
      }, [notice])

      const load = React.useCallback(async () => {
        setPhase('loading')
        try {
          const data = await api.list()
          const rows = (Array.isArray(data.hosts) ? data.hosts : []).map(host => ({
            ...host,
            status: runtimeStatus.get(host.id) ?? { phase: 'unknown' },
          }))
          setHosts(rows)
          setLoadError('')
          setPhase('ready')
        } catch (error) {
          setLoadError(error instanceof Error ? error.message : String(error))
          setPhase('error')
        }
      }, [])

      React.useEffect(() => { void load() }, [load])

      const updateStatus = (id, status) => {
        runtimeStatus.set(id, status)
        setHosts(current => current.map(host => host.id === id ? { ...host, status } : host))
      }

      const connect = async host => {
        if (busy[host.id] === true) return
        setBusy(current => ({ ...current, [host.id]: true }))
        updateStatus(host.id, { phase: 'testing' })
        try {
          const result = await api.test(host.id)
          updateStatus(host.id, { phase: result.status, code: result.code, error: result.error })
        } catch (error) {
          updateStatus(host.id, {
            phase: 'disconnected',
            code: error?.code,
            error: error instanceof Error ? error.message : String(error),
          })
        } finally {
          setBusy(current => {
            const next = { ...current }
            delete next[host.id]
            return next
          })
        }
      }

      const openAdd = () => {
        setEditing(null)
        setForm(emptyForm())
        setFormError('')
        setView({ kind: 'form' })
      }

      const openEdit = host => {
        setEditing(host)
        setForm(formFromHost(host))
        setFormError('')
        setView({ kind: 'form' })
      }

      const closeForm = () => {
        setView({ kind: 'list' })
        setFormError('')
      }

      const save = async () => {
        if (saving) return
        const problem = validateForm(form, t)
        if (problem !== '') {
          setFormError(problem)
          return
        }
        setSaving(true)
        setFormError('')
        try {
          const payload = {
            name: form.name,
            host: form.host,
            port: Number(form.port || 22),
            user: form.user,
            identityFile: form.identityFile,
            proxyJump: form.proxyJump,
            defaultWorkspace: form.defaultWorkspace,
            useSshConfig: form.useSshConfig,
            remoteCliInstall: form.remoteCliInstall,
            apiKeyStorage: form.apiKeyStorage,
          }
          if (editing !== null) payload.id = editing.id
          if (form.password !== '') payload.password = form.password
          if (form.passphrase !== '') payload.passphrase = form.passphrase
          const result = await api.save(payload)
          const saved = { ...result.host, status: runtimeStatus.get(result.host.id) ?? { phase: 'unknown' } }
          setHosts(current => {
            const index = current.findIndex(host => host.id === saved.id)
            if (index < 0) return [...current, saved]
            const next = current.slice()
            next[index] = saved
            return next
          })
          setView({ kind: 'list' })
          setNotice({ tone: 'success', text: editing !== null ? t('notice.saved') : t('notice.added') })
        } catch (error) {
          setFormError(saveErrorText(error, t))
        } finally {
          setSaving(false)
        }
      }

      const confirmDelete = async () => {
        if (deleting === null || deleteBusy) return
        setDeleteBusy(true)
        try {
          await api.remove(deleting.id)
          runtimeStatus.delete(deleting.id)
          setHosts(current => current.filter(host => host.id !== deleting.id))
          setDeleting(null)
          setNotice({ tone: 'success', text: t('notice.deleted') })
        } catch (error) {
          setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
          setDeleting(null)
        } finally {
          setDeleteBusy(false)
        }
      }

      const openImport = async () => {
        setImporting({ phase: 'loading', candidates: [], selected: new Set(), path: '', missing: false, error: '' })
        try {
          const data = await api.importCandidates()
          const candidates = Array.isArray(data.candidates) ? data.candidates : []
          setImporting({
            phase: 'ready',
            candidates,
            selected: new Set(candidates.filter(candidate => !candidate.exists).map(candidate => candidate.name)),
            path: typeof data.path === 'string' ? data.path : '',
            missing: data.missing === true,
            error: '',
          })
        } catch (error) {
          setImporting({
            phase: 'error',
            candidates: [],
            selected: new Set(),
            path: '',
            missing: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const toggleCandidate = name => {
        setImporting(current => {
          if (current === null) return current
          const selected = new Set(current.selected)
          if (selected.has(name)) selected.delete(name)
          else selected.add(name)
          return { ...current, selected }
        })
      }

      const selectAll = checked => {
        setImporting(current => {
          if (current === null) return current
          return {
            ...current,
            selected: checked
              ? new Set(current.candidates.filter(candidate => !candidate.exists).map(candidate => candidate.name))
              : new Set(),
          }
        })
      }

      const runImport = async () => {
        if (importing === null || importing.selected.size === 0) return
        const names = [...importing.selected]
        setImporting(current => current === null ? current : { ...current, phase: 'saving', error: '' })
        try {
          const result = await api.importHosts(names)
          await load()
          setImporting(null)
          setNotice({ tone: 'success', text: t('notice.imported', { count: String(result.imported?.length ?? 0) }) })
        } catch (error) {
          setImporting(current => current === null ? current : {
            ...current,
            phase: 'ready',
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      if (view.kind === 'form') {
        return h(HostForm, {
          t,
          editing,
          form,
          setForm,
          error: formError,
          saving,
          onCancel: closeForm,
          onSave: save,
        })
      }

      return h('div', { className: 'dsh-ssh-hosts-page' },
        h('div', { className: 'dsh-ssh-hosts-inner' },
          h('div', { className: 'dsh-ssh-hosts-head' },
            h('div', null,
              h('h1', { className: 'dsh-ssh-hosts-title' }, t('title')),
              h('p', { className: 'dsh-ssh-hosts-subtitle' }, t('subtitle'))),
            h('div', { className: 'dsh-ssh-hosts-actions' },
              h('button', {
                type: 'button',
                className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--outline',
                onClick: () => { void openImport() },
              }, h(IconDownload, { size: 14 }), t('action.import')),
              h('button', {
                type: 'button',
                className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--primary',
                onClick: openAdd,
              }, h(IconPlus, { size: 14 }), t('action.add')))),
          notice !== null && h('div', {
            className: `dsh-ssh-hosts-notice dsh-ssh-hosts-notice--${notice.tone}`,
            role: 'status',
          }, notice.text),
          phase === 'loading' && h('div', { className: 'dsh-ssh-hosts-state' }, t('list.loading')),
          phase === 'error' && h('div', { className: 'dsh-ssh-hosts-state' },
            h('div', null, t('list.loadFailed')),
            h('div', { className: 'dsh-ssh-hosts-hint' }, loadError),
            h('button', {
              type: 'button',
              className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--outline',
              onClick: () => { void load() },
            }, t('action.retry'))),
          phase === 'ready' && hosts.length === 0 && h('div', { className: 'dsh-ssh-hosts-empty' },
            h('span', { className: 'dsh-ssh-hosts-emptyIcon' }, h(IconSsh, { size: 40 })),
            h('div', { className: 'dsh-ssh-hosts-emptyTitle' }, t('list.emptyTitle')),
            h('div', { className: 'dsh-ssh-hosts-emptyBody' }, t('list.emptyBody')),
            h('div', { className: 'dsh-ssh-hosts-actions' },
              h('button', {
                type: 'button',
                className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--outline',
                onClick: () => { void openImport() },
              }, h(IconDownload, { size: 14 }), t('action.import')),
              h('button', {
                type: 'button',
                className: 'dsh-ssh-hosts-btn dsh-ssh-hosts-btn--primary',
                onClick: openAdd,
              }, h(IconPlus, { size: 14 }), t('action.add')))),
          phase === 'ready' && hosts.length > 0 && h('div', { className: 'dsh-ssh-hosts-card', role: 'list' },
            hosts.map(host => h(HostRow, {
              key: host.id,
              host,
              t,
              busy: busy[host.id] === true,
              onConnect: connect,
              onEdit: openEdit,
              onDelete: setDeleting,
            })))),
        deleting !== null && h(DeleteDialog, {
          t,
          host: deleting,
          busy: deleteBusy,
          onClose: () => { if (!deleteBusy) setDeleting(null) },
          onConfirm: () => { void confirmDelete() },
        }),
        importing !== null && h(ImportDialog, {
          t,
          state: importing,
          onClose: () => setImporting(null),
          onToggle: toggleCandidate,
          onSelectAll: selectAll,
          onImport: () => { void runImport() },
        }))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.dshSshHosts = 'styles'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => { style.remove() }
        }, 'ssh-hosts: styles')
        ctx.effect(() => ctx.locale.register(NS, LOCALES), 'ssh-hosts: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, SshHostsPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          locale: NS,
          label: () => t('menu.label'),
        }, IconSsh))
      },
    }
  },
})
