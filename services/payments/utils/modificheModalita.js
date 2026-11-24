// Tracciamento delle modifiche a modalità di pagamento e conto di un pagamento.
//
// Ogni modifica effettiva (valore diverso da quello salvato) viene registrata:
//  - in payment_modifiche (mostrata in Dettaglio ricevuta), con autore e origine;
//  - nello storico del socio (servizio users), se il pagamento è collegato a un socio.
// Se lo storico socio non si scrive la modifica va annullata dal chiamante
// (stessa regola della proroga scadenza: niente modifiche senza traccia).

const { PaymentModifica } = require('../models');

const usersUrl = () => process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
const internalSecret = () => process.env.INTERNAL_API_SECRET || 'internal_secret_change_me';

const ORIGINI = ['dettaglio_ricevuta', 'prima_nota'];

const norm = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
};

// Valori di modalità/conto che cambierebbero applicando `patch` a `prima` (null se nessuno)
function diffModalita(prima, patch) {
    const out = {};
    if ('modalita_pagamento' in patch && norm(patch.modalita_pagamento) !== norm(prima.modalita_pagamento)) {
        out.modalita = { da: norm(prima.modalita_pagamento), a: norm(patch.modalita_pagamento) };
    }
    if ('conto_destinazione' in patch && norm(patch.conto_destinazione) !== norm(prima.conto_destinazione)) {
        out.conto = { da: norm(prima.conto_destinazione), a: norm(patch.conto_destinazione) };
    }
    return out.modalita || out.conto ? out : null;
}

const val = (v) => (v == null ? '(nessuno)' : `"${v}"`);

function testoStorico(p, diff) {
    const doc = p.tipo_documento === 'proforma' ? 'proforma' : 'ricevuta';
    const rif = p.numero_ricevuta ? ` n. ${p.numero_ricevuta}` : ` #${p.id}`;
    const parti = [];
    if (diff.modalita) parti.push(`modalità di pagamento da ${val(diff.modalita.da)} a ${val(diff.modalita.a)}`);
    if (diff.conto) parti.push(`conto da ${val(diff.conto.da)} a ${val(diff.conto.a)}`);
    return `Modificata ${doc}${rif}: ${parti.join('; ')}`;
}

// Registra la modifica (da chiamare nella stessa transazione dell'update).
// Lancia un errore con `code = 'STORICO_SOCIO'` se lo storico socio non si scrive.
async function registraModificaModalita({ prima, diff, user, origine, transaction }) {
    const riga = await PaymentModifica.create({
        payment_id: prima.id,
        societa_id: prima.societa_id,
        modalita_precedente: diff.modalita ? diff.modalita.da : norm(prima.modalita_pagamento),
        modalita_nuova: diff.modalita ? diff.modalita.a : norm(prima.modalita_pagamento),
        conto_precedente: diff.conto ? diff.conto.da : norm(prima.conto_destinazione),
        conto_nuovo: diff.conto ? diff.conto.a : norm(prima.conto_destinazione),
        utente_id: user?.id ?? null,
        utente_email: user?.email || user?.username || null,
        utente_ruolo: user?.role ?? null,
        origine: ORIGINI.includes(origine) ? origine : 'altro',
    }, { transaction });

    if (!prima.socio_id) return riga;

    const res = await fetch(`${usersUrl()}/api/internal/soci/${prima.socio_id}/storico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': internalSecret() },
        body: JSON.stringify({
            societa_id: prima.societa_id,
            tipo: 'modifica_pagamento',
            azione: testoStorico(prima, diff),
            dettagli: {
                payment_id: prima.id,
                numero_ricevuta: prima.numero_ricevuta || null,
                modalita_precedente: riga.modalita_precedente,
                modalita_nuova: riga.modalita_nuova,
                conto_precedente: riga.conto_precedente,
                conto_nuovo: riga.conto_nuovo,
                origine: riga.origine,
            },
            owner_id: user?.id || null,
            owner_label: user?.email || user?.username || 'Operatore',
        }),
    }).catch(err => ({ ok: false, status: err.message }));
    if (!res.ok) {
        const e = new Error(`Storico socio non scritto (${res.status})`);
        e.code = 'STORICO_SOCIO';
        throw e;
    }
    return riga;
}

module.exports = { diffModalita, registraModificaModalita };
