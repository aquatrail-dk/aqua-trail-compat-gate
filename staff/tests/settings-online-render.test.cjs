const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('online settings render does not initialize offline PUKs', () => {
  const nodes = new Map();
  const callbacks = [];
  const node = () => ({value: '', checked: false, classList: {add(value) {this.lastAdded = value}, remove() {}},
    options: [], add(option) {this.options.push(option)}, remove() {},
    set innerHTML(value) {this._html = value}, get innerHTML() {return this._html || ''}});
  const document = {querySelector(selector) {if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector)}};
  let pukCalls = 0;
  const store = {
    public: () => ({events: []}), admin: () => ({settings: {}, pending_rules: []}),
    session: () => ({role: 'SUPERADMIN'}), fmtDate: x => x,
    ensureAllEventPuks: () => {pukCalls++; throw Error('offline PUK generation')}
  };
  const context = {ATApp: {onReady(fn) {callbacks.push(fn)}}, ATStore: store,
    window: {ATDataAPI: {isOnline: () => true}}, document, console, String, Number,
    Option: function Option(label, value) {this.label = label; this.value = value}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/settings-admin.js'), 'utf8'), context);
  assert.doesNotThrow(() => callbacks[0]());
  assert.equal(pukCalls, 0);
  assert.equal(nodes.get('#superadminSecurityPanel').classList.lastAdded, 'hidden');
});
