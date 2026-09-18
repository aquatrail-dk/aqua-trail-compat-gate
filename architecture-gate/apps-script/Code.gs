const ARCH = Object.freeze({
  VERSION: 'arch-gate-0.3',
  SPREADSHEET_ID: '1XOqZaik3sK6tg-0bxSypkVmAgFVGGQISdr6uNndhM_0',
  SESSION_TTL: 3600
});

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');

    if (action === 'health') {
      return ok_({
        version: ARCH.VERSION,
        status: 'READY',
        mode: 'LIVE_TEST',
        transport: 'GET_HEALTH_POST_AUTH'
      });
    }

    throw new Error('GET_NOT_ALLOWED_FOR_AUTH_ACTIONS');
  } catch (err) {
    return fail_(err);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(
      (e && e.postData && e.postData.contents) || '{}'
    );

    const action = String(body.action || '');

    if (action === 'login') {
      return login_(
        String(body.username || ''),
        String(body.password || '')
      );
    }

    const session = requireSession_(
      String(body.token || '')
    );

    if (action === 'session') {
      return ok_({ session: session });
    }

    if (action === 'events') {
      return ok_({ events: listEvents_(session) });
    }

    if (action === 'event') {
      return ok_({
        event: getEvent_(
          session,
          String(body.event_id || '')
        )
      });
    }

    if (action === 'binomi') {
      return ok_({
        binomi: listPairs_(
          session,
          String(body.event_id || '')
        )
      });
    }

    if (action === 'event_bundle') {
      const eventId = String(body.event_id || '');
      return ok_({
        event: getEvent_(session, eventId),
        binomi: listPairs_(session, eventId)
      });
    }

    if (action === 'logout') {
      CacheService
        .getScriptCache()
        .remove(
          'session:' + String(body.token || '')
        );

      return ok_({ logout: true });
    }

    if (action === 'write_probe') {
      return writeProbe_(
        session,
        String(body.event_id || ''),
        String(body.value || '')
      );
    }

    throw new Error('ACTION_NOT_FOUND');

  } catch (err) {
    return fail_(err);
  }
}

function login_(username, password) {
  const users = readTable_('UTENTI_TEST');

  const user = users.find(function (x) {
    return String(x.username) === username &&
      truthy_(x.active);
  });

  if (!user) {
    throw new Error('LOGIN_INVALID');
  }

  const propKey =
    username === 'admin.test'
      ? 'ARCH_PW_ADMIN_TEST'
      : username === 'giudice.test'
      ? 'ARCH_PW_GIUDICE_TEST'
      : '';

  if (!propKey) {
    throw new Error('LOGIN_INVALID');
  }

  const expected = PropertiesService
    .getScriptProperties()
    .getProperty(propKey);

  if (!expected) {
    throw new Error('PASSWORD_NOT_CONFIGURED');
  }

  if (password !== expected) {
    throw new Error('LOGIN_INVALID');
  }

  const session = {
    user_id: String(user.user_id),
    username: String(user.username),
    role: String(user.role),
    event_id: String(user.event_id || '')
  };

  const token =
    Utilities.getUuid() +
    '-' +
    Utilities.getUuid();

  CacheService
    .getScriptCache()
    .put(
      'session:' + token,
      JSON.stringify(session),
      ARCH.SESSION_TTL
    );

  return ok_({
    token: token,
    session: session
  });
}

function requireSession_(token) {
  if (!token) {
    throw new Error('SESSION_REQUIRED');
  }

  const raw = CacheService
    .getScriptCache()
    .get('session:' + token);

  if (!raw) {
    throw new Error('SESSION_EXPIRED');
  }

  return JSON.parse(raw);
}

function listEvents_(session) {
  const rows = readTable_('EVENTI');

  if (session.role === 'GIUDICE') {
    return rows.filter(function (x) {
      return String(x.event_id) === session.event_id;
    });
  }

  return rows;
}

function getEvent_(session, eventId) {
  assertEventScope_(session, eventId);

  const row = readTable_('EVENTI')
    .find(function (x) {
      return String(x.event_id) === eventId;
    });

  if (!row) {
    throw new Error('EVENT_NOT_FOUND');
  }

  return row;
}

function listPairs_(session, eventId) {
  assertEventScope_(session, eventId);

  return readTable_('BINOMI')
    .filter(function (x) {
      return String(x.event_id) === eventId;
    });
}

function writeProbe_(session, eventId, value) {
  assertEventScope_(session, eventId);

  const write = {
    write_id: Utilities.getUuid(),
    event_id: eventId,
    user_id: session.user_id,
    azione: 'PROBE',
    valore: value,
    created_at: new Date().toISOString()
  };

  SpreadsheetApp
    .openById(ARCH.SPREADSHEET_ID)
    .getSheetByName('TEST_WRITES')
    .appendRow([
      write.write_id,
      write.event_id,
      write.user_id,
      write.azione,
      write.valore,
      write.created_at
    ]);

  return ok_({ write: write });
}

function assertEventScope_(session, eventId) {
  if (!eventId) {
    throw new Error('EVENT_ID_REQUIRED');
  }

  if (
    session.role === 'GIUDICE' &&
    session.event_id !== eventId
  ) {
    throw new Error('EVENT_SCOPE_DENIED');
  }
}

function readTable_(sheetName) {
  const sh = SpreadsheetApp
    .openById(ARCH.SPREADSHEET_ID)
    .getSheetByName(sheetName);

  if (!sh) {
    throw new Error(
      'SHEET_NOT_FOUND:' + sheetName
    );
  }

  const values = sh
    .getDataRange()
    .getValues();

  if (!values.length) {
    return [];
  }

  const headers = values[0]
    .map(function (x) {
      return String(x);
    });

  return values
    .slice(1)
    .filter(function (r) {
      return r.some(function (v) {
        return v !== '';
      });
    })
    .map(function (r) {
      const out = {};

      headers.forEach(function (h, i) {
        out[h] = normalize_(r[i]);
      });

      return out;
    });
}

function normalize_(v) {
  if (
    Object.prototype.toString.call(v) ===
    '[object Date]'
  ) {
    return Utilities.formatDate(
      v,
      'Europe/Rome',
      'yyyy-MM-dd'
    );
  }

  return v;
}

function truthy_(v) {
  return (
    v === true ||
    String(v).toLowerCase() === 'true' ||
    String(v) === '1'
  );
}

function ok_(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify({
        ok: true,
        data: data
      })
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

function fail_(err) {
  return ContentService
    .createTextOutput(
      JSON.stringify({
        ok: false,
        error: {
          message: String(
            err && err.message
              ? err.message
              : err
          )
        }
      })
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}
