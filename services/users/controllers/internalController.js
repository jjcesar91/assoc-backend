const { Societa, SocioStorico } = require('../models');
const { sendEmail } = require('../utils/mailService');

function formatData(dt) {
    if (!dt) return '';
    try {
        return new Date(dt).toLocaleString('it-IT', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return String(dt);
    }
}

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Recupera gli indirizzi email degli amministratori della società dal servizio
// auth (chiamata interna protetta da secret). Solo gli admin della società
// ricevono le notifiche (i superuser sono esclusi).
// `tipo` (opzionale) è la chiave del tipo di notifica: gli admin che l'hanno
// disattivata nelle preferenze vengono esclusi dai destinatari.
async function fetchAdminEmails(societaId, tipo) {
    const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth_ms:3000';
    const secret = process.env.INTERNAL_API_SECRET || 'internal_secret_change_me';
    const tipoQs = tipo ? `&tipo=${encodeURIComponent(tipo)}` : '';
    const res = await fetch(`${authUrl}/api/internal/admin-emails?societaId=${encodeURIComponent(societaId)}${tipoQs}`, {
        headers: { 'x-internal-secret': secret },
    });
    if (!res.ok) {
        throw new Error(`auth-service ha risposto ${res.status}`);
    }
    const list = await res.json();
    return Array.isArray(list) ? list : [];
}

function buildHtml({ societa, ordine, socio, ricevuta }) {
    const denom = esc(societa?.denominazione || 'la tua associazione');
    return `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.5">
          <h2 style="margin:0 0 16px;font-size:18px">Nuova ricevuta di pagamento caricata</h2>
          <p>È stata caricata una ricevuta per un ordine di <strong>${denom}</strong>.</p>
          <table style="border-collapse:collapse;margin:16px 0">
            <tbody>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Ordine</td><td style="padding:4px 0"><strong>${esc(ordine?.numero)}</strong></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Intestatario</td><td style="padding:4px 0">${esc(ordine?.intestatario)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Importo</td><td style="padding:4px 0">${esc(ordine?.importo)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Caricata da</td><td style="padding:4px 0">${esc(socio?.nominativo || ordine?.intestatario)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">File</td><td style="padding:4px 0">${esc(ricevuta?.nome_file)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Data caricamento</td><td style="padding:4px 0">${esc(formatData(ricevuta?.uploaded_at))}</td></tr>
            </tbody>
          </table>
          <p style="color:#6b7280;font-size:13px">Accedi al gestionale per visualizzare e scaricare la ricevuta dal dettaglio dell'ordine.</p>
        </div>
    `;
}

// Registra il caricamento della ricevuta nello storico del socio.
// Il file NON viene copiato qui: resta nel payments-service e la riga di storico
// conserva solo il payment_id, che il frontend usa per aprirlo tramite
// l'endpoint autenticato /payments/api/:id/ricevuta-file.
// Non deve mai far fallire la notifica: gli errori vengono solo loggati.
async function logRicevutaAStorico({ ordine, socio, ricevuta, sostituzione }) {
    if (!socio?.id) return; // ordine non collegato a un socio: niente storico
    try {
        const numero = ordine?.numero ? ` ${ordine.numero}` : '';
        const nomeFile = ricevuta?.nome_file || 'ricevuta';
        await SocioStorico.create({
            socio_id: socio.id,
            tipo: 'ricevuta',
            azione: sostituzione
                ? `Ricevuta sostituita per l'ordine${numero}: ${nomeFile}`
                : `Ricevuta caricata per l'ordine${numero}: ${nomeFile}`,
            dettagli: {
                payment_id: ordine?.id || null,
                numero_ordine: ordine?.numero || null,
                nome_file: ricevuta?.nome_file || null,
                sostituzione: !!sostituzione,
            },
            owner_tipo: 'sistema',
            owner_label: socio?.nominativo || ordine?.intestatario || 'Socio',
            data_evento: ricevuta?.uploaded_at ? new Date(ricevuta.uploaded_at) : new Date(),
        });
    } catch (e) {
        console.error('Errore scrittura storico ricevuta:', e.message);
    }
}

const InternalController = {
    // POST /api/internal/ricevuta-uploaded
    ricevutaUploaded: async (req, res) => {
        try {
            const { societa_id, ordine, socio, ricevuta, sostituzione } = req.body || {};
            if (!societa_id) {
                return res.status(400).json({ error: 'societa_id obbligatorio' });
            }

            // Prima dell'invio email: lo storico va scritto anche se la società
            // non ha destinatari configurati o se il recupero admin fallisce.
            await logRicevutaAStorico({ ordine, socio, ricevuta, sostituzione });

            // Le sostituzioni vengono registrate a storico ma non notificate via email.
            if (sostituzione) {
                return res.status(200).json({ sent: 0, logged: true });
            }

            const societa = await Societa.findByPk(societa_id);
            if (!societa) {
                return res.status(404).json({ error: 'Società non trovata' });
            }

            let recipients = [];
            try {
                const admins = await fetchAdminEmails(societa_id, 'ricevuta_caricata');
                recipients = admins.map(a => a.email).filter(Boolean);
            } catch (e) {
                console.error('Errore recupero destinatari admin:', e.message);
                return res.status(502).json({ error: 'Impossibile recuperare i destinatari' });
            }

            // Deduplica
            recipients = [...new Set(recipients)];
            if (recipients.length === 0) {
                console.warn(`Nessun destinatario admin per società ${societa_id}`);
                return res.status(200).json({ sent: 0, warning: 'Nessun destinatario' });
            }

            const subject = `Ricevuta caricata – ordine ${ordine?.numero || ''}`.trim();
            const html = buildHtml({ societa, ordine, socio, ricevuta });

            await sendEmail({ to: recipients, subject, html, societa });

            return res.status(200).json({ sent: recipients.length });
        } catch (err) {
            console.error('Errore ricevutaUploaded:', err);
            return res.status(500).json({ error: 'Errore invio notifica' });
        }
    },
};

module.exports = InternalController;
