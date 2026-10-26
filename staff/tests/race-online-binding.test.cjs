const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '../assets/race-online.js'), 'utf8');
function fixture({ loseFirstReply = false, failRefreshAt = 0 } = {}) {
  const saved = new Map(), calls = [], event = 'E1', day = 'D1', pair = 'P1';
  let run = null, first = true, refreshCount = 0;
  const admin = { race_operator_assignments: [{ event_id: event, competition_id: 'COMP-A', day_id: day, stage: 'OPEN', operator_user_id: 'U1' }], race_runs: [], race_events: [], start_orders: [{ id: 'O1', event_id: event, competition_id: 'COMP-A', day_id: day, stage: 'OPEN', current_order_json: [pair], generated_at: 'now' }] };
  const publicData = { event_days: [{ id: day, event_id: event, competition_id: 'COMP-A', stages: ['OPEN'] }], stage_config: [] };
  const api = {
    publicData: () => publicData, adminData: () => admin, sessionData: () => ({ user_id: 'U1' }), workspaceConfig: () => ({ mode: 'DEMO', epoch: 23 }),
    async staffBootstrap() { if (++refreshCount === failRefreshAt) throw new Error('refresh failed'); return {}; },
    async command(name, payload, options) {
      calls.push({ name, payload, request_id: options.request_id });
      if (payload.operation === 'prepare_run') { run = { id: payload.run_id, ...payload }; admin.race_runs = [run]; return { ok: true }; }
      admin.race_events.push({ run_id: run.id, details_json: { request_id: options.request_id } });
      if (loseFirstReply && first) { first = false; const error = new Error('connection lost'); error.code = 'AT_API_NETWORK'; throw error; }
      return { ok: true };
    }
  };
  const window = { ATDataAPI: api };
  vm.runInNewContext(source, { window, TextEncoder, crypto: webcrypto, sessionStorage: { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) }, ATRace: { competitionId: () => 'COMP-A' } });
  return { bridge: window.ATRaceOnline, calls, saved, admin };
}

test('command prepares a server run and confirms the result from a fresh bundle', async () => {
  const { bridge, calls } = fixture(), scope = bridge.scope('E1', 'D1', 'OPEN', 'P1');
  await bridge.execute(scope, 'apply_penalty', { reason: 'Penalità ufficiale' });
  assert.deepEqual(calls.map(c => c.payload.operation), ['prepare_run', 'apply_penalty']);
  assert.equal(bridge.pending(), false);
});

test('lost reply reuses the same request after refresh and never duplicates the action', async () => {
  const { bridge, calls, admin } = fixture({ loseFirstReply: true }), scope = bridge.scope('E1', 'D1', 'OPEN', 'P1');
  await assert.rejects(bridge.execute(scope, 'apply_penalty', { reason: 'Penalità ufficiale' }), { code: 'AT_API_NETWORK' });
  const recovered = await bridge.execute(scope, 'apply_penalty', { reason: 'Penalità ufficiale' });
  assert.equal(recovered.replayed, true);
  assert.equal(calls.filter(c => c.payload.operation === 'apply_penalty').length, 1);
  assert.equal(admin.race_events.length, 1);
});

test('a failed server reread cannot be treated as a saved result', async () => {
  const { bridge, calls, saved } = fixture({ failRefreshAt: 3 }), scope = bridge.scope('E1', 'D1', 'OPEN', 'P1');
  await assert.rejects(bridge.execute(scope, 'record_time', { time_cs: 1234, status: 'SUPERATO' }), /refresh failed/);
  assert.equal(calls.length, 2);
  assert.equal(saved.size, 1);
  assert.equal((await bridge.execute(scope, 'record_time', { time_cs: 1234, status: 'SUPERATO' })).replayed, true);
  assert.equal(calls.length, 2);
});

test('an unresolved penalty cannot be silently retried with different content', async () => {
  const { bridge, calls } = fixture({ loseFirstReply: true }), scope = bridge.scope('E1', 'D1', 'OPEN', 'P1');
  await assert.rejects(bridge.execute(scope, 'apply_penalty', { reason: 'Prima penalità' }), { code: 'AT_API_NETWORK' });
  await assert.rejects(bridge.execute(scope, 'apply_penalty', { reason: 'Seconda penalità' }), /richiesta precedente/);
  assert.equal(calls.filter(c => c.payload.operation === 'apply_penalty').length, 1);
});

test('server JSON columns are decoded for stage scope and start order', async () => {
  const { bridge, calls, admin } = fixture();
  const publicDay = bridge.data().public.event_days[0];
  delete publicDay.stages;
  publicDay.stages_json = '["OPEN"]';
  admin.start_orders[0].current_order_json = '["P1"]';
  const scope = bridge.scope('E1', 'D1', 'OPEN', 'P1');
  assert.deepEqual(Array.from(bridge.orderedPairs(scope)), ['P1']);
  await bridge.execute(scope, 'record_time', { time_cs: 1234, status: 'SUPERATO' });
  assert.equal(calls[0].payload.operation, 'prepare_run');
});
