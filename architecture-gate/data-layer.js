export class AquaDataLayer {
  constructor(provider) {
    this.provider = provider;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  health() { return this.provider.health(); }
  login(username, password) { return this.provider.login(username, password); }
  logout() { return this.provider.logout(); }
  session() { return this.provider.session(); }
  listEvents() { return this.provider.listEvents(); }
  getEvent(eventId) { return this.provider.getEvent(eventId); }
  listPairs(eventId) { return this.provider.listPairs(eventId); }
  writeProbe(eventId, value) { return this.provider.writeProbe(eventId, value); }
}
