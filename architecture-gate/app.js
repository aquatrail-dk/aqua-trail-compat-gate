import {ARCH_GATE_CONFIG} from "./config.js?v=20260918-0427";
import {AquaDataLayer} from "./data-layer.js?v=20260918-0427";
import {DemoProvider} from "./provider-demo.js?v=20260918-0427";
import {LiveProvider} from "./provider-live.js?v=20260918-0431";

const demo = new DemoProvider();
const live = new LiveProvider(ARCH_GATE_CONFIG.backendUrl);
const data = new AquaDataLayer(demo);

const $ = id => document.getElementById(id);
const state = {mode:"demo", selectedEvent:""};

function log(msg, obj) {
  const line = "[" + new Date().toLocaleTimeString() + "] " + msg + (obj ? " " + JSON.stringify(obj) : "");
  $("log").textContent = line + "\n" + $("log").textContent;
}

function resetProviderSessions_() {
  demo.current = null;
  live.token = "";
  live.current = null;
  $("sessionBadge").textContent = "NESSUNA";
}

function setMode(mode) {
  state.mode = mode;
  state.selectedEvent = "";
  resetProviderSessions_();
  data.setProvider(mode === "live" ? live : demo);
  $("modeBadge").textContent = mode.toUpperCase();
  $("apiBadge").textContent = mode === "live" ? (ARCH_GATE_CONFIG.backendUrl ? "CONFIGURATA" : "NON CONFIGURATA") : "N/A";
  $("events").innerHTML = "";
  $("detail").innerHTML = "";
  log("Provider attivo: " + mode.toUpperCase() + " — sessione locale azzerata");
}

async function refreshHealth() {
  try {
    const r = await data.health();
    $("healthBadge").textContent = r.data.status || "OK";
    log("Health PASS", r.data);
  } catch (e) {
    $("healthBadge").textContent = "FAIL";
    log("Health FAIL: " + e.message);
  }
}

async function login() {
  try {
    const r = await data.login($("username").value.trim(), $("password").value);
    $("sessionBadge").textContent = r.data.session.role + " / " + r.data.session.username;
    log("Login PASS", r.data.session);
  } catch (e) {
    $("sessionBadge").textContent = "NESSUNA";
    log("Login FAIL: " + e.message);
  }
}

async function logout() {
  try {
    await data.logout();
    $("sessionBadge").textContent = "NESSUNA";
    $("events").innerHTML = "";
    $("detail").innerHTML = "";
    state.selectedEvent = "";
    log("Logout PASS");
  } catch (e) { log("Logout FAIL: " + e.message); }
}

async function loadEvents() {
  try {
    const r = await data.listEvents();
    $("events").innerHTML = "";
    r.data.events.forEach(ev => {
      const b = document.createElement("button");
      b.className = "event";
      b.textContent = ev.data + " — " + ev.titolo + " [" + ev.event_id + "]";
      b.onclick = () => openEvent(ev.event_id);
      $("events").appendChild(b);
    });
    log("Eventi caricati: " + r.data.events.length);
  } catch (e) { log("EVENTI FAIL: " + e.message); }
}

async function openEvent(eventId) {
  try {
    const ev = await data.getEvent(eventId);
    const pairs = await data.listPairs(eventId);
    state.selectedEvent = eventId;
    const rows = pairs.data.binomi.map(p => "<tr><td>" + p.binomio_id + "</td><td>" + p.conduttore + "</td><td>" + p.cane + "</td><td>" + p.categoria + "</td></tr>").join("");
    $("detail").innerHTML =
      "<h3>" + ev.data.event.titolo + "</h3>" +
      "<p><strong>event_id:</strong> " + eventId + "</p>" +
      "<table><thead><tr><th>ID</th><th>Conduttore</th><th>Cane</th><th>Categoria</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<div class=\"probe\"><input id=\"probeValue\" value=\"probe-" + Date.now() + "\"><button id=\"probeBtn\">SCRIVI PROBE</button></div>";
    $("probeBtn").onclick = writeProbe;
    log("Evento aperto: " + eventId + "; binomi=" + pairs.data.binomi.length);
  } catch (e) { log("EVENTO FAIL: " + e.message); }
}

async function writeProbe() {
  try {
    const r = await data.writeProbe(state.selectedEvent, $("probeValue").value);
    log("WRITE PASS", r.data.write);
  } catch (e) { log("WRITE FAIL: " + e.message); }
}

$("mode").onchange = e => { setMode(e.target.value); refreshHealth(); };
$("loginBtn").onclick = login;
$("logoutBtn").onclick = logout;
$("eventsBtn").onclick = loadEvents;
$("healthBtn").onclick = refreshHealth;

$("mode").value = ARCH_GATE_CONFIG.defaultMode;
setMode(ARCH_GATE_CONFIG.defaultMode);
refreshHealth();
