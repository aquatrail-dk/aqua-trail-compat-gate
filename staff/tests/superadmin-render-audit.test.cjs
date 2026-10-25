const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('audit: online Superadmin render must not invoke offline event PUK generation', () => {
  const nodes = new Map();
  const calls = [];
  const api = {
    isOnline: () => true,
    workspaceConfig: () => ({mode: 'DEMO', epoch: 7}),
    sessionData: () => ({role: 'SUPERADMIN', username: 'audit'}),
    publicData: () => ({events: [{id: 'AUDIT-EVENT', name: 'Synthetic fixture', workspace: 'DEMO'}]}),
    adminData: () => ({offline_accounts: []}),
    commitState: () => { calls.push('commitState during render'); return Promise.resolve({}); }
  };
  const storage = {getItem: () => null, setItem() {}, removeItem() {}, length: 0};
  const context = {
    window: {AQUATRAIL_RUNTIME: {mode: 'ONLINE_STAFF', allow_client_authority: false}, ATDataAPI: api, addEventListener() {}},
    location: {protocol: 'https:', hostname: 'example.invalid', pathname: '/staff/superadmin.html'},
    localStorage: storage, sessionStorage: storage,
    document: {querySelector(q) {if (!nodes.has(q)) nodes.set(q, {classList: {add() {}}, value: ''}); return nodes.get(q);}, querySelectorAll: () => []},
    ATApp: {onReady: f => f()}, crypto: require('node:crypto').webcrypto,
    console, URLSearchParams, Uint32Array, Date, Intl, setTimeout,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/store.js'), 'utf8'), context);
  context.ATStore = context.window.ATStore;
  assert.doesNotThrow(() => vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/superadmin.js'), 'utf8'), context));
  assert.deepEqual(calls, [], 'render must be read-only');
});
