/**
 * Throwaway Client self-test: loads the real client module under a shim
 * module loader, then renders and interacts with it through a minimal React
 * stand-in so undefined identifiers and broken render paths fail loudly.
 */

/** Elements produced by the shim. */
const FRAGMENT = Symbol('Fragment')

/** Hook frames, keyed by component type so re-renders keep their slots. */
const frames = new WeakMap()

/** Every component type that has rendered at least once. */
const knownTypes = []

let effects = []

/** @returns {object} the hook frame for the component currently rendering. */
function frameFor(type) {
  let frame = frames.get(type)
  if (frame === undefined) {
    frame = { slots: [], cursor: 0, effectDeps: [], effectFns: [] }
    frames.set(type, frame)
    if (!knownTypes.includes(type)) knownTypes.push(type)
  }
  return frame
}

/** @returns {boolean} whether two dependency lists are equal. */
function sameDeps(left, right) {
  if (left === undefined || right === undefined) return false
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
}

const React = {
  Fragment: FRAGMENT,
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children }
  },
  useRef: value => ({ current: value ?? null }),
  useCallback(fn, deps) {
    const frame = frameFor(currentType)
    const index = frame.cursor
    frame.cursor += 1
    if (frame.callbacks === undefined) frame.callbacks = []
    const stored = frame.callbacks[index]
    if (stored !== undefined && sameDeps(stored.deps, deps)) return stored.fn
    frame.callbacks[index] = { fn, deps }
    return fn
  },
  useState(initial) {
    const frame = frameFor(currentType)
    const index = frame.cursor
    frame.cursor += 1
    if (frame.slots[index] === undefined) {
      frame.slots[index] = typeof initial === 'function' ? initial() : initial
    }
    const setter = value => {
      const next = typeof value === 'function' ? value(frame.slots[index]) : value
      frame.slots[index] = next
    }
    return [frame.slots[index], setter]
  },
  useEffect(fn, deps) {
    const frame = frameFor(currentType)
    const index = frame.cursor
    frame.cursor += 1
    const previous = frame.effectDeps[index]
    const same = previous !== undefined && deps !== undefined && Array.isArray(deps)
      && deps.length === previous.length
      && deps.every((value, position) => Object.is(value, previous[position]))
    frame.effectDeps[index] = deps
    if (same) return
    effects.push(() => {
      const cleanup = frame.effectFns[index]
      if (typeof cleanup === 'function') cleanup()
      frame.effectFns[index] = fn()
    })
  },
}

let currentType = null

/** Render one element tree, invoking function components. */
function render(node, out, seen) {
  if (node === null || node === undefined || node === false || node === true) return
  if (Array.isArray(node)) {
    for (const child of node) render(child, out, seen)
    return
  }
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return
  }
  if (typeof node.type === 'function') {
    seen?.add(node.type)
    const previous = currentType
    currentType = node.type
    const frame = frames.get(node.type)
    if (frame !== undefined) frame.cursor = 0
    const produced = node.type({ ...node.props, children: node.children.length === 1 ? node.children[0] : node.children })
    currentType = previous
    render(produced, out, seen)
    return
  }
  if (node.type === FRAGMENT) {
    render(node.children, out, seen)
    return
  }
  // Host element: record it so the test can find clickable nodes.
  out.push(node)
  render(node.children, out, seen)
}

/** Flatten a rendered tree into host elements and text. */
function collect(root) {
  const out = []
  currentType = null
  render(root, out)
  return out
}

/**
 * Render, run queued effects, and drop hook frames for components that a
 * conditional render removed, so a remount behaves like a fresh React mount.
 */
async function tick() {
  const seen = new Set()
  const out = []
  currentType = null
  render(tree, out, seen)
  for (const type of knownTypes) {
    if (!seen.has(type)) frames.delete(type)
  }
  const pending = effects
  effects = []
  for (const fn of pending) fn()
  await new Promise(resolve => setTimeout(resolve, 0))
}

/** Render, settle, and repeat so an async load can reach a steady state. */
async function settleTree() {
  for (let round = 0; round < 4; round += 1) await tick()
}

/** Find host elements matching a predicate. */
function findAll(root, predicate) {
  return collect(root).filter(node => typeof node === 'object' && predicate(node))
}

// ---------------------------------------------------------------- module load

let exported = null
/** Window listeners the panel registers, so focus refreshes can be fired. */
const windowListeners = new Map()
globalThis.window = {
  __ModuleLoader__: {
    load(config) {
      exported = config.factory(name => {
        if (name === 'react') return React
        throw new Error(`unexpected require: ${name}`)
      })
    },
  },
  addEventListener(name, handler) {
    const set = windowListeners.get(name) ?? new Set()
    set.add(handler)
    windowListeners.set(name, set)
  },
  removeEventListener(name, handler) {
    windowListeners.get(name)?.delete(handler)
  },
}

/** Deliver one window event to every registered handler. */
function fireWindowEvent(name) {
  for (const handler of [...(windowListeners.get(name) ?? [])]) handler()
}
globalThis.document = {
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  head: { appendChild() {} },
  addEventListener() {},
  removeEventListener() {},
}

/** Remote tree responses the stubbed fetch serves, keyed by requested path. */
const trees = {
  '~': { path: '/home/zlw', parent: '/home', entries: [{ name: 'projects', kind: 'directory' }, { name: '.bashrc', kind: 'file' }], truncated: false },
  '/home/zlw': { path: '/home/zlw', parent: '/home', entries: [{ name: 'projects', kind: 'directory' }, { name: '.bashrc', kind: 'file' }], truncated: false },
  '/home': { path: '/home', parent: '/', entries: [{ name: 'zlw', kind: 'directory' }], truncated: false },
  '/': { path: '/', parent: '', entries: [{ name: 'etc', kind: 'directory' }, { name: 'home', kind: 'directory' }], truncated: false },
  '/etc': { path: '/etc', parent: '/', entries: [{ name: 'nginx.conf', kind: 'file' }], truncated: false },
  '/home/zlw/projects': { path: '/home/zlw/projects', parent: '/home/zlw', entries: [{ name: 'src', kind: 'directory' }, { name: 'README.md', kind: 'file' }], truncated: false },
  '/home/zlw/projects/src': { path: '/home/zlw/projects/src', parent: '/home/zlw/projects', entries: [{ name: 'main.js', kind: 'file' }], truncated: false },
}

/** The fake remote files the `read` route serves. */
const files = {
  '/home/zlw/projects/README.md': { path: '/home/zlw/projects/README.md', content: 'hello\nworld\n', sha256: 'a'.repeat(64), size: 12, bom: false, eol: 'lf' },
  '/etc/nginx.conf': { path: '/etc/nginx.conf', content: 'server {}\n', sha256: 'c'.repeat(64), size: 10, bom: false, eol: 'lf' },
}

/** Failure overrides for the file routes. */
let readFailure = null
let writeFailure = null
/** Session ids the fake Host reports as connected. */
let connectedIds = []
/** Canned failure for the next connect or disconnect call. */
let connectFailure = null

const requests = []
const goodFetch = async (url, options) => {
  const name = String(url).split('.').pop()
  requests.push({ name, body: options?.body === undefined ? undefined : JSON.parse(options.body) })
  if (name === 'list') {
    return Response.json({
      hosts: [{
        id: 'h1', name: 'zlw-azure', host: '40.89.131.159', port: 2222, user: 'zlw',
        defaultWorkspace: '', useSshConfig: false, hasPassword: false, hasPassphrase: false,
        connected: false,
      }],
    })
  }
  if (name === 'connect' || name === 'disconnect') {
    const failure = connectFailure
    connectFailure = null
    if (failure !== null) return Response.json(failure.body, { status: failure.status })
    connectedIds = name === 'connect' ? ['h1'] : []
    return Response.json({ connected: name === 'connect' })
  }
  if (name === 'sessions') return Response.json({ connected: connectedIds })
  if (name === 'tree') {
    const key = requests[requests.length - 1].body.path
    const payload = trees[key]
    if (payload === undefined) return Response.json({ error: 'host/remote-failed', message: 'no such folder' }, { status: 502 })
    return Response.json(payload)
  }
  if (name === 'read') {
    if (readFailure !== null) {
      const failure = readFailure
      readFailure = null
      return Response.json(failure.body, { status: failure.status })
    }
    const file = files[requests[requests.length - 1].body.path]
    if (file === undefined) return Response.json({ error: 'host/file-missing', message: 'gone' }, { status: 404 })
    return Response.json(file)
  }
  if (name === 'write') {
    if (writeFailure !== null) {
      const failure = writeFailure
      writeFailure = null
      return Response.json(failure.body, { status: failure.status })
    }
    const body = requests[requests.length - 1].body
    files[body.path] = { ...files[body.path], content: body.content, sha256: 'b'.repeat(64), size: body.content.length }
    return Response.json({ path: body.path, size: body.content.length, sha256: 'b'.repeat(64) })
  }
  return Response.json({ ok: true })
}
globalThis.fetch = goodFetch

await import('../client.js')
if (exported === null) throw new Error('client module did not load')

// ---------------------------------------------------------------- registration

const registrations = []
exported.apply({
  effect: fn => { fn(); return () => {} },
  locale: {
    register: () => {},
    bind: () => key => key,
  },
  slots: {
    inject: (name, factory) => factory(),
    register: (options, component) => { registrations.push({ options, component }); return () => {} },
  },
})
const main = registrations.find(entry => entry.options.name === 'main')
const sidebar = registrations.find(entry => entry.options.name === 'sidebar.panellist')
if (main === undefined || sidebar === undefined) throw new Error('both slots must register')
if (main.options.key !== 'ssh-hosts') throw new Error(`unexpected main key: ${main.options.key}`)

// ---------------------------------------------------------------- first render

let tree = React.createElement(main.component, { t: key => key })
await settleTree()
const rendered = collect(tree)
const rowText = rendered.filter(node => typeof node === 'string')
if (!rowText.includes('zlw-azure')) throw new Error(`host row missing: ${rowText.join('|')}`)

// ---------------------------------------------------------------- connect / disconnect

/** The row's connect-or-disconnect button. */
const toggleButton = () => findAll(tree, node => node.type === 'button')
  .find(node => String(node.props['aria-label'] ?? '').startsWith('action.connect')
    || String(node.props['aria-label'] ?? '').startsWith('action.disconnect'))
if (toggleButton() === undefined) throw new Error('each row needs a connect button')
if (toggleButton().props['aria-label'] !== 'action.connect: zlw-azure') {
  throw new Error(`an unconnected row must offer connect, got ${toggleButton().props['aria-label']}`)
}

toggleButton().props.onClick()
await settleTree()

const connectRequest = requests.filter(entry => entry.name === 'connect').at(-1)
if (connectRequest === undefined) throw new Error('clicking connect must call the connect route')
if (connectRequest.body.id !== 'h1') throw new Error('connecting must name the host')

if (toggleButton().props['aria-label'] !== 'action.disconnect: zlw-azure') {
  throw new Error(`a connected row must offer disconnect, got ${toggleButton().props['aria-label']}`)
}
if (toggleButton().props.className.includes('--primary')) {
  throw new Error('the disconnect action must not keep the primary connect styling')
}
if (!collect(tree).filter(node => typeof node === 'string').includes('status.connected')) {
  throw new Error('a connected row must show the connected badge')
}

toggleButton().props.onClick()
await settleTree()

if (requests.filter(entry => entry.name === 'disconnect').length !== 1) {
  throw new Error('clicking disconnect must call the disconnect route')
}
if (toggleButton().props['aria-label'] !== 'action.connect: zlw-azure') {
  throw new Error(`a disconnected row must offer connect again, got ${toggleButton().props['aria-label']}`)
}
// Asking to disconnect is not a failure, so the row must not complain about it.
if (findAll(tree, node => String(node.props.className).includes('dsh-ssh-hosts-rowError')).length !== 0) {
  throw new Error('a deliberate disconnect must not show a connection error')
}

// A rejected login must fall back to connect and explain itself.
connectFailure = { status: 200, body: { connected: false, code: 'failed', error: 'Permission denied (publickey)' } }
toggleButton().props.onClick()
await settleTree()
if (toggleButton().props['aria-label'] !== 'action.connect: zlw-azure') {
  throw new Error('a failed connect must leave the connect action in place')
}
const failedText = collect(tree).filter(node => typeof node === 'string').join('|')
if (!failedText.includes('list.connectFailed')) throw new Error(`a failed connect must be explained: ${failedText}`)

// A Host that reports no live session must not keep showing as connected.
connectedIds = []
toggleButton().props.onClick()
await settleTree()
if (toggleButton().props['aria-label'] !== 'action.disconnect: zlw-azure') {
  throw new Error('the row must be connected before the dropped-session check')
}
connectedIds = []
fireWindowEvent('focus')
await settleTree()
if (toggleButton().props['aria-label'] !== 'action.connect: zlw-azure') {
  throw new Error('a dropped session must return the row to connect')
}
const lostText = collect(tree).filter(node => typeof node === 'string').join('|')
if (!lostText.includes('list.sessionLost')) throw new Error(`a lost session must be explained: ${lostText}`)

// ---------------------------------------------------------------- open folders

const browseButton = findAll(tree, node => node.props.title === 'action.browse')[0]
if (browseButton === undefined) throw new Error('each row needs a folder button')
browseButton.props.onClick()

await settleTree()

const treeRequest = requests.filter(entry => entry.name === 'tree').at(-1)
if (treeRequest === undefined) throw new Error('opening folders must list the remote root')
if (treeRequest.body.id !== 'h1') throw new Error('the request must name the host')
if (treeRequest.body.path !== '~') throw new Error(`the root must start at ~, got ${treeRequest.body.path}`)

const panel = findAll(tree, node => node.props.className === 'dsh-ssh-hosts-browser')[0]
if (panel === undefined) throw new Error('the folder panel must render beside the list')

const names = collect(tree).filter(node => typeof node === 'string')
if (!names.includes('projects')) throw new Error('the root listing must render its folders')
if (!names.includes('.bashrc')) throw new Error('files are listed too')
if (!names.includes('/home/zlw')) throw new Error('the resolved remote path must be shown')

// ---------------------------------------------------------------- expand a folder

const folderRow = findAll(tree, node => String(node.props.className).includes('dsh-ssh-hosts-treeRow--dir'))
  .find(node => node.props.title === '/home/zlw/projects')
if (folderRow === undefined) throw new Error('a folder row must be expandable')
folderRow.props.onClick()

await settleTree()

const expandedRequest = requests.filter(entry => entry.name === 'tree').at(-1)
if (expandedRequest.body.path !== '/home/zlw/projects') throw new Error(`expanding must request the child path, got ${expandedRequest.body.path}`)
const expandedNames = collect(tree).filter(node => typeof node === 'string')
if (!expandedNames.includes('src')) throw new Error('children must render under the expanded folder')
if (!expandedNames.includes('README.md')) throw new Error('files must render under the expanded folder')

// A third level proves nested branches resolve their own base path.
const thirdRow = findAll(tree, node => String(node.props.className).includes('dsh-ssh-hosts-treeRow--dir'))
  .find(node => node.props.title === '/home/zlw/projects/src')
if (thirdRow === undefined) throw new Error('nested folders must be expandable')
thirdRow.props.onClick()
await settleTree()
if (!collect(tree).filter(node => typeof node === 'string').includes('main.js')) {
  throw new Error('a third level must be reachable')
}

// ---------------------------------------------------------------- collapse it

const reopened = findAll(tree, node => node.props.title === '/home/zlw/projects')[0]
reopened.props.onClick()
await settleTree()
const collapsed = collect(tree).filter(node => typeof node === 'string')
if (collapsed.includes('README.md')) throw new Error('collapsing must hide children')

// ---------------------------------------------------------------- close it

const closeButton = findAll(tree, node => node.props.title === 'browser.close')[0]
if (closeButton === undefined) throw new Error('the panel needs a close button')
closeButton.props.onClick()
await settleTree()
if (findAll(tree, node => node.props.className === 'dsh-ssh-hosts-browser').length !== 0) {
  throw new Error('closing must remove the panel')
}

// ---------------------------------------------------------------- failure copy

globalThis.fetch = async (url, options) => {
  requests.push({ name: String(url).split('.').pop(), body: options?.body === undefined ? undefined : JSON.parse(options.body) })
  return Response.json({ error: 'host/remote-failed', message: 'Permission denied' }, { status: 502 })
}
const browseAgain = findAll(tree, node => node.props.title === 'action.browse')[0]
browseAgain.props.onClick()
await settleTree()
const errorText = collect(tree).filter(node => typeof node === 'string').join('|')
if (!errorText.includes('browser.failed')) throw new Error(`a failed listing must show localized copy, got ${errorText}`)
if (!errorText.includes('Permission denied')) throw new Error('the ssh diagnostic must be shown')

// ---------------------------------------------------------------- open a file

globalThis.fetch = goodFetch

/** Reload the panel and expand one folder. */
async function openProjects() {
  const open = findAll(tree, node => node.props.className === 'dsh-ssh-hosts-browser').length !== 0
  const trigger = open
    ? findAll(tree, node => node.props.title === 'browser.refresh')[0]
    : findAll(tree, node => node.props.title === 'action.browse')[0]
  if (trigger === undefined) throw new Error('the panel must still offer a way in')
  trigger.props.onClick()
  await settleTree()
  const folder = findAll(tree, node => String(node.props.className).includes('dsh-ssh-hosts-treeRow--dir'))
    .find(node => node.props.title === '/home/zlw/projects')
  if (folder === undefined) throw new Error('the projects folder must be listed')
  folder.props.onClick()
  await settleTree()
}

/** Find one tree row by its absolute remote path. */
function treeRowOf(target) {
  return findAll(tree, node => String(node.props.className).includes('dsh-ssh-hosts-treeRow'))
    .find(node => node.props.title === target)
}

await openProjects()

const readmeRow = treeRowOf('/home/zlw/projects/README.md')
if (readmeRow === undefined) throw new Error('a file row must render')
readmeRow.props.onClick()
await settleTree()
const selectedRows = findAll(tree, node => String(node.props.className).includes('dsh-ssh-hosts-treeRow--selected'))
if (selectedRows.length !== 1) throw new Error('a single click must select a file')
if (requests.filter(entry => entry.name === 'read').length !== 0) throw new Error('a single click must not open the file')

treeRowOf('/home/zlw/projects/README.md').props.onDoubleClick()
await settleTree()
const readRequest = requests.filter(entry => entry.name === 'read').at(-1)
if (readRequest === undefined) throw new Error('double-clicking a file must read it')
if (readRequest.body.path !== '/home/zlw/projects/README.md') throw new Error(`wrong read path: ${readRequest.body.path}`)
if (readRequest.body.id !== 'h1') throw new Error('the read must name the host')

const editor = findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorArea')[0]
if (editor === undefined) throw new Error('the editor textarea must render')
if (editor.props.value !== 'hello\nworld\n') throw new Error(`the editor must show the file content, got ${editor.props.value}`)
if (!collect(tree).filter(node => typeof node === 'string').includes('/home/zlw/projects/README.md')) {
  throw new Error('the editor must show the remote path')
}

// ---------------------------------------------------------------- edit and save

if (findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorDot').length !== 0) {
  throw new Error('a freshly opened file must not be dirty')
}
findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorArea')[0]
  .props.onChange({ target: { value: 'hello\nworld\nagain\n' } })
await settleTree()
if (findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorDot').length !== 1) {
  throw new Error('editing must raise the unsaved marker')
}
const saveButton = findAll(tree, node => node.props['aria-label'] === 'file.save')[0]
if (saveButton === undefined) throw new Error('the editor needs a save button')
if (saveButton.props.disabled) throw new Error('save must be available once the file is dirty')
saveButton.props.onClick()
await settleTree()

const writeRequest = requests.filter(entry => entry.name === 'write').at(-1)
if (writeRequest === undefined) throw new Error('saving must call the write route')
if (writeRequest.body.content !== 'hello\nworld\nagain\n') throw new Error('the write must carry the edited content')
if (writeRequest.body.baseSha256 !== 'a'.repeat(64)) throw new Error('the write must carry the revision it started from')
if (writeRequest.body.bom !== false || writeRequest.body.eol !== 'lf') throw new Error('the write must carry the file shape')
if (writeRequest.body.force !== undefined) throw new Error('a plain save must not force')
if (findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorDot').length !== 0) {
  throw new Error('a successful save must clear the unsaved marker')
}
if (!collect(tree).filter(node => typeof node === 'string').includes('file.savedAt')) {
  throw new Error('a successful save must confirm itself')
}

// ---------------------------------------------------------------- conflict

findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorArea')[0]
  .props.onChange({ target: { value: 'conflict\n' } })
await settleTree()
writeFailure = { status: 409, body: { error: 'host/conflict', message: 'changed' } }
findAll(tree, node => node.props['aria-label'] === 'file.save')[0].props.onClick()
await settleTree()
const conflictText = collect(tree).filter(node => typeof node === 'string').join('|')
if (!conflictText.includes('file.conflict')) throw new Error(`a conflict must be explained: ${conflictText}`)
if (findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorArea')[0].props.value !== 'conflict\n') {
  throw new Error('a conflict must keep the local edit')
}

/** Find a button whose visible text is exactly one locale key. */
function buttonWithText(text) {
  return findAll(tree, node => node.type === 'button').find(node => {
    const flat = []
    const push = value => {
      if (Array.isArray(value)) value.forEach(push)
      else if (typeof value === 'string') flat.push(value)
    }
    push(node.children)
    return flat.includes(text)
  })
}

const writesBeforeOverwrite = requests.filter(entry => entry.name === 'write').length
const overwrite = buttonWithText('file.overwrite')
if (overwrite === undefined) throw new Error('a conflict must offer an overwrite')
overwrite.props.onClick()
await settleTree()
const overwritten = requests.filter(entry => entry.name === 'write').at(-1)
if (requests.filter(entry => entry.name === 'write').length !== writesBeforeOverwrite + 1) {
  throw new Error('overwriting must send the write again')
}
if (overwritten.body.force !== true) throw new Error('overwriting must force past the conflict check')

// ---------------------------------------------------------------- leaving a dirty file

findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorArea')[0]
  .props.onChange({ target: { value: 'unsaved\n' } })
await settleTree()
findAll(tree, node => node.props['aria-label'] === 'file.back')[0].props.onClick()
await settleTree()
if (!collect(tree).filter(node => typeof node === 'string').join('|').includes('file.leaveBody')) {
  throw new Error('leaving a dirty file must ask first')
}
const discard = buttonWithText('file.discard')
if (discard === undefined) throw new Error('the leave prompt must offer a discard')
discard.props.onClick()
await settleTree()
if (findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorArea').length !== 0) {
  throw new Error('discarding must return to the folder tree')
}

// ---------------------------------------------------------------- a system path asks first

const upButton = () => findAll(tree, node => node.props.title === 'browser.up')[0]
for (let step = 0; step < 3; step += 1) {
  upButton().props.onClick()
  await settleTree()
}
const etcRow = treeRowOf('/etc')
if (etcRow === undefined) throw new Error('the root listing must be reachable')
etcRow.props.onClick()
await settleTree()
treeRowOf('/etc/nginx.conf').props.onDoubleClick()
await settleTree()

const guardedWrites = requests.filter(entry => entry.name === 'write').length
findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorArea')[0]
  .props.onChange({ target: { value: 'server { listen 80; }\n' } })
await settleTree()
findAll(tree, node => node.props['aria-label'] === 'file.save')[0].props.onClick()
await settleTree()
if (!collect(tree).filter(node => typeof node === 'string').join('|').includes('file.dangerBody')) {
  throw new Error('saving under /etc must ask for confirmation')
}
if (requests.filter(entry => entry.name === 'write').length !== guardedWrites) {
  throw new Error('the system-path prompt must not write before it is confirmed')
}
const confirmWrite = buttonWithText('file.confirmWrite')
if (confirmWrite === undefined) throw new Error('the warning must offer a confirm')
confirmWrite.props.onClick()
await settleTree()
const confirmed = requests.filter(entry => entry.name === 'write').at(-1)
if (requests.filter(entry => entry.name === 'write').length !== guardedWrites + 1) {
  throw new Error('confirming a system path must write once')
}
if (confirmed.body.force !== undefined) throw new Error('confirming a system path must not force past conflicts')

// ---------------------------------------------------------------- refusals

findAll(tree, node => node.props['aria-label'] === 'file.back')[0].props.onClick()
await settleTree()
readFailure = { status: 413, body: { error: 'host/file-too-large', message: 'too big' } }
treeRowOf('/etc/nginx.conf').props.onDoubleClick()
await settleTree()
if (!collect(tree).filter(node => typeof node === 'string').join('|').includes('file.tooLarge')) {
  throw new Error('an oversized file must explain why it cannot be edited')
}
if (findAll(tree, node => node.props.className === 'dsh-ssh-hosts-editorArea').length !== 0) {
  throw new Error('an oversized file must not show an editor')
}

console.log(`client-selftest: passed (${requests.length} requests)`)
