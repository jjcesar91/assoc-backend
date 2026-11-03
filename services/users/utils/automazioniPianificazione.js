'use strict';

// Cadenza del controllo scadenze delle automazioni, configurabile per società
// (Configurazione → Automazioni). Salvata su Societa.automazioni_pianificazione:
//   { frequenza: 'giornaliera' | 'settimanale' | 'mensile',
//     ora: 0-23, giorno_settimana: 1-7 (1 = lunedì), giorno_mese: 1-28 }
// Gli orari sono sempre in Europe/Rome. Il job gira ogni ora e controlla le società
// il cui ultimo slot pianificato è successivo a Societa.automazioni_ultimo_controllo:
// così uno slot perso (servizio giù/riavvio) viene recuperato al tick successivo.

const TZ = 'Europe/Rome';
const FREQUENZE = ['giornaliera', 'settimanale', 'mensile'];
const DEFAULT = Object.freeze({ frequenza: 'giornaliera', ora: 6, giorno_settimana: 1, giorno_mese: 1 });
// Giorni tra due controlli: con una finestra di invio (giorni di anticipo) più corta,
// una scadenza potrebbe cadere tra due controlli senza che parta l'email.
const INTERVALLO_GIORNI = { giornaliera: 1, settimanale: 7, mensile: 31 };

const intero = (v, min, max, def) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};

function normalizza(p) {
  const src = p && typeof p === 'object' ? p : {};
  return {
    frequenza: FREQUENZE.includes(src.frequenza) ? src.frequenza : DEFAULT.frequenza,
    ora: intero(src.ora, 0, 23, DEFAULT.ora),
    giorno_settimana: intero(src.giorno_settimana, 1, 7, DEFAULT.giorno_settimana),
    giorno_mese: intero(src.giorno_mese, 1, 28, DEFAULT.giorno_mese),
  };
}

// Validazione per l'API: errore esplicito invece della normalizzazione silenziosa.
function valida(p) {
  if (!p || typeof p !== 'object') return 'Pianificazione non valida';
  if (!FREQUENZE.includes(p.frequenza)) return 'Frequenza non valida';
  if (intero(p.ora, 0, 23, null) === null) return "Ora non valida (0-23)";
  if (p.frequenza === 'settimanale' && intero(p.giorno_settimana, 1, 7, null) === null) return 'Giorno della settimana non valido';
  if (p.frequenza === 'mensile' && intero(p.giorno_mese, 1, 28, null) === null) return 'Giorno del mese non valido (1-28)';
  return null;
}

// Ora "da parete" di Roma come Date UTC "ingenua" (i campi UTC = ora locale di Roma):
// permette l'aritmetica su giorni/mesi senza librerie di fusi orari.
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function localeRoma(date) {
  const parts = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute));
}

// Ultimo slot pianificato <= adesso (ora locale di Roma, Date "ingenua").
function ultimoSlot(pianificazione, now = new Date()) {
  const p = normalizza(pianificazione);
  const loc = localeRoma(now);
  const y = loc.getUTCFullYear(), m = loc.getUTCMonth(), d = loc.getUTCDate();
  let slot;
  if (p.frequenza === 'mensile') {
    slot = new Date(Date.UTC(y, m, p.giorno_mese, p.ora));
    if (slot > loc) slot = new Date(Date.UTC(y, m - 1, p.giorno_mese, p.ora));
  } else if (p.frequenza === 'settimanale') {
    const dow = ((loc.getUTCDay() + 6) % 7) + 1; // 1 = lunedì … 7 = domenica
    slot = new Date(Date.UTC(y, m, d - ((dow - p.giorno_settimana + 7) % 7), p.ora));
    if (slot > loc) slot = new Date(slot.getTime() - 7 * 86400000);
  } else {
    slot = new Date(Date.UTC(y, m, d, p.ora));
    if (slot > loc) slot = new Date(slot.getTime() - 86400000);
  }
  return slot;
}

// Slot successivo all'ultimo (per mostrarlo in UI).
function prossimoSlot(pianificazione, now = new Date()) {
  const p = normalizza(pianificazione);
  const s = ultimoSlot(p, now);
  if (p.frequenza === 'mensile') return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, p.giorno_mese, p.ora));
  return new Date(s.getTime() + (p.frequenza === 'settimanale' ? 7 : 1) * 86400000);
}

// La società va controllata se dall'ultimo slot non è ancora stato fatto un controllo pianificato.
function daControllare(societa, now = new Date()) {
  const ultimo = societa.automazioni_ultimo_controllo;
  if (!ultimo) return true;
  return localeRoma(new Date(ultimo)) < ultimoSlot(societa.automazioni_pianificazione, now);
}

// Date "ingenua" di Roma → stringa 'YYYY-MM-DDTHH:mm' (ora locale, senza fuso).
const formatLocale = (d) => d.toISOString().slice(0, 16);

// Prossimo controllo da mostrare in UI: se uno slot è in attesa parte al prossimo tick orario.
function prossimoControllo(societa, now = new Date()) {
  if (!daControllare(societa, now)) return prossimoSlot(societa.automazioni_pianificazione, now);
  const loc = localeRoma(now);
  return new Date(Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate(), loc.getUTCHours() + 1));
}

module.exports = { DEFAULT, FREQUENZE, INTERVALLO_GIORNI, normalizza, valida, ultimoSlot, prossimoSlot, daControllare, prossimoControllo, formatLocale, localeRoma };
