/**
 * Host half of the SSH hosts bundle.
 *
 * Owns the durable host records (secrets live in the credentials service),
 * imports concrete aliases from ~/.ssh/config, and runs a bounded OpenSSH
 * connectivity check through the mounted subprocess provider.
 */
import { createHash, randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

/** Web routes are served inside Connection's authenticated `/api` channel. */
const API_PREFIX = '/api/ssh-hosts'
/** Current on-disk record format. */
const DATA_VERSION = 1
/** Hard ceiling for one connectivity check. */
const TEST_TIMEOUT_MS = 20_000
/** Per-stream captured output ceiling. */
const MAX_OUTPUT_BYTES = 64 * 1024
/** Largest text file the editor will open. */
const MAX_EDIT_BYTES = 1024 * 1024
/** Largest payload one save may send back. */
const MAX_WRITE_BYTES = 4 * 1024 * 1024
/** Capture ceiling for one base64 file read (a 1 MiB file is ~1.4 MiB). */
const MAX_FILE_OUTPUT_BYTES = 8 * 1024 * 1024
/** Accepted JSON request-body ceiling. */
const MAX_BODY_BYTES = 8 * 1024 * 1024
/** Name of the generated non-interactive askpass helper. */
const ASKPASS_NAME = 'askpass.sh'

const ASKPASS_SOURCE = `#!/bin/sh
case "$1" in
  *[Pp]assphrase*) printf '%s\\n' "$DSH_SSH_PASSPHRASE" ;;
  *) printf '%s\\n' "$DSH_SSH_PASSWORD" ;;
esac
`

/** Services this Host half needs; without a Web connection or subprocess provider it stays inactive. */
export const inject = ['connection', 'subprocess']

/** An HTTP failure with a stable code the Client can translate. */
class HttpError extends Error {
  /**
   * @param {number} status - HTTP status.
   * @param {string} code - stable machine-readable code.
   * @param {string} message - English fallback detail.
   */
  constructor(status, code, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

/** @param {unknown} value - candidate. @returns {boolean} whether it is a plain object. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param {string} value - string to escape. @returns {string} a regexp-safe literal. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Expand a configured path against the invoking user's home directory.
 * @param {string} value - path, possibly starting with `~`.
 * @param {string} home - home directory.
 * @returns {string} an absolute or unchanged path.
 */
export function expandHome(value, home = homedir()) {
  if (value === '~') return home
  if (value.startsWith('~/')) return path.join(home, value.slice(2))
  return value
}

/** @returns {string} the DSH home shared by this process. */
function dshHome() {
  const configured = process.env.DSH_HOME
  return configured !== undefined && configured.trim() !== '' ? configured : path.join(homedir(), '.dsh')
}

/** @returns {string} directory holding this plugin's durable data. */
function dataDirectory() {
  return path.join(dshHome(), 'ssh-hosts')
}

/** @returns {string} the JSON record file. */
function hostFile() {
  return path.join(dataDirectory(), 'hosts.json')
}

/** @returns {string} the generated askpass helper path. */
function askpassFile() {
  return path.join(dataDirectory(), ASKPASS_NAME)
}

/** @returns {string} the user's OpenSSH configuration path. */
export function sshConfigPath(home = homedir()) {
  return path.join(home, '.ssh', 'config')
}

/** Empty durable state. @returns {{version: number, hosts: object[]}} */
function emptyData() {
  return { version: DATA_VERSION, hosts: [] }
}

/**
 * Validate one stored row; a hand-edited file must not break the page.
 * @param {unknown} value - decoded row.
 * @returns {boolean} whether the row has the minimum durable fields.
 */
function isStoredHost(value) {
  return isRecord(value) && typeof value.id === 'string' && value.id !== ''
    && typeof value.name === 'string' && value.name !== ''
    && typeof value.host === 'string'
    && typeof value.user === 'string'
    && typeof value.useSshConfig === 'boolean'
}

/**
 * Read the durable record file.
 * @returns {Promise<{version: number, hosts: object[]}>} stored state.
 */
async function readData() {
  let text
  try {
    text = await readFile(hostFile(), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyData()
    throw error
  }
  const body = text.replace(/^\uFEFF/, '')
  if (body.trim() === '') return emptyData()
  let parsed
  try {
    // Editors and PowerShell's UTF-8 writers may prepend a BOM; JSON.parse rejects it.
    parsed = JSON.parse(body)
  } catch {
    throw new HttpError(500, 'host/data-invalid', `The SSH host data file is not valid JSON: ${hostFile()}`)
  }
  const hosts = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed.hosts : undefined
  if (!Array.isArray(hosts)) {
    throw new HttpError(500, 'host/data-invalid', `The SSH host data file has no host list: ${hostFile()}`)
  }
  const valid = []
  for (const host of hosts) {
    if (isStoredHost(host)) valid.push(host)
    else console.warn('ssh-hosts: skipping an invalid stored host row')
  }
  return { version: DATA_VERSION, hosts: valid }
}

/**
 * Atomically replace the durable record file.
 * @param {{version: number, hosts: object[]}} data - complete state.
 * @returns {Promise<void>} after the rename.
 */
async function writeData(data) {
  const directory = dataDirectory()
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const file = hostFile()
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify({ version: DATA_VERSION, hosts: data.hosts }, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, file)
  await chmod(file, 0o600).catch(() => {})
}

/** Serialized read-modify-write queue for the durable file. */
let storeQueue = Promise.resolve()

/**
 * Run one mutation against a fresh read and persist the result.
 * @param {(data: {version: number, hosts: object[]}) => Promise<unknown>|unknown} mutate - mutation.
 * @returns {Promise<unknown>} the mutation's return value.
 */
function withStore(mutate) {
  const task = storeQueue.then(async () => {
    const data = await readData()
    const result = await mutate(data)
    await writeData(data)
    return result
  })
  storeQueue = task.then(() => undefined, () => undefined)
  return task
}

/**
 * Read and trim one optional text field.
 * @param {unknown} value - request value.
 * @param {string} field - field name for the error.
 * @param {number} max - maximum length.
 * @returns {string} the normalized value, or an empty string.
 */
function textField(value, field, max) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new HttpError(400, 'host/invalid-field', `${field} must be a string.`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new HttpError(400, 'host/invalid-field', `${field} is too long.`)
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new HttpError(400, 'host/invalid-field', `${field} contains a control character.`)
  }
  return trimmed
}

/**
 * Normalize one save request into a durable host row.
 * @param {Record<string, unknown>} input - request body.
 * @param {object|undefined} existing - row being replaced, when editing.
 * @returns {object} the normalized row.
 */
function normalizeHost(input, existing) {
  const name = textField(input.name, 'name', 128)
  if (name === '') throw new HttpError(400, 'host/name-required', 'A host name is required.')
  if (name.startsWith('-')) throw new HttpError(400, 'host/name-invalid', 'A host name cannot start with "-".')
  const host = textField(input.host, 'host', 255)
  const useSshConfig = input.useSshConfig === true
  if (host === '' && !useSshConfig) {
    throw new HttpError(400, 'host/host-required', 'A host is required unless ~/.ssh/config lookup is enabled.')
  }
  if (host.startsWith('-')) throw new HttpError(400, 'host/host-invalid', 'A host cannot start with "-".')
  let port = 22
  if (input.port !== undefined && input.port !== null && input.port !== '') {
    const numeric = typeof input.port === 'number' ? input.port : Number(input.port)
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65_535) {
      throw new HttpError(400, 'host/port-invalid', 'The port must be an integer from 1 through 65535.')
    }
    port = numeric
  }
  const user = textField(input.user, 'user', 128)
  if (user.startsWith('-')) throw new HttpError(400, 'host/user-invalid', 'A user cannot start with "-".')
  const now = new Date().toISOString()
  return {
    id: existing?.id ?? randomUUID(),
    name,
    host,
    port,
    user,
    identityFile: textField(input.identityFile, 'identity file', 1024),
    proxyJump: textField(input.proxyJump, 'jump host', 512),
    defaultWorkspace: textField(input.defaultWorkspace, 'default workspace', 1024),
    useSshConfig,
    remoteCliInstall: input.remoteCliInstall === 'off' || input.remoteCliInstall === 'always' ? input.remoteCliInstall : 'auto',
    apiKeyStorage: input.apiKeyStorage === 'local' ? 'local' : 'remote',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

/**
 * Credential record key for one host.
 * @param {string} id - host identity.
 * @returns {string} the key.
 */
function credentialKey(id) {
  return `ssh-hosts/host-${id}`
}

/**
 * Read a host's stored secrets without exposing them to the Client.
 * @param {object|undefined} credentials - credentials service, when available.
 * @param {string} id - host identity.
 * @returns {Promise<{password?: string, passphrase?: string}>} stored secrets.
 */
async function readSecrets(credentials, id) {
  if (credentials === undefined) return {}
  try {
    const record = await credentials.readRecord(credentialKey(id))
    if (!isRecord(record) || record.kind !== 'grant' || !isRecord(record.payload)) return {}
    const password = typeof record.payload.password === 'string' ? record.payload.password : undefined
    const passphrase = typeof record.payload.passphrase === 'string' ? record.payload.passphrase : undefined
    return { ...(password === undefined ? {} : { password }), ...(passphrase === undefined ? {} : { passphrase }) }
  } catch (error) {
    console.warn('ssh-hosts: could not read stored credentials', error)
    return {}
  }
}

/**
 * Merge non-empty secrets into one host's credential record.
 * @param {object} credentials - credentials service.
 * @param {string} id - host identity.
 * @param {{password?: string, passphrase?: string}} updates - non-empty values.
 * @returns {Promise<void>} after the write.
 */
async function writeSecrets(credentials, id, updates) {
  await credentials.modifyRecord(credentialKey(id), async (current) => {
    const existing = isRecord(current) && current.kind === 'grant' && isRecord(current.payload) ? current.payload : {}
    const payload = { ...existing }
    if (updates.password !== undefined) payload.password = updates.password
    if (updates.passphrase !== undefined) payload.passphrase = updates.passphrase
    if (typeof payload.password !== 'string' && typeof payload.passphrase !== 'string') return undefined
    return { kind: 'grant', payload }
  })
}

/**
 * Public projection of one host row.
 * @param {object} host - durable row.
 * @param {{password?: string, passphrase?: string}} secrets - stored secrets.
 * @returns {object} the Client-safe host.
 */
function publicHost(host, secrets) {
  return {
    ...host,
    hasPassword: typeof secrets.password === 'string' && secrets.password !== '',
    hasPassphrase: typeof secrets.passphrase === 'string' && secrets.passphrase !== '',
  }
}

/**
 * List every host with secret-presence flags.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @returns {Promise<{hosts: object[]}>} the list.
 */
async function listHosts(ctx) {
  const data = await readData()
  const credentials = ctx.get('credentials')
  const hosts = await Promise.all(data.hosts.map(async host => publicHost(host, await readSecrets(credentials, host.id))))
  return { hosts }
}

/**
 * Create or replace one host.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {Record<string, unknown>} input - request body.
 * @returns {Promise<{host: object}>} the saved host.
 */
async function saveHost(ctx, input) {
  const requestedId = typeof input.id === 'string' && input.id !== '' ? input.id : undefined
  const password = typeof input.password === 'string' && input.password !== '' ? input.password : undefined
  const passphrase = typeof input.passphrase === 'string' && input.passphrase !== '' ? input.passphrase : undefined
  if ((password !== undefined || passphrase !== undefined) && password !== undefined && password.length > 4096) {
    throw new HttpError(400, 'host/invalid-field', 'The password is too long.')
  }
  if (passphrase !== undefined && passphrase.length > 4096) {
    throw new HttpError(400, 'host/invalid-field', 'The passphrase is too long.')
  }
  const credentials = ctx.get('credentials')
  if ((password !== undefined || passphrase !== undefined) && credentials === undefined) {
    throw new HttpError(409, 'host/credentials-unavailable', 'Credential storage is unavailable in this profile.')
  }
  const saved = await withStore(async (data) => {
    const existing = requestedId === undefined ? undefined : data.hosts.find(host => host.id === requestedId)
    if (requestedId !== undefined && existing === undefined) {
      throw new HttpError(404, 'host/not-found', 'That host no longer exists.')
    }
    const host = normalizeHost(input, existing)
    if (data.hosts.some(candidate => candidate.id !== host.id && candidate.name === host.name)) {
      throw new HttpError(409, 'host/name-taken', 'Another host already uses this name.')
    }
    if (password !== undefined || passphrase !== undefined) {
      await writeSecrets(credentials, host.id, {
        ...(password === undefined ? {} : { password }),
        ...(passphrase === undefined ? {} : { passphrase }),
      })
    }
    if (existing === undefined) data.hosts.push(host)
    else data.hosts[data.hosts.indexOf(existing)] = host
    return host
  })
  return { host: publicHost(saved, await readSecrets(credentials, saved.id)) }
}

/**
 * Remove one host and its stored secrets.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} id - host identity.
 * @returns {Promise<{ok: true}>} after removal.
 */
async function removeHost(ctx, id) {
  if (typeof id !== 'string' || id === '') throw new HttpError(400, 'host/invalid-field', 'A host id is required.')
  await withStore(async (data) => {
    const index = data.hosts.findIndex(host => host.id === id)
    if (index < 0) throw new HttpError(404, 'host/not-found', 'That host no longer exists.')
    data.hosts.splice(index, 1)
  })
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    await credentials.deleteRecord(credentialKey(id)).catch(error => {
      console.warn('ssh-hosts: could not delete stored credentials', error)
    })
  }
  return { ok: true }
}

/**
 * Tokenize one SSH-config line, honoring comments and quotes.
 * @param {string} line - physical line.
 * @returns {string[]} tokens.
 */
export function tokenizeSshConfigLine(line) {
  const tokens = []
  let current = ''
  let quote = ''
  let started = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (quote !== '') {
      if (character === quote) quote = ''
      else if (character === '\\' && index + 1 < line.length) {
        index += 1
        current += line[index]
      } else current += character
      started = true
      continue
    }
    if (character === '#') break
    if (character === '"' || character === "'") {
      quote = character
      started = true
      continue
    }
    if (character === '\\' && index + 1 < line.length) {
      index += 1
      current += line[index]
      started = true
      continue
    }
    if (/\s/.test(character)) {
      if (started) {
        tokens.push(current)
        current = ''
        started = false
      }
      continue
    }
    current += character
    started = true
  }
  if (started) tokens.push(current)
  return tokens
}

/**
 * Store the first value of one option within a block.
 * @param {Record<string, string>} options - option accumulator.
 * @param {string} keyword - lowercase option name.
 * @param {string[]} values - option arguments.
 */
function applyConfigOption(options, keyword, values) {
  const value = values.length === 0 ? '' : values.join(' ')
  if (keyword === 'hostname' && options.hostName === undefined) options.hostName = value
  else if (keyword === 'user' && options.user === undefined) options.user = value
  else if (keyword === 'port' && options.port === undefined) options.port = value
  else if (keyword === 'identityfile' && options.identityFile === undefined) options.identityFile = value
  else if (keyword === 'proxyjump' && options.proxyJump === undefined) options.proxyJump = value
}

/**
 * Parse expanded SSH-config lines into concrete import candidates.
 * @param {string[]} lines - lines with Include directives already expanded.
 * @returns {{name: string, host: string, port: number, user: string, identityFile: string, proxyJump: string}[]} candidates.
 */
export function parseSshConfigLines(lines) {
  const global = {}
  const wildcard = {}
  /** @type {{patterns: string[], options: Record<string, string>}[]} */
  const sections = []
  /** @type {{patterns: string[], options: Record<string, string>}|null} */
  let current = null
  let ignoring = false
  for (const line of lines) {
    const tokens = tokenizeSshConfigLine(line)
    if (tokens.length === 0) continue
    const keyword = tokens[0].toLowerCase()
    if (keyword === 'host') {
      current = { patterns: tokens.slice(1), options: {} }
      sections.push(current)
      ignoring = false
      continue
    }
    if (keyword === 'match') {
      current = null
      ignoring = true
      continue
    }
    if (keyword === 'include') continue
    if (ignoring) continue
    if (current === null) applyConfigOption(global, keyword, tokens.slice(1))
    else applyConfigOption(current.options, keyword, tokens.slice(1))
  }
  for (const section of sections) {
    if (section.patterns.length > 0 && section.patterns.every(pattern => pattern === '*')) {
      for (const [keyword, value] of Object.entries(section.options)) {
        const key = keyword
        if (wildcard[key] === undefined) wildcard[key] = value
      }
    }
  }
  const candidates = []
  const seen = new Set()
  for (const section of sections) {
    if (section.patterns.length === 0 || section.patterns.some(pattern => /[*?!]/.test(pattern))) continue
    for (const pattern of section.patterns) {
      if (pattern === '' || pattern.includes('%') || seen.has(pattern)) continue
      seen.add(pattern)
      const option = key => section.options[key] ?? wildcard[key] ?? global[key]
      const portText = option('port')
      const portValue = portText === undefined ? 22 : Number(portText)
      candidates.push({
        name: pattern,
        host: option('hostName') ?? pattern,
        port: Number.isInteger(portValue) && portValue >= 1 && portValue <= 65_535 ? portValue : 22,
        user: option('user') ?? '',
        identityFile: option('identityFile') ?? '',
        proxyJump: option('proxyJump') ?? '',
      })
    }
  }
  return candidates
}

/**
 * Expand one Include argument to matching files.
 * @param {string} argument - raw Include token.
 * @param {{home: string, seen: Set<string>, depth: number}} context - recursion state.
 * @returns {Promise<string[]>} absolute files.
 */
async function expandInclude(argument, context) {
  const expanded = expandHome(argument, context.home)
  const pattern = path.isAbsolute(expanded) ? expanded : path.join(context.home, '.ssh', expanded)
  if (!/[*?[]/.test(pattern)) return [pattern]
  const directory = path.dirname(pattern)
  const name = path.basename(pattern)
  let entries
  try {
    entries = await readdir(directory)
  } catch {
    return []
  }
  const expression = new RegExp(`^${escapeRegExp(name).replace(/\\\*/g, '.*').replace(/\\\?/g, '.')}$`)
  return entries.filter(entry => expression.test(entry)).sort().map(entry => path.join(directory, entry))
}

/**
 * Read one config file and inline its Include files.
 * @param {string} file - absolute config file.
 * @param {{home: string, seen: Set<string>, depth: number}} context - recursion state.
 * @returns {Promise<{lines: string[], missing: boolean}>} expanded lines.
 */
async function readConfigLines(file, context) {
  if (context.depth > 8 || context.seen.has(file)) return { lines: [], missing: false }
  context.seen.add(file)
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return { lines: [], missing: true }
    throw error
  }
  const lines = []
  for (const line of text.split(/\r?\n/)) {
    const tokens = tokenizeSshConfigLine(line)
    if (tokens.length > 1 && tokens[0].toLowerCase() === 'include') {
      for (const argument of tokens.slice(1)) {
        for (const included of await expandInclude(argument, context)) {
          const nested = await readConfigLines(included, { ...context, depth: context.depth + 1 })
          lines.push(...nested.lines)
        }
      }
      continue
    }
    lines.push(line)
  }
  return { lines, missing: false }
}

/**
 * Read the user's config into import candidates.
 * @param {string} home - home directory.
 * @returns {Promise<{path: string, missing: boolean, candidates: ReturnType<typeof parseSshConfigLines>}>} parsed state.
 */
async function loadSshConfig(home = homedir()) {
  const file = sshConfigPath(home)
  const { lines, missing } = await readConfigLines(file, { home, seen: new Set(), depth: 0 })
  return { path: file, missing, candidates: missing ? [] : parseSshConfigLines(lines) }
}

/**
 * Resolve the local OpenSSH client.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @returns {Promise<string|undefined>} executable path, or undefined.
 */
async function resolveSsh(ctx) {
  try {
    return await ctx.subprocess.resolveExecutable(process.env.DSH_SSH_PATH ?? 'ssh')
  } catch {
    return undefined
  }
}

/**
 * Create the non-interactive askpass helper on demand.
 * @returns {Promise<string>} helper path.
 */
async function ensureAskpass() {
  const file = askpassFile()
  try {
    const existing = await readFile(file, 'utf8')
    if (existing === ASKPASS_SOURCE) return file
  } catch {}
  await mkdir(dataDirectory(), { recursive: true, mode: 0o700 })
  await writeFile(file, ASKPASS_SOURCE, { mode: 0o700 })
  await chmod(file, 0o700).catch(() => {})
  return file
}

/** Maximum directory entries returned by one remote listing. */
const MAX_LIST_ENTRIES = 2_000

/**
 * Quote one value for a POSIX shell single-quoted word.
 * @param {string} value - literal text.
 * @returns {string} the quoted word.
 */
export function posixQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`
}

/**
 * Build the remote shell words for one configured directory. `~` and `~/…`
 * expand through the remote login shell, never locally.
 * @param {string} value - configured path.
 * @returns {string} shell words naming the directory.
 */
export function remotePathExpression(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '' || text === '~') return '"$HOME"'
  if (text.startsWith('~/')) {
    const rest = text.slice(2)
    return rest === '' ? '"$HOME"' : `"$HOME"/${posixQuote(rest)}`
  }
  return posixQuote(text)
}

/**
 * Build the remote command that lists one directory. Its first stdout line is
 * the resolved absolute path, so a `~` root can become a real location.
 * @param {string} path - configured directory.
 * @returns {string} remote shell command.
 */
export function buildListCommand(path) {
  return `cd -- ${remotePathExpression(path)} && printf '%s\\n' "$PWD" && LC_ALL=C ls -1Ap .`
}

/**
 * Parse the output of one listing command. `ls -p` marks directories with a
 * trailing slash and never lists `.` or `..`.
 * @param {string} stdout - captured remote stdout.
 * @returns {{resolved: string, entries: {name: string, kind: 'directory'|'file'}[]}} the listing.
 */
export function parseListing(stdout) {
  const lines = String(stdout).split(/\r?\n/)
  const resolved = (lines.shift() ?? '').trim()
  const entries = []
  for (const line of lines) {
    if (line === '') continue
    const isDirectory = line.endsWith('/')
    const name = isDirectory ? line.slice(0, -1) : line
    if (name === '' || name === '.' || name === '..') continue
    entries.push({ name, kind: isDirectory ? 'directory' : 'file' })
  }
  return { resolved, entries }
}

/**
 * Remote snippet printing a file's sha256, preferring GNU coreutils and
 * falling back to the BSD/macOS `shasum`. Prints nothing when the file is
 * missing or unreadable, so an empty result means "cannot read".
 * @param {string} target - shell words naming the file.
 * @returns {string} a remote shell snippet.
 */
function hashSnippet(target) {
  return `(sha256sum -- ${target} 2>/dev/null || shasum -a 256 -- ${target}) | cut -d' ' -f1`
}

/**
 * Build the read command: line 1 is the remote sha256, the rest is the file
 * as one base64 string, capped one byte above the editable limit so an
 * oversized file is detected without transferring it.
 * @param {string} path - absolute remote path.
 * @returns {string} remote shell command.
 */
export function buildFileReadCommand(path) {
  const target = remotePathExpression(path)
  return `p=${target} && sha=$( ${hashSnippet('"$p"')} ) && test -n "$sha" || exit 4; `
    + `printf '%s\\n' "$sha" && head -c ${MAX_EDIT_BYTES + 1} "$p" | base64 | tr -d '\\n'`
}

/**
 * Build the hash-only command used for conflict detection.
 * @param {string} path - absolute remote path.
 * @returns {string} remote shell command printing the sha256 or nothing.
 */
export function buildFileHashCommand(path) {
  const target = remotePathExpression(path)
  return `p=${target} && ${hashSnippet('"$p"')}`
}

/**
 * Build the write command: stdin carries base64 so the bytes that land are
 * exactly the bytes we hashed, then the file is re-hashed for verification.
 * @param {string} path - absolute remote path.
 * @returns {string} remote shell command.
 */
export function buildFileWriteCommand(path) {
  const target = remotePathExpression(path)
  return `p=${target} && base64 -d > "$p" && ${hashSnippet('"$p"')}`
}

/**
 * Parent directory of one absolute remote path.
 * @param {string} value - absolute remote path.
 * @returns {string} the parent, or an empty string at or above the root.
 */
export function parentPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return ''
  const trimmed = value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value
  if (trimmed === '/') return ''
  const index = trimmed.lastIndexOf('/')
  if (index < 0) return ''
  return index === 0 ? '/' : trimmed.slice(0, index)
}

/**
 * Build one bounded OpenSSH invocation for a remote command.
 * @param {object} host - host row.
 * @param {{password?: string, passphrase?: string}} secrets - stored secrets.
 * @param {{sshPath: string, askpassPath?: string, home?: string, env?: NodeJS.ProcessEnv, remoteCommand?: string}} settings - local facts and the remote command (`true` when omitted).
 * @returns {{argv: string[], env: NodeJS.ProcessEnv}} spawn arguments.
 */
export function buildSshInvocation(host, secrets, settings) {
  const home = settings.home ?? homedir()
  const env = { ...(settings.env ?? process.env) }
  const argv = [
    settings.sshPath, '-T',
    '-o', 'LogLevel=ERROR',
    '-o', 'ConnectTimeout=10',
    '-o', 'StrictHostKeyChecking=accept-new',
  ]
  const hostName = typeof host.host === 'string' ? host.host.trim() : ''
  const user = typeof host.user === 'string' ? host.user.trim() : ''
  const destination = hostName === '' ? host.name : user === '' ? hostName : `${user}@${hostName}`
  const port = Number(host.port)
  if (Number.isInteger(port) && port >= 1 && port <= 65_535 && port !== 22) argv.push('-p', String(port))
  if (hostName === '' && user !== '') argv.push('-l', user)
  if (typeof host.identityFile === 'string' && host.identityFile.trim() !== '') {
    argv.push('-i', expandHome(host.identityFile.trim(), home))
  }
  if (typeof host.proxyJump === 'string' && host.proxyJump.trim() !== '') {
    argv.push('-J', host.proxyJump.trim())
  }
  const password = typeof secrets.password === 'string' ? secrets.password : ''
  const passphrase = typeof secrets.passphrase === 'string' ? secrets.passphrase : ''
  if (password !== '' || passphrase !== '') {
    argv.push('-o', 'NumberOfPasswordPrompts=1')
    if (settings.askpassPath !== undefined) {
      env.SSH_ASKPASS = settings.askpassPath
      env.SSH_ASKPASS_REQUIRE = 'force'
      if (env.DISPLAY === undefined || env.DISPLAY === '') env.DISPLAY = ':0'
    }
    env.DSH_SSH_PASSWORD = password
    env.DSH_SSH_PASSPHRASE = passphrase
  } else {
    argv.push('-o', 'BatchMode=yes')
  }
  const remoteCommand = typeof settings.remoteCommand === 'string' && settings.remoteCommand !== ''
    ? settings.remoteCommand
    : 'true'
  argv.push('--', destination, remoteCommand)
  return { argv, env }
}

/**
 * Read one collected stream without consuming it.
 * @param {object|undefined} reader - collected output reader.
 * @returns {{text: string, lossy: boolean}} captured text and truncation flag.
 */
function readCollectedDetail(reader) {
  if (reader === undefined) return { text: '', lossy: false }
  try {
    const read = reader.readFrom(0)
    return {
      text: typeof read?.text === 'string' ? read.text : '',
      lossy: read?.lossy === true,
    }
  } catch {
    return { text: '', lossy: false }
  }
}

/**
 * Read one collected stream without consuming it.
 * @param {object|undefined} reader - collected output reader.
 * @returns {string} captured text.
 */
function readCollected(reader) {
  return readCollectedDetail(reader).text
}

/**
 * Reduce OpenSSH diagnostics to one displayable line.
 * @param {string} text - captured stderr or stdout.
 * @returns {string} a concise detail, possibly empty.
 */
function summarizeDiagnostics(text) {
  const lines = text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '')
    .filter(line => !/^Warning: Permanently added\b/.test(line))
  if (lines.length === 0) return ''
  return lines.slice(-3).join(' ').slice(0, 600)
}

/**
 * Run one bounded remote command through the local OpenSSH client.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {object} host - host row.
 * @param {{password?: string, passphrase?: string}} secrets - stored secrets.
 * @param {string} remoteCommand - command for the remote login shell.
 * @param {AbortSignal|undefined} signal - caller cancellation.
 * @param {{maxOutputBytes?: number, stdinData?: string}} [options] - capture ceiling and optional stdin payload.
 * @returns {Promise<{missing: boolean, timedOut: boolean, exitCode: number|undefined, stdout: string, stderr: string, stdoutLossy: boolean, durationMs: number, failure?: string}>} outcome.
 */
async function runSsh(ctx, host, secrets, remoteCommand, signal, options = {}) {
  const sshPath = await resolveSsh(ctx)
  if (sshPath === undefined) {
    return {
      missing: true,
      timedOut: false,
      exitCode: undefined,
      stdout: '',
      stderr: '',
      stdoutLossy: false,
      durationMs: 0,
    }
  }
  const askpassPath = secrets.password !== undefined || secrets.passphrase !== undefined ? await ensureAskpass() : undefined
  const { argv, env } = buildSshInvocation(host, secrets, {
    sshPath,
    askpassPath,
    home: homedir(),
    remoteCommand,
  })
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TEST_TIMEOUT_MS)
  const forward = () => { controller.abort() }
  signal?.addEventListener('abort', forward, { once: true })
  const started = Date.now()
  try {
    const handle = ctx.subprocess.spawn({
      argv,
      cwd: homedir(),
      graceMs: 2_000,
      signal: controller.signal,
      env,
      stdio: {
        stdin: options.stdinData === undefined ? 'ignore' : { data: options.stdinData },
        stdout: { maxBytes: options.maxOutputBytes ?? MAX_OUTPUT_BYTES },
        stderr: { maxBytes: MAX_OUTPUT_BYTES },
      },
    })
    const outcome = await handle.done
    const stdout = readCollectedDetail(handle.collected.stdout)
    return {
      missing: false,
      timedOut,
      exitCode: outcome.exitCode,
      stdout: stdout.text,
      stderr: readCollected(handle.collected.stderr),
      stdoutLossy: stdout.lossy,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      missing: false,
      timedOut,
      exitCode: undefined,
      stdout: '',
      stderr: '',
      stdoutLossy: false,
      durationMs: Date.now() - started,
      failure: timedOut ? 'The connection timed out.' : error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forward)
  }
}

/**
 * Run one bounded connectivity check.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} id - host identity.
 * @param {AbortSignal|undefined} signal - caller cancellation.
 * @returns {Promise<{status: 'connected'|'disconnected', code?: string, error?: string, durationMs: number}>} outcome.
 */
async function testHost(ctx, id, signal) {
  const data = await readData()
  const host = data.hosts.find(candidate => candidate.id === id)
  if (host === undefined) throw new HttpError(404, 'host/not-found', 'That host no longer exists.')
  const secrets = await readSecrets(ctx.get('credentials'), host.id)
  const outcome = await runSsh(ctx, host, secrets, 'true', signal)
  if (outcome.missing) {
    return {
      status: 'disconnected',
      code: 'ssh-missing',
      error: 'The ssh command is not available to the Harness host.',
      durationMs: 0,
    }
  }
  if (outcome.timedOut) {
    return { status: 'disconnected', code: 'timeout', error: 'The connection timed out.', durationMs: outcome.durationMs }
  }
  if (outcome.exitCode === 0) return { status: 'connected', durationMs: outcome.durationMs }
  const detail = summarizeDiagnostics(outcome.stderr)
    || summarizeDiagnostics(outcome.stdout)
    || outcome.failure
    || `ssh exited with code ${String(outcome.exitCode ?? 'unknown')}.`
  return { status: 'disconnected', code: 'failed', error: detail, durationMs: outcome.durationMs }
}

/**
 * List one directory on a remote host through the local OpenSSH client.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {Record<string, unknown>} input - request body (`id`, optional `path`).
 * @param {AbortSignal|undefined} signal - caller cancellation.
 * @returns {Promise<{path: string, parent: string, entries: {name: string, kind: string}[], truncated: boolean}>} the listing.
 */
async function browseHost(ctx, input, signal) {
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  if (id === '') throw new HttpError(400, 'host/invalid-field', 'A host id is required.')
  const requestedPath = typeof input.path === 'string' ? input.path.trim() : ''
  if (requestedPath.length > 4_096) throw new HttpError(400, 'host/path-invalid', 'The path is too long.')
  if (/[\u0000-\u001f\u007f]/.test(requestedPath)) {
    throw new HttpError(400, 'host/path-invalid', 'The path contains a control character.')
  }
  if (requestedPath.startsWith('-')) throw new HttpError(400, 'host/path-invalid', 'A path cannot start with "-".')
  const data = await readData()
  const host = data.hosts.find(candidate => candidate.id === id)
  if (host === undefined) throw new HttpError(404, 'host/not-found', 'That host no longer exists.')
  const secrets = await readSecrets(ctx.get('credentials'), host.id)
  const outcome = await runSsh(ctx, host, secrets, buildListCommand(requestedPath), signal)
  if (outcome.missing) {
    throw new HttpError(409, 'host/ssh-missing', 'The ssh command is not available to the Harness host.')
  }
  if (outcome.timedOut) throw new HttpError(504, 'host/timeout', 'Reading the remote folder timed out.')
  if (outcome.exitCode !== 0) {
    const detail = summarizeDiagnostics(outcome.stderr)
      || summarizeDiagnostics(outcome.stdout)
      || outcome.failure
      || `ssh exited with code ${String(outcome.exitCode ?? 'unknown')}.`
    throw new HttpError(502, 'host/remote-failed', detail)
  }
  const { resolved, entries } = parseListing(outcome.stdout)
  if (resolved === '') {
    throw new HttpError(502, 'host/remote-failed', 'The remote host returned no directory path.')
  }
  return {
    path: resolved,
    parent: parentPath(resolved),
    entries: entries.slice(0, MAX_LIST_ENTRIES),
    truncated: entries.length > MAX_LIST_ENTRIES,
  }
}

/**
 * Read one required host id from a request body.
 * @param {Record<string, unknown>} input - request body.
 * @returns {string} the host id.
 */
function hostIdOf(input) {
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  if (id === '') throw new HttpError(400, 'host/invalid-field', 'A host id is required.')
  return id
}

/**
 * Read one validated remote path from a request body.
 * @param {Record<string, unknown>} input - request body.
 * @param {{absolute?: boolean}} [options] - whether an absolute path is required.
 * @returns {string} the path.
 */
function remotePathOf(input, options = {}) {
  const value = typeof input.path === 'string' ? input.path.trim() : ''
  if (value.length > 4_096) throw new HttpError(400, 'host/path-invalid', 'The path is too long.')
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new HttpError(400, 'host/path-invalid', 'The path contains a control character.')
  }
  if (value.startsWith('-')) throw new HttpError(400, 'host/path-invalid', 'A path cannot start with "-".')
  if (options.absolute === true && !value.startsWith('/')) {
    throw new HttpError(400, 'host/path-invalid', 'An absolute remote path is required.')
  }
  return value
}

/**
 * Resolve one stored host row.
 * @param {string} id - host identity.
 * @returns {Promise<object>} the row.
 */
async function findHost(id) {
  const data = await readData()
  const host = data.hosts.find(candidate => candidate.id === id)
  if (host === undefined) throw new HttpError(404, 'host/not-found', 'That host no longer exists.')
  return host
}

/**
 * Reduce one failed ssh outcome to the message an operator needs.
 * @param {object} outcome - runSsh result.
 * @returns {string} the detail, never empty.
 */
function failureDetail(outcome) {
  return summarizeDiagnostics(outcome.stderr)
    || summarizeDiagnostics(outcome.stdout)
    || outcome.failure
    || `ssh exited with code ${String(outcome.exitCode ?? 'unknown')}.`
}

/**
 * Throw the HTTP failure matching one non-zero ssh outcome.
 * @param {object} outcome - runSsh result.
 * @param {string} timeoutMessage - copy for the timeout case.
 * @param {string} context - what was attempted, for unexpected-exit copy.
 */
function throwSshFailure(outcome, timeoutMessage, context) {
  if (outcome.missing) {
    throw new HttpError(409, 'host/ssh-missing', 'The ssh command is not available to the Harness host.')
  }
  if (outcome.timedOut) throw new HttpError(504, 'host/timeout', timeoutMessage)
  throw new HttpError(502, 'host/remote-failed', `${context}: ${failureDetail(outcome)}`)
}

/** The byte-order mark, restored only when the original file carried one. */
const UTF8_BOM = Buffer.from([0xEF, 0xBB, 0xBF])

/**
 * Read one remote text file for the editor.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {Record<string, unknown>} input - request body (`id`, `path`).
 * @param {AbortSignal|undefined} signal - caller cancellation.
 * @returns {Promise<{path: string, content: string, sha256: string, size: number, bom: boolean, eol: 'lf'|'crlf'}>} the file.
 */
async function readRemoteFile(ctx, input, signal) {
  const id = hostIdOf(input)
  const filePath = remotePathOf(input, { absolute: true })
  const host = await findHost(id)
  const secrets = await readSecrets(ctx.get('credentials'), host.id)
  const outcome = await runSsh(ctx, host, secrets, buildFileReadCommand(filePath), signal, {
    maxOutputBytes: MAX_FILE_OUTPUT_BYTES,
  })
  if (outcome.exitCode === 4) {
    throw new HttpError(404, 'host/file-missing', 'That remote file no longer exists.')
  }
  if (outcome.exitCode !== 0) throwSshFailure(outcome, 'Reading the remote file timed out.', 'Could not read the file')
  if (outcome.stdoutLossy) {
    throw new HttpError(413, 'host/file-too-large', `The file is larger than ${String(MAX_EDIT_BYTES)} bytes.`)
  }
  const newline = outcome.stdout.indexOf('\n')
  if (newline < 0) throw new HttpError(502, 'host/remote-failed', 'The remote host returned no file digest.')
  const sha256 = outcome.stdout.slice(0, newline).trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    throw new HttpError(502, 'host/remote-failed', 'The remote host returned an unexpected file digest.')
  }
  const bytes = Buffer.from(outcome.stdout.slice(newline + 1).replace(/\s+/g, ''), 'base64')
  if (bytes.length > MAX_EDIT_BYTES) {
    throw new HttpError(413, 'host/file-too-large', `The file is larger than ${String(MAX_EDIT_BYTES)} bytes.`)
  }
  if (bytes.includes(0)) {
    throw new HttpError(415, 'host/file-binary', 'The file contains binary content.')
  }
  const bom = bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bom ? bytes.subarray(3) : bytes)
  } catch {
    throw new HttpError(415, 'host/file-encoding', 'The file is not valid UTF-8 text.')
  }
  // A stray CRLF in an otherwise LF file must not turn the whole file into
  // CRLF on save, so only a file with no lone LF counts as CRLF.
  const crlfCount = (text.match(/\r\n/g) ?? []).length
  const loneLfCount = (text.match(/(^|[^\r])\n/g) ?? []).length
  const eol = crlfCount > 0 && loneLfCount === 0 ? 'crlf' : 'lf'
  return {
    path: filePath,
    content: text.replace(/\r\n/g, '\n'),
    sha256,
    size: bytes.length,
    bom,
    eol,
  }
}

/**
 * Write one remote text file back after a conflict check.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {Record<string, unknown>} input - request body (`id`, `path`, `content`, `baseSha256`, `bom`, `eol`, `force`).
 * @param {AbortSignal|undefined} signal - caller cancellation.
 * @returns {Promise<{path: string, size: number, sha256: string}>} the written revision.
 */
async function writeRemoteFile(ctx, input, signal) {
  const id = hostIdOf(input)
  const filePath = remotePathOf(input, { absolute: true })
  if (typeof input.content !== 'string') {
    throw new HttpError(400, 'host/invalid-field', 'The file content is required.')
  }
  const content = input.content
  const baseSha256 = typeof input.baseSha256 === 'string' ? input.baseSha256.trim().toLowerCase() : ''
  if (!/^[0-9a-f]{64}$/.test(baseSha256)) {
    throw new HttpError(400, 'host/invalid-field', 'The revision the edit started from is required.')
  }
  const force = input.force === true
  const eol = input.eol === 'crlf' ? 'crlf' : 'lf'
  const bom = input.bom === true
  const host = await findHost(id)
  const secrets = await readSecrets(ctx.get('credentials'), host.id)

  if (!force) {
    const current = await runSsh(ctx, host, secrets, buildFileHashCommand(filePath), signal)
    if (current.exitCode !== 0) throwSshFailure(current, 'Checking the remote file timed out.', 'Could not check the file')
    const currentSha = current.stdout.trim().toLowerCase()
    if (currentSha === '') {
      throw new HttpError(404, 'host/file-missing', 'That remote file no longer exists.')
    }
    if (currentSha !== baseSha256) {
      throw new HttpError(409, 'host/conflict', 'The remote file changed after it was opened.')
    }
  }

  const normalized = eol === 'crlf' ? content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n') : content
  const body = Buffer.from(normalized, 'utf8')
  const bytes = bom ? Buffer.concat([UTF8_BOM, body]) : body
  if (bytes.length > MAX_WRITE_BYTES) {
    throw new HttpError(413, 'host/file-too-large', `The file is larger than ${String(MAX_WRITE_BYTES)} bytes.`)
  }
  const expected = createHash('sha256').update(bytes).digest('hex')
  const written = await runSsh(ctx, host, secrets, buildFileWriteCommand(filePath), signal, {
    stdinData: bytes.toString('base64'),
    maxOutputBytes: 4_096,
  })
  if (written.exitCode !== 0) throwSshFailure(written, 'Saving the remote file timed out.', 'Could not save the file')
  const actual = written.stdout.trim().split(/\r?\n/)[0].trim().toLowerCase()
  if (actual !== expected) {
    throw new HttpError(502, 'host/write-verify-failed', 'The remote file does not match what was sent.')
  }
  return { path: filePath, size: bytes.length, sha256: expected }
}

/**
 * List importable aliases and whether each already exists.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @returns {Promise<{path: string, missing: boolean, candidates: object[]}>} candidates.
 */
async function importCandidates(ctx) {
  const config = await loadSshConfig()
  const data = await readData()
  const existing = new Set(data.hosts.map(host => host.name))
  return {
    path: config.path,
    missing: config.missing,
    candidates: config.candidates.map(candidate => ({ ...candidate, exists: existing.has(candidate.name) })),
  }
}

/**
 * Import the selected aliases as host records.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {Record<string, unknown>} input - request body.
 * @returns {Promise<{imported: string[], skipped: string[]}>} import outcome.
 */
async function importSelected(ctx, input) {
  const requested = Array.isArray(input.names)
    ? [...new Set(input.names.filter(name => typeof name === 'string' && name !== ''))]
    : []
  if (requested.length === 0) throw new HttpError(400, 'host/import-empty', 'Select at least one host to import.')
  const config = await loadSshConfig()
  const byName = new Map(config.candidates.map(candidate => [candidate.name, candidate]))
  const imported = []
  const skipped = []
  await withStore(async (data) => {
    for (const name of requested) {
      const candidate = byName.get(name)
      if (candidate === undefined) {
        skipped.push(name)
        continue
      }
      if (data.hosts.some(host => host.name === name)) {
        skipped.push(name)
        continue
      }
      const now = new Date().toISOString()
      data.hosts.push({
        id: randomUUID(),
        name: candidate.name,
        host: candidate.host,
        port: candidate.port,
        user: candidate.user,
        identityFile: candidate.identityFile,
        proxyJump: candidate.proxyJump,
        defaultWorkspace: '',
        useSshConfig: false,
        remoteCliInstall: 'auto',
        apiKeyStorage: 'remote',
        createdAt: now,
        updatedAt: now,
      })
      imported.push(name)
    }
  })
  return { imported, skipped }
}

/**
 * Build one JSON response.
 * @param {unknown} value - payload.
 * @param {number} status - HTTP status.
 * @returns {Response} the response.
 */
function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}

/**
 * Read a buffered JSON object request body.
 * @param {Request} request - incoming request.
 * @returns {Promise<Record<string, unknown>>} decoded object.
 */
async function readJson(request) {
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'request/too-large', 'The request body is too large.')
  if (text.trim() === '') return {}
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new HttpError(400, 'request/invalid-json', 'The request body must be JSON.')
  }
  if (!isRecord(parsed)) throw new HttpError(400, 'request/invalid-json', 'The request body must be a JSON object.')
  return parsed
}

/**
 * Translate handler failures into JSON responses.
 * @param {(request: Request) => Promise<Response>} handler - route handler.
 * @returns {(request: Request) => Promise<Response>} the wrapped handler.
 */
function respond(handler) {
  return async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      const code = error instanceof HttpError ? error.code : 'host/internal'
      const message = error instanceof Error ? error.message : String(error)
      if (status >= 500) console.error('ssh-hosts:', error)
      return json({ error: code, message }, status)
    }
  }
}

/**
 * Register the host routes for the Client half.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 */
export function apply(ctx) {
  const routes = [
    ['list', ['GET'], async () => json(await listHosts(ctx))],
    ['save', ['POST'], async request => json(await saveHost(ctx, await readJson(request)))],
    ['remove', ['POST'], async request => json(await removeHost(ctx, (await readJson(request)).id))],
    ['test', ['POST'], async request => json(await testHost(ctx, (await readJson(request)).id, request.signal))],
    ['tree', ['POST'], async request => json(await browseHost(ctx, await readJson(request), request.signal))],
    ['read', ['POST'], async request => json(await readRemoteFile(ctx, await readJson(request), request.signal))],
    ['write', ['POST'], async request => json(await writeRemoteFile(ctx, await readJson(request), request.signal))],
    ['import', ['GET', 'POST'], async request => request.method === 'POST'
      ? json(await importSelected(ctx, await readJson(request)))
      : json(await importCandidates(ctx))],
  ]
  for (const [name, methods, handler] of routes) {
    ctx.effect(
      () => ctx.connection.fetch.register({
        path: `${API_PREFIX}.${name}`,
        methods,
        requestBody: 'buffered',
        fetch: respond(handler),
      }),
      `ssh-hosts: ${name} route`,
    )
  }
}
