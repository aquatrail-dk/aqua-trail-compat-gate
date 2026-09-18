export class LiveProvider {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = "";
    this.current = null;
  }

  ensureConfigured() {
    if (!this.baseUrl) throw new Error("Backend LIVE non ancora configurato");
  }

  async parseJson_(r, action) {
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      const snippet = text.replace(/\s+/g, " ").slice(0, 180);
      throw new Error(
        "NON_JSON action=" + action +
        " status=" + r.status +
        " url=" + r.url +
        " body=" + snippet
      );
    }
  }

  async get(action, params) {
    this.ensureConfigured();
    const url = new URL(this.baseUrl);
    url.searchParams.set("action", action);
    url.searchParams.set("_ts", Date.now().toString());
    if (this.token) url.searchParams.set("token", this.token);
    Object.entries(params || {}).forEach(([k,v]) => url.searchParams.set(k, v));
    const r = await fetch(url.toString(), {method:"GET", redirect:"follow", cache:"no-store"});
    const data = await this.parseJson_(r, action);
    if (!data.ok) throw new Error(
      "API action=" + action + " " +
      (data.error && data.error.message ? data.error.message : "Errore API")
    );
    return data;
  }

  async post(action, body) {
    this.ensureConfigured();
    const payload = Object.assign({action, token:this.token}, body || {});
    const r = await fetch(this.baseUrl, {
      method:"POST",
      redirect:"follow",
      cache:"no-store",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });
    const data = await this.parseJson_(r, action);
    if (!data.ok) throw new Error(
      "API action=" + action + " " +
      (data.error && data.error.message ? data.error.message : "Errore API")
    );
    return data;
  }

  health() { return this.get("health"); }

  async login(username, password) {
    const out = await this.post("login", {username, password});
    this.token = out.data.token;
    this.current = out.data.session;
    return out;
  }

  async logout() {
    const out = await this.post("logout");
    this.token = "";
    this.current = null;
    return out;
  }

  session() { return this.get("session"); }
  listEvents() { return this.get("events"); }
  getEvent(eventId) { return this.get("event", {event_id:eventId}); }
  listPairs(eventId) { return this.get("binomi", {event_id:eventId}); }
  writeProbe(eventId, value) { return this.post("write_probe", {event_id:eventId, value}); }
}
