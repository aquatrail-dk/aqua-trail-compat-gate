export class LiveProvider {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = "";
    this.current = null;
  }

  ensureConfigured() {
    if (!this.baseUrl) {
      throw new Error("Backend LIVE non ancora configurato");
    }
  }

  async parseJson_(r, action) {
    const text = await r.text();

    try {
      return JSON.parse(text);
    } catch (_) {
      const snippet = text
        .replace(/\s+/g, " ")
        .slice(0, 180);

      throw new Error(
        "NON_JSON action=" + action +
        " status=" + r.status +
        " url=" + r.url +
        " body=" + snippet
      );
    }
  }

  async getHealth_() {
    this.ensureConfigured();

    const url = new URL(this.baseUrl);
    url.searchParams.set("action", "health");
    url.searchParams.set("_ts", Date.now().toString());

    const r = await fetch(
      url.toString(),
      {
        method: "GET",
        redirect: "follow",
        cache: "no-store"
      }
    );

    const data = await this.parseJson_(r, "health");

    if (!data.ok) {
      throw new Error(
        "API action=health " +
        (
          data.error && data.error.message
            ? data.error.message
            : "Errore API"
        )
      );
    }

    return data;
  }

  async post(action, body) {
    this.ensureConfigured();

    const payload = Object.assign(
      {
        action: action,
        token: this.token
      },
      body || {}
    );

    const r = await fetch(
      this.baseUrl,
      {
        method: "POST",
        redirect: "follow",
        cache: "no-store",
        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await this.parseJson_(
      r,
      action
    );

    if (!data.ok) {
      throw new Error(
        "API action=" + action + " " +
        (
          data.error && data.error.message
            ? data.error.message
            : "Errore API"
        )
      );
    }

    return data;
  }

  health() {
    return this.getHealth_();
  }

  async login(username, password) {
    const out = await this.post(
      "login",
      { username, password }
    );

    this.token = out.data.token;
    this.current = out.data.session;

    return out;
  }

  async logout() {
    const out = await this.post(
      "logout"
    );

    this.token = "";
    this.current = null;

    return out;
  }

  session() {
    return this.post("session");
  }

  listEvents() {
    return this.post("events");
  }

  getEvent(eventId) {
    return this.post(
      "event",
      { event_id: eventId }
    );
  }

  listPairs(eventId) {
    return this.post(
      "binomi",
      { event_id: eventId }
    );
  }

  getEventBundle(eventId) {
    return this.post(
      "event_bundle",
      { event_id: eventId }
    );
  }

  writeProbe(eventId, value) {
    return this.post(
      "write_probe",
      {
        event_id: eventId,
        value: value
      }
    );
  }
}
