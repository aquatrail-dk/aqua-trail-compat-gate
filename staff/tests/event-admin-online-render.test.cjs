const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('online Eventi render does not generate a local event PUK', () => {
  const nodes = new Map();
  const callbacks = [];
  const node = () => ({
    value: '', style: {}, classList: {add() {}, remove() {}},
    options: [], add(option) {this.options.push(option)},
    addEventListener() {}, set innerHTML(value) {this._html = value},
    get innerHTML() {return this._html || ''}
  });
  const document = {
    querySelector(selector) {if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector)},
    querySelectorAll() {return []},
    createElement() {return node()}
  };
  let pukCalls = 0;
  const publicData = {events: [{id: 'TEST-EVENT', name: 'Evento test', status: 'PUBBLICATO', start_date: '2026-11-01'}], event_days: [], stage_config: []};
  const store = {
    public: () => publicData, admin: () => ({settings: {}}), session: () => ({role: 'SUPERADMIN'}),
    fmtDate: x => x, qs: () => '', ensureEventPuk: () => {pukCalls++; throw Error('offline PUK generation')},
    eventPuk: () => {throw Error('offline PUK read')}
  };
  const context = {
    ATApp: {onReady(fn) {callbacks.push(fn)}}, ATStore: store,
    ATContent: {eventPlain: () => ''}, ATMedia: {url: () => ''},
    ATSeason: {infoForDate: () => ({label: '2026', id: '2026', inConfiguredSeason: true})},
    window: {ATDataAPI: {isOnline: () => true}}, document,
    Option: function Option(label, value) {this.label = label; this.value = value},
    console, Date, String, Number, encodeURIComponent, setTimeout
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/event-admin.js'), 'utf8'), context);
  assert.doesNotThrow(() => callbacks[0]());
  assert.equal(nodes.get('#eventSelector').options.length, 1);
  assert.equal(nodes.get('#adminEventHeading').textContent, 'Evento test');
  assert.equal(pukCalls, 0);
});
