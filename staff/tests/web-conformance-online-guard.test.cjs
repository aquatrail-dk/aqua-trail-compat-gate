const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('online-only unsafe local controls are disabled', () => {
  const ids = ['#changeEventState', '#deleteEvent', '#savePin', '#saveSeason',
    '#closeSeason', '#saveTechnical', '#saveDraft', '#publishDraft',
    '#hideDraft', '#saveOrganizer', '#resetOffline'];
  const nodes = new Map(ids.map(id => [id, {disabled: false, dataset: {}, title: ''}]));
  const document = {
    readyState: 'complete',
    querySelectorAll: selector => nodes.has(selector) ? [nodes.get(selector)] : [],
    querySelector: selector => nodes.get(selector) || null,
    getElementById: () => null,
    addEventListener() {}
  };
  const context = {window: {AQUATRAIL_RUNTIME: {mode: 'ONLINE_STAFF'}, addEventListener() {}},
    document, console, setTimeout, clearTimeout};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/web-conformance.js'), 'utf8'), context);
  for (const id of ids) assert.equal(nodes.get(id).disabled, true, `${id} should be disabled online`);
});
