/**
 * Self-test for the Host half.
 *
 * Drives the registered routes through a fake Context and a fake ssh that
 * emulates the remote protocol our command builders produce: `sha256sum`,
 * `head -c … | base64` reads, and `base64 -d >` writes.
 *
 * Run with: node test/host.mjs
 */
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const home = await mkdtemp(path.join(tmpdir(), 'ssh-hosts-test-'))
process.env.DSH_HOME = home
await mkdir(path.join(home, 'ssh-hosts'), { recursive: true })

// A BOM-prefixed data file, exactly like the one PowerShell wrote in production.
const stored = {
  version: 1,
  hosts: [{
    id: 'h1',
    name: 'zlw-azure',
    host: '40.89.131.159',
    port: 2222,
    user: 'zlw',
    identityFile: '',
    proxyJump: '',
    defaultWorkspace: '/home/zlw/projects',
    useSshConfig: false,
    remoteCliInstall: 'auto',
    apiKeyStorage: 'local',
    createdAt: '2026-10-31T10:26:42.701Z',
    updatedAt: '2026-10-31T10:26:42.701Z',
  }],
}
await writeFile(path.join(home, 'ssh-hosts', 'hosts.json'), `\uFEFF${JSON.stringify(stored, null, 2)}\n`, 'utf8')

/** The fake remote filesystem: absolute path -> bytes. */
const remoteFiles = new Map()

/** Canned response override for a command the emulator does not model. */
let canned = null
let lastCommand = ''
let lastDestination = ''
let lastStdio = null

/** @returns {string} hex sha256 of one buffer. */
const shaOf = bytes => createHash('sha256').update(bytes).digest('hex')

/** @returns {string|undefined} the `p='…'` target inside one command. */
function targetOf(command) {
  const match = /^p='([^']*)'/.exec(command)
  return match === null ? undefined : match[1]
}

/** Emulate the remote side of one ssh command. */
function emulate(command) {
  if (canned !== null) {
    const reply = canned
    canned = null
    return reply
  }
  if (command === 'true') return { stdout: '', exitCode: 0 }
  if (command.startsWith('cd -- ')) return { stdout: '', exitCode: 0 }
  const target = targetOf(command)
  if (target === undefined) throw new Error(`unmodelled remote command: ${command}`)
  const bytes = remoteFiles.get(target)
  const hash = bytes === undefined ? '' : shaOf(bytes)
  if (command.includes('base64 -d >')) {
    const stdin = lastStdio?.stdin
    if (typeof stdin !== 'object' || typeof stdin.data !== 'string') {
      throw new Error('the write command must receive its payload on stdin')
    }
    const decoded = Buffer.from(stdin.data, 'base64')
    remoteFiles.set(target, decoded)
    return { stdout: `${shaOf(decoded)}\n`, exitCode: 0 }
  }
  if (command.includes('head -c')) {
    if (bytes === undefined) return { stdout: '', stderr: 'sha256sum: no such file', exitCode: 4 }
    const cap = Number(/head -c (\d+)/.exec(command)[1])
    return { stdout: `${hash}\n${bytes.subarray(0, cap).toString('base64')}`, exitCode: 0 }
  }
  if (command.includes('sha256sum')) {
    return { stdout: hash === '' ? '' : `${hash}\n`, exitCode: 0 }
  }
  throw new Error(`unmodelled remote command: ${command}`)
}

const subprocess = {
  resolveExecutable: async name => (name === 'ssh' ? '/usr/bin/ssh' : undefined),
  spawn: options => {
    const argv = options.argv
    lastCommand = argv[argv.length - 1]
    lastDestination = argv[argv.length - 2]
    lastStdio = options.stdio
    const reply = emulate(lastCommand)
    return {
      done: Promise.resolve({ exitCode: reply.exitCode ?? 0 }),
      collected: {
        stdout: { readFrom: () => ({ text: reply.stdout ?? '', lossy: false }) },
        stderr: { readFrom: () => ({ text: reply.stderr ?? '', lossy: false }) },
      },
    }
  },
}

const routes = new Map()
const ctx = {
  get: () => undefined,
  effect: fn => fn(),
  connection: { fetch: { register: route => { routes.set(route.path, route); return () => {} } } },
  subprocess,
}

const plugin = await import('../index.js')
plugin.apply(ctx)
assert.deepEqual([...routes.keys()].sort(), [
  '/api/ssh-hosts.import',
  '/api/ssh-hosts.list',
  '/api/ssh-hosts.read',
  '/api/ssh-hosts.remove',
  '/api/ssh-hosts.save',
  '/api/ssh-hosts.test',
  '/api/ssh-hosts.tree',
  '/api/ssh-hosts.write',
])

/** Call one registered route with an optional JSON body. */
async function call(name, body) {
  const route = routes.get(`/api/ssh-hosts.${name}`)
  const request = new Request(`http://127.0.0.1/api/ssh-hosts.${name}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const response = await route.fetch(request)
  return { status: response.status, payload: await response.json() }
}

// ---------------------------------------------------------------- 1. BOM tolerance

const listed = await call('list')
assert.equal(listed.status, 200, JSON.stringify(listed.payload))
assert.equal(listed.payload.hosts.length, 1)
assert.equal(listed.payload.hosts[0].name, 'zlw-azure')

// ---------------------------------------------------------------- 2. connectivity

const tested = await call('test', { id: 'h1' })
assert.equal(tested.status, 200, JSON.stringify(tested.payload))
assert.equal(tested.payload.status, 'connected')
assert.equal(lastCommand, 'true')
assert.equal(lastDestination, 'zlw@40.89.131.159')

// ---------------------------------------------------------------- 3. listing

canned = { stdout: '/home/zlw/projects\n.git/\nREADME.md\nsrc/\n', exitCode: 0 }
const tree = await call('tree', { id: 'h1', path: '/home/zlw/projects' })
assert.equal(tree.status, 200, JSON.stringify(tree.payload))
assert.equal(tree.payload.path, '/home/zlw/projects')
assert.equal(tree.payload.parent, '/home/zlw')
assert.deepEqual(tree.payload.entries.map(entry => entry.name), ['.git', 'README.md', 'src'])
assert.deepEqual(tree.payload.entries.map(entry => entry.kind), ['directory', 'file', 'directory'])
assert.equal(lastCommand, plugin.buildListCommand('/home/zlw/projects'))
assert.ok(lastCommand.includes("'/home/zlw/projects'"), lastCommand)

canned = { stdout: '/home/zlw\nDesktop/\nprojects/\n', exitCode: 0 }
const tilde = await call('tree', { id: 'h1', path: '~' })
assert.equal(tilde.status, 200, JSON.stringify(tilde.payload))
assert.equal(tilde.payload.path, '/home/zlw')
assert.equal(lastCommand, plugin.buildListCommand('~'))
assert.ok(lastCommand.includes('"$HOME"'), lastCommand)

// ---------------------------------------------------------------- 4. read a plain file

const plain = Buffer.from('line one\nline two\n')
remoteFiles.set('/home/zlw/a.txt', plain)
const read = await call('read', { id: 'h1', path: '/home/zlw/a.txt' })
assert.equal(read.status, 200, JSON.stringify(read.payload))
assert.equal(read.payload.content, 'line one\nline two\n')
assert.equal(read.payload.size, plain.length)
assert.equal(read.payload.sha256, shaOf(plain))
assert.equal(read.payload.bom, false)
assert.equal(read.payload.eol, 'lf')
assert.ok(lastCommand.includes('head -c 1048577'), 'the read must cap one byte above the editable limit')
assert.ok(lastCommand.includes('base64'), lastCommand)

// ---------------------------------------------------------------- 5. BOM + CRLF

const crlf = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('alpha\r\nbeta\r\n')])
remoteFiles.set('/home/zlw/crlf.txt', crlf)
const crlfRead = await call('read', { id: 'h1', path: '/home/zlw/crlf.txt' })
assert.equal(crlfRead.status, 200, JSON.stringify(crlfRead.payload))
assert.equal(crlfRead.payload.bom, true)
assert.equal(crlfRead.payload.eol, 'crlf')
assert.equal(crlfRead.payload.content, 'alpha\nbeta\n', 'the editor always sees LF')
assert.equal(crlfRead.payload.sha256, shaOf(crlf))

// A stray CRLF must not reclassify an LF file.
const mixed = Buffer.from('a\nb\nc\r\nd\n')
remoteFiles.set('/home/zlw/mixed.txt', mixed)
const mixedRead = await call('read', { id: 'h1', path: '/home/zlw/mixed.txt' })
assert.equal(mixedRead.payload.eol, 'lf')

// ---------------------------------------------------------------- 6. refusals

remoteFiles.set('/home/zlw/binary.bin', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]))
const binary = await call('read', { id: 'h1', path: '/home/zlw/binary.bin' })
assert.equal(binary.status, 415)
assert.equal(binary.payload.error, 'host/file-binary')

remoteFiles.set('/home/zlw/gbk.txt', Buffer.from([0xC4, 0xE3, 0xBA, 0xC3, 0x0A]))
const gbk = await call('read', { id: 'h1', path: '/home/zlw/gbk.txt' })
assert.equal(gbk.status, 415)
assert.equal(gbk.payload.error, 'host/file-encoding')

remoteFiles.set('/home/zlw/big.txt', Buffer.alloc(1024 * 1024 + 1, 0x61))
const big = await call('read', { id: 'h1', path: '/home/zlw/big.txt' })
assert.equal(big.status, 413)
assert.equal(big.payload.error, 'host/file-too-large')

const missingRead = await call('read', { id: 'h1', path: '/home/zlw/nope.txt' })
assert.equal(missingRead.status, 404)
assert.equal(missingRead.payload.error, 'host/file-missing')

// ---------------------------------------------------------------- 7. write round trip

const before = await call('read', { id: 'h1', path: '/home/zlw/crlf.txt' })
const saved = await call('write', {
  id: 'h1',
  path: '/home/zlw/crlf.txt',
  content: 'alpha\nbeta\ngamma\n',
  baseSha256: before.payload.sha256,
  bom: true,
  eol: 'crlf',
})
assert.equal(saved.status, 200, JSON.stringify(saved.payload))
const expectedBytes = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('alpha\r\nbeta\r\ngamma\r\n')])
assert.deepEqual(remoteFiles.get('/home/zlw/crlf.txt'), expectedBytes, 'BOM and CRLF must be restored byte for byte')
assert.equal(saved.payload.sha256, shaOf(expectedBytes))
assert.equal(saved.payload.size, expectedBytes.length)
assert.equal(lastCommand, plugin.buildFileWriteCommand('/home/zlw/crlf.txt'))
assert.ok(lastCommand.includes('base64 -d > "$p"'), 'the write must be in place, not a temp-file move')

// ---------------------------------------------------------------- 8. conflict

const stale = await call('write', {
  id: 'h1',
  path: '/home/zlw/a.txt',
  content: 'mine\n',
  baseSha256: shaOf(Buffer.from('someone else wrote this\n')),
  bom: false,
  eol: 'lf',
})
assert.equal(stale.status, 409)
assert.equal(stale.payload.error, 'host/conflict')

const forced = await call('write', {
  id: 'h1',
  path: '/home/zlw/a.txt',
  content: 'mine\n',
  baseSha256: shaOf(Buffer.from('someone else wrote this\n')),
  bom: false,
  eol: 'lf',
  force: true,
})
assert.equal(forced.status, 200, JSON.stringify(forced.payload))
assert.deepEqual(remoteFiles.get('/home/zlw/a.txt'), Buffer.from('mine\n'))

// ---------------------------------------------------------------- 9. write refusals

const missingWrite = await call('write', {
  id: 'h1',
  path: '/home/zlw/gone.txt',
  content: 'x\n',
  baseSha256: shaOf(Buffer.from('x\n')),
  bom: false,
  eol: 'lf',
})
assert.equal(missingWrite.status, 404)
assert.equal(missingWrite.payload.error, 'host/file-missing')

const noBase = await call('write', { id: 'h1', path: '/home/zlw/a.txt', content: 'x\n' })
assert.equal(noBase.status, 400)

const relative = await call('read', { id: 'h1', path: 'a.txt' })
assert.equal(relative.status, 400, 'reads must name an absolute remote path')

const control = await call('read', { id: 'h1', path: '/x\u0001y' })
assert.equal(control.status, 400)

// ---------------------------------------------------------------- 10. write verification

remoteFiles.set('/home/zlw/verify.txt', Buffer.from('ok\n'))
// A remote that reports a digest we did not send must not be reported as success.
const realSpawn = subprocess.spawn
subprocess.spawn = options => {
  const argv = options.argv
  lastCommand = argv[argv.length - 1]
  lastStdio = options.stdio
  if (lastCommand.includes('base64 -d >')) {
    return {
      done: Promise.resolve({ exitCode: 0 }),
      collected: {
        stdout: { readFrom: () => ({ text: `${'0'.repeat(64)}\n`, lossy: false }) },
        stderr: { readFrom: () => ({ text: '', lossy: false }) },
      },
    }
  }
  return realSpawn(options)
}
const silentError = console.error
console.error = () => {}
const corrupted = await call('write', {
  id: 'h1',
  path: '/home/zlw/verify.txt',
  content: 'ok\n',
  baseSha256: shaOf(Buffer.from('ok\n')),
  bom: false,
  eol: 'lf',
  force: true,
})
console.error = silentError
subprocess.spawn = realSpawn
assert.equal(corrupted.status, 502)
assert.equal(corrupted.payload.error, 'host/write-verify-failed')

// ---------------------------------------------------------------- 11. quoting and edges

assert.equal(plugin.posixQuote("it's"), `'it'\\''s'`)
assert.equal(
  plugin.buildFileWriteCommand("~/it's mine"),
  `p="$HOME"/'it'\\''s mine' && base64 -d > "$p" && (sha256sum -- "$p" 2>/dev/null || shasum -a 256 -- "$p") | cut -d' ' -f1`,
)
assert.equal(plugin.parseListing('/x\r\nonly.txt').entries[0].name, 'only.txt')
assert.equal(plugin.parentPath('/'), '')
assert.equal(plugin.parentPath('/home'), '/')

console.log('host selftest: all assertions passed')
await rm(home, { recursive: true, force: true })
