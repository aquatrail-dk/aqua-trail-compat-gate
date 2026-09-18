const EVENTS = [
  {event_id:"ARCH-2026-10-04", titolo:"Aqua Trail Architecture Gate – Evento Demo", data:"2026-10-04", stato:"TEST"},
  {event_id:"ARCH-2026-10-11", titolo:"Aqua Trail Architecture Gate – Secondo Evento", data:"2026-10-11", stato:"TEST"}
];

const PAIRS = [
  {binomio_id:"B-ARCH-001", event_id:"ARCH-2026-10-04", conduttore:"Mario Rossi", cane:"Luna", categoria:"OPEN", stato:"VALIDATO"},
  {binomio_id:"B-ARCH-002", event_id:"ARCH-2026-10-04", conduttore:"Giulia Bianchi", cane:"Thor", categoria:"ADVANCE", stato:"VALIDATO"},
  {binomio_id:"B-ARCH-003", event_id:"ARCH-2026-10-11", conduttore:"Luca Verdi", cane:"Maya", categoria:"OPEN", stato:"VALIDATO"}
];

export class DemoProvider {
  constructor() {
    this.current = null;
    this.writes = [];
  }

  async health() {
    return {ok:true, data:{version:"arch-gate-0.1", mode:"DEMO", status:"READY"}};
  }

  async login(username, password) {
    if (password !== "demo") throw new Error("Password DEMO: demo");
    if (username === "admin.test") {
      this.current = {user_id:"U-ADMIN-TEST", username, role:"ADMIN", event_id:""};
    } else if (username === "giudice.test") {
      this.current = {user_id:"U-JUDGE-TEST", username, role:"GIUDICE", event_id:"ARCH-2026-10-04"};
    } else {
      throw new Error("Utente DEMO non valido");
    }
    return {ok:true, data:{session:this.current, token:"DEMO-TOKEN"}};
  }

  async logout() {
    this.current = null;
    return {ok:true};
  }

  async session() {
    return {ok:true, data:{session:this.current}};
  }

  requireSession() {
    if (!this.current) throw new Error("Login richiesto");
    return this.current;
  }

  async listEvents() {
    const s = this.requireSession();
    const rows = s.role === "GIUDICE" ? EVENTS.filter(x => x.event_id === s.event_id) : EVENTS;
    return {ok:true, data:{events:rows}};
  }

  async getEvent(eventId) {
    const events = (await this.listEvents()).data.events;
    const event = events.find(x => x.event_id === eventId);
    if (!event) throw new Error("Evento non accessibile");
    return {ok:true, data:{event}};
  }

  async listPairs(eventId) {
    const s = this.requireSession();
    if (s.role === "GIUDICE" && s.event_id !== eventId) throw new Error("Evento fuori scope GIUDICE");
    return {ok:true, data:{binomi:PAIRS.filter(x => x.event_id === eventId)}};
  }

  async getEventBundle(eventId) {
    const event = (await this.getEvent(eventId)).data.event;
    const binomi = (await this.listPairs(eventId)).data.binomi;
    return {ok:true, data:{event, binomi}};
  }

  async writeProbe(eventId, value) {
    const s = this.requireSession();
    if (s.role === "GIUDICE" && s.event_id !== eventId) throw new Error("Evento fuori scope GIUDICE");
    const item = {write_id:"DEMO-" + Date.now(), event_id:eventId, user_id:s.user_id, azione:"PROBE", valore:value, created_at:new Date().toISOString()};
    this.writes.push(item);
    return {ok:true, data:{write:item}};
  }
}
