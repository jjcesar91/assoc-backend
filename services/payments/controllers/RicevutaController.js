const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Payment, RicevutaToken } = require('../models');

const ETICHETTA_RICEVUTA = 'Con ricevuta';
const VALIDITA_MS = 72 * 60 * 60 * 1000; // 72 ore

// Aggiunge un'etichetta alla stringa comma-separated se non già presente.
function addEtichetta(etichetteStr, nuova) {
  const list = (etichetteStr || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (!list.some(e => e.toLowerCase() === nuova.toLowerCase())) {
    list.push(nuova);
  }
  return list.join(',');
}

function formatImporto(value) {
  const n = Math.abs(parseFloat(value || 0));
  return '€ ' + n.toFixed(2).replace('.', ',');
}

// Rappresentazione "evidenza caricamento" comune alle risposte.
function evidenzaCaricamento(payment) {
  return {
    nome_file: payment.ricevuta_file_nome,
    uploaded_at: payment.ricevuta_uploaded_at,
  };
}

const RicevutaController = {
  // --- AUTENTICATA: generazione token all'invio della comunicazione proforma ---
  // POST /api/ricevuta-tokens  { payment_id }
  createToken: async (req, res) => {
    try {
      const { payment_id } = req.body;
      if (!payment_id) {
        return res.status(400).json({ error: 'payment_id obbligatorio' });
      }
      const payment = await Payment.findByPk(payment_id);
      if (!payment) {
        return res.status(404).json({ error: 'Ordine non trovato' });
      }
      if (payment.tipo_documento !== 'proforma') {
        return res.status(400).json({ error: 'Il token può essere generato solo per le proforma' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expires_at = new Date(Date.now() + VALIDITA_MS);

      await RicevutaToken.create({
        token,
        payment_id: payment.id,
        societa_id: payment.societa_id,
        expires_at,
      });

      return res.status(201).json({ token, expires_at });
    } catch (err) {
      console.error('Errore createToken ricevuta:', err);
      return res.status(500).json({ error: 'Errore generazione token' });
    }
  },

  // --- PUBBLICA: stato del link ---
  // GET /api/public/ricevuta/:token
  // 404 token inesistente | { status:'expired' } | { status:'uploaded', ... } | { status:'ok', ordine }
  getStatus: async (req, res) => {
    try {
      const { token } = req.params;
      const record = await RicevutaToken.findOne({ where: { token } });
      if (!record) {
        return res.status(404).json({ status: 'not_found', error: 'Link non valido' });
      }

      const payment = await Payment.findByPk(record.payment_id);
      if (!payment) {
        return res.status(404).json({ status: 'not_found', error: 'Ordine non trovato' });
      }

      // Se la ricevuta è già stata caricata (da QUALSIASI token dell'ordine) → sola lettura
      if (payment.ricevuta_uploaded_at) {
        // Eccezione: se è stato QUESTO token a caricarla, segnalo che è modificabile
        // (la regola "finché resti in pagina" è gestita lato client, qui diamo l'info)
        const own = record.used_at != null;
        return res.json({
          status: 'uploaded',
          editable: own,
          ...evidenzaCaricamento(payment),
        });
      }

      // Scadenza (oltre 72h dalla creazione del token)
      if (new Date() > new Date(record.expires_at)) {
        return res.json({ status: 'expired' });
      }

      return res.json({
        status: 'ok',
        ordine: {
          numero: payment.numero_ricevuta || `#${payment.id}`,
          importo: formatImporto(payment.importo),
          intestatario: payment.intestatario || '',
        },
      });
    } catch (err) {
      console.error('Errore getStatus ricevuta:', err);
      return res.status(500).json({ error: 'Errore lettura stato' });
    }
  },

  // --- PUBBLICA: caricamento ricevuta (primo upload) ---
  // POST /api/public/ricevuta/:token  (multipart: campo "ricevuta")
  upload: async (req, res) => {
    return doUpload(req, res, { allowReplace: false });
  },

  // --- PUBBLICA: re-upload consentito solo dal token che ha caricato ---
  // PUT /api/public/ricevuta/:token  (multipart: campo "ricevuta")
  reupload: async (req, res) => {
    return doUpload(req, res, { allowReplace: true });
  },

  // --- AUTENTICATA: download del file da parte di operatore/admin ---
  // GET /api/:id/ricevuta-file
  downloadByPayment: async (req, res) => {
    try {
      const { id } = req.params;
      const payment = await Payment.findByPk(id);
      if (!payment || !payment.ricevuta_file_path) return res.sendStatus(404);
      // Scope: solo stessa società dell'operatore (i superuser non hanno vincolo)
      if (req.user?.role !== 'superuser' && String(payment.societa_id) !== String(req.user?.societaId)) {
        return res.sendStatus(403);
      }
      const abs = path.join('/app', payment.ricevuta_file_path);
      if (!fs.existsSync(abs)) return res.sendStatus(404);
      return res.download(abs, payment.ricevuta_file_nome || path.basename(abs));
    } catch (err) {
      console.error('Errore download ricevuta (auth):', err);
      return res.sendStatus(500);
    }
  },

  // --- PUBBLICA: download/anteprima del file caricato ---
  // GET /api/public/ricevuta/:token/file
  getFile: async (req, res) => {
    try {
      const { token } = req.params;
      const record = await RicevutaToken.findOne({ where: { token } });
      if (!record) return res.sendStatus(404);
      const payment = await Payment.findByPk(record.payment_id);
      if (!payment || !payment.ricevuta_file_path) return res.sendStatus(404);
      const abs = path.join('/app', payment.ricevuta_file_path);
      if (!fs.existsSync(abs)) return res.sendStatus(404);
      return res.download(abs, payment.ricevuta_file_nome || path.basename(abs));
    } catch (err) {
      console.error('Errore getFile ricevuta:', err);
      return res.sendStatus(500);
    }
  },
};

// Logica condivisa fra upload (POST) e reupload (PUT).
async function doUpload(req, res, { allowReplace }) {
  // Helper per rimuovere il file appena salvato in caso di errore di validazione.
  const cleanupUploaded = () => {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
  };

  try {
    const { token } = req.params;
    const record = await RicevutaToken.findOne({ where: { token } });
    if (!record) {
      cleanupUploaded();
      return res.status(404).json({ status: 'not_found', error: 'Link non valido' });
    }

    const payment = await Payment.findByPk(record.payment_id);
    if (!payment) {
      cleanupUploaded();
      return res.status(404).json({ status: 'not_found', error: 'Ordine non trovato' });
    }

    const alreadyUploaded = payment.ricevuta_uploaded_at != null;

    if (!allowReplace) {
      // POST = primo caricamento: vietato se l'ordine ha già una ricevuta
      if (alreadyUploaded) {
        cleanupUploaded();
        return res.status(409).json({
          status: 'uploaded',
          error: 'Ricevuta già caricata per questo ordine',
          ...evidenzaCaricamento(payment),
        });
      }
      // E vietato se il link è scaduto
      if (new Date() > new Date(record.expires_at)) {
        cleanupUploaded();
        return res.status(410).json({ status: 'expired' });
      }
    } else {
      // PUT = modifica: consentita solo se è stato QUESTO token a caricare la ricevuta
      if (!alreadyUploaded || record.used_at == null) {
        cleanupUploaded();
        return res.status(403).json({ error: 'Modifica non consentita' });
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const relPath = path.join('uploads', 'ricevute', req.file.filename);

    // In caso di re-upload elimino il file precedente (se diverso)
    if (allowReplace && payment.ricevuta_file_path && payment.ricevuta_file_path !== relPath) {
      const oldAbs = path.join('/app', payment.ricevuta_file_path);
      fs.unlink(oldAbs, () => {});
    }

    const now = new Date();
    payment.ricevuta_file_path = relPath;
    payment.ricevuta_file_nome = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    payment.ricevuta_uploaded_at = now;
    payment.etichette = addEtichetta(payment.etichette, ETICHETTA_RICEVUTA);
    await payment.save();

    // Marca questo token come quello che ha effettuato il caricamento (per consentirne la modifica)
    record.used_at = now;
    await record.save();

    // Notifica agli amministratori della società + superuser (solo al primo
    // caricamento, non sulle sostituzioni). Non blocca la risposta.
    if (!allowReplace) {
      notifyRicevutaUploaded(payment).catch((e) =>
        console.error('Notifica ricevuta caricata fallita:', e.message)
      );
    }

    return res.json({
      status: 'uploaded',
      editable: true,
      ...evidenzaCaricamento(payment),
    });
  } catch (err) {
    console.error('Errore upload ricevuta:', err);
    cleanupUploaded();
    return res.status(500).json({ error: 'Errore durante il caricamento' });
  }
}

// Notifica al servizio users che una ricevuta è stata caricata.
// Il servizio users si occupa di risolvere i destinatari (admin società + superuser)
// e di inviare l'email. Chiamata interna protetta da secret condiviso.
async function notifyRicevutaUploaded(payment) {
  const usersUrl = process.env.USERS_SERVICE_URL || 'http://users_ms:3000';
  const secret = process.env.INTERNAL_API_SECRET || 'internal_secret_change_me';

  const body = {
    societa_id: payment.societa_id,
    ordine: {
      id: payment.id,
      numero: payment.numero_ricevuta || `#${payment.id}`,
      importo: formatImporto(payment.importo),
      intestatario: payment.intestatario || '',
      tipo_documento: payment.tipo_documento || null,
    },
    socio: {
      id: payment.socio_id || null,
      nominativo: payment.intestatario || '',
      codice_fiscale: payment.codice_fiscale || null,
    },
    ricevuta: {
      nome_file: payment.ricevuta_file_nome || '',
      uploaded_at: payment.ricevuta_uploaded_at,
    },
  };

  const res = await fetch(`${usersUrl}/api/internal/ricevuta-uploaded`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`users-service ha risposto ${res.status}`);
  }
}

module.exports = RicevutaController;
