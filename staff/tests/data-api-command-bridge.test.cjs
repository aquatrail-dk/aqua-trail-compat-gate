const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const rootAdapter = path.join(__dirname, '../../assets/data-api-adapter.js');
const staffAdapter = path.join(__dirname, '../assets/data-api-adapter.js');
const source = fs.readFileSync(staffAdapter, 'utf8');

function response(data) {
  return { ok: true, async json() { return { ok: true, data }; } };
}

function createApi(fetchImpl) {
  const window = {
    AQUATRAIL_RUNTIME: {
      mode: 'ONLINE_STAFF',
      api_base_url: 'https://example.invalid/exec',
      staff_login_url: 'login-admin.html'
    },
    dispatchEvent() {}
  };
  const context = {
    window,
    fetch: fetchImpl,
    location: { pathname: '/staff/admin.html', search: '' },
    sessionStorage: {
      getItem() { return ''; },
      setItem() {},
      removeItem() {}
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, context, { filename: 'data-api-adapter.js' });
  return window.ATDataAPI;
}

const plain = value => JSON.parse(JSON.stringify(value));

test('root and staff adapters stay identical', () => {
  assert.equal(fs.readFileSync(rootAdapter, 'utf8'), source);
});

test('existing record becomes a typed update with its version', () => {
  const api = createApi(async () => response({}));
  const plan = plain(api._buildCommandPlan(
    'public',
    { events: [{ id: 'E-1', name: 'Prima', updated_at: '2026-10-01T00:00:00Z', workspace: 'DEMO' }] },
    { events: [{ id: 'E-1', name: 'Dopo', updated_at: '2026-10-01T00:00:00Z', workspace: 'DEMO' }] }
  ));
  assert.equal(plan.length, 1);
  assert.equal(plan[0].name, 'event_mutation');
  assert.equal(plan[0].payload.table, 'EVENTI');
  assert.equal(plan[0].payload.operation, 'update');
  assert.equal(plan[0].payload.expected_updated_at, '2026-10-01T00:00:00Z');
  assert.deepEqual(plan[0].payload.changes, { NAME: 'Dopo' });
});

test('fixture record becomes a create without client-owned workspace fields', () => {
  const api = createApi(async () => response({}));
  const plan = plain(api._buildCommandPlan(
    'public',
    { events: [] },
    { events: [{ id: 'E-2', name: 'Nuovo', workspace: 'DEMO', updated_at: '' }] }
  ));
  assert.equal(plan[0].payload.operation, 'create');
  assert.deepEqual(plan[0].payload.record, { ID: 'E-2', NAME: 'Nuovo' });
});

test('multi-record changes are planned together and remain version-checked', () => {
  const api = createApi(async () => response({}));
  const plan = plain(api._buildCommandPlan(
    'public',
    { events: [
      { id: 'E-1', name: 'Prima', updated_at: 'v1' },
      { id: 'E-2', name: 'Seconda', updated_at: 'v2' }
    ] },
    { events: [
      { id: 'E-1', name: 'Nuova 1', updated_at: 'v1' },
      { id: 'E-2', name: 'Nuova 2', updated_at: 'v2' }
    ] }
  ));
  assert.equal(plan.length, 2);
  assert.deepEqual(plan.map(x => x.payload.expected_updated_at), ['v1', 'v2']);
  assert.deepEqual(plan.map(x => x.payload.changes.NAME), ['Nuova 1', 'Nuova 2']);
});

test('oversized multi-record plans fail before transport', () => {
  const api = createApi(async () => response({}));
  const before = { events: Array.from({ length: 51 }, (_, i) => ({ id: 'E-' + i, name: 'Prima', updated_at: 'v1' })) };
  const after = { events: before.events.map((x, i) => ({ ...x, name: 'Dopo ' + i })) };
  assert.throws(() => api._buildCommandPlan('public', before, after), error => error.code === 'AT_API_BATCH_SIZE_INVALID');
});

test('deletes and unsupported collections fail closed', () => {
  const api = createApi(async () => response({}));
  assert.throws(() => api._buildCommandPlan(
    'public', { events: [{ id: 'E-1', name: 'Evento', updated_at: 'v1' }] }, { events: [] }
  ), error => error.code === 'AT_API_DELETE_DISABLED');
  assert.throws(() => api._buildCommandPlan(
    'admin', {}, { accounting: [{ id: 'A-1' }] }
  ), error => error.code === 'AT_API_COLLECTION_UNSUPPORTED');
});

test('command and PIN payloads match the backend contract', async () => {
  const calls = [];
  const api = createApi(async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return response({ ok: true, revisions: { public: 2, admin: 2 } });
  });
  await api.command('event_mutation', { table: 'EVENTI', operation: 'update', id: 'E-1' }, { request_id: 'REQ-1' });
  await api.verifySecret('PIN', 'E-1', '1234');
  assert.equal(calls[0].action, 'command');
  assert.equal(calls[0].payload.name, 'event_mutation');
  assert.equal(calls[0].payload.table, 'EVENTI');
  assert.equal(Object.hasOwn(calls[0].payload, 'payload'), false);
  assert.equal(calls[1].action, 'verify_secret');
  assert.equal(calls[1].payload.secret, '1234');
  assert.equal(Object.hasOwn(calls[1].payload, 'value'), false);
});

test('commitState sends multiple records in one atomic typed command', async () => {
  const calls = [];
  const beforeEvents = [
    { id: 'E-1', name: 'Prima 1', updated_at: 'v1', workspace: 'DEMO' },
    { id: 'E-2', name: 'Prima 2', updated_at: 'v2', workspace: 'DEMO' }
  ];
  const api = createApi(async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    if (request.action === 'command') return response({
      ok: true, command: 'atomic_batch', count: 2,
      results: [
        { table: 'EVENTI', id: 'E-1', updated_at: 'v3', workspace: 'DEMO' },
        { table: 'EVENTI', id: 'E-2', updated_at: 'v4', workspace: 'DEMO' }
      ],
      revisions: { public: 2, admin: 1 }
    });
    return response({
      public_data: {
        events: [
          { id: 'E-1', name: 'Dopo 1', updated_at: 'v3', workspace: 'DEMO' },
          { id: 'E-2', name: 'Dopo 2', updated_at: 'v4', workspace: 'DEMO' }
        ]
      },
      workspace_config: { mode: 'DEMO', epoch: 1 },
      revisions: { public: 2, admin: 1 }
    });
  });
  api._absorb({
    public_data: { events: beforeEvents },
    workspace_config: { mode: 'DEMO', epoch: 1 },
    revisions: { public: 1, admin: 0 }
  });
  await api.commitState('public', { events: [
    { ...beforeEvents[0], name: 'Dopo 1' },
    { ...beforeEvents[1], name: 'Dopo 2' }
  ] }, { expected_revision: 1 });
  assert.deepEqual(calls.map(x => x.action), ['command', 'public_bundle']);
  assert.equal(calls[0].payload.name, 'atomic_batch');
  assert.equal(calls[0].payload.operations.length, 2);
  assert.equal(calls[0].payload.operations[0].name, 'event_mutation');
  assert.equal(calls[0].payload.operations[1].payload.expected_updated_at, 'v2');
  assert.equal(Object.hasOwn(calls[0].payload, 'payload'), false);
  assert.deepEqual(api.publicData().events.map(x => x.name), ['Dopo 1', 'Dopo 2']);
});

test('commitState writes through command and refreshes the public bundle', async () => {
  const calls = [];
  const api = createApi(async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    if (request.action === 'command') {
      return response({
        ok: true, id: 'E-3', updated_at: '2026-10-19T00:00:00Z',
        workspace: 'DEMO', revisions: { public: 2, admin: 1 }
      });
    }
    return response({
      public_data: {
        events: [{ id: 'E-3', name: 'Nuovo', updated_at: '2026-10-19T00:00:00Z', workspace: 'DEMO' }]
      },
      workspace_config: { mode: 'DEMO', epoch: 1 },
      revisions: { public: 2, admin: 1 }
    });
  });
  api._absorb({
    public_data: { events: [] },
    workspace_config: { mode: 'DEMO', epoch: 1 },
    revisions: { public: 1, admin: 0 }
  });
  await api.commitState('public', { events: [{ id: 'E-3', name: 'Nuovo', workspace: 'DEMO' }] }, { expected_revision: 1 });
  assert.deepEqual(calls.map(x => x.action), ['command', 'public_bundle']);
  assert.equal(calls[0].payload.name, 'event_mutation');
  assert.equal(api.publicData().events[0].updated_at, '2026-10-19T00:00:00Z');
});
