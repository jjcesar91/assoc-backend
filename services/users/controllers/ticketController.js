const { Op } = require('sequelize');
const models = require('../models');
const { getLicenzaContext, limiteError } = require('../utils/licenzaContext');
const { inviaEmail, inviaEmailAiDestinatari, appUrl } = require('../utils/emailTemplates');
const { createRateLimiter } = require('../utils/rateLimit');
const {
    STATI, CATEGORIE, PRIORITA, ETICHETTE_STATO, MAX_OGGETTO,
    parseLista, testoValido, serializza, campiStato,
} = require('../utils/ticket');

const { Ticket, TicketMessaggio, Societa, sequelize } = models;

// Assistenza (menu del gestionale) e Backoffice → Ticket.
// Il cliente vede solo i ticket della società selezionata (tra quelle consentite dal
// token) e mai le note interne; il supporto (superuser) vede tutto.

const limiteNuoviTicket = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 10 });
const limiteMessaggi = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 60 });

class HttpError extends Error {
    constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

const sendError = (res, err, contesto) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    console.error(`Errore ticket (${contesto}):`, err);
    return res.status(500).json({ error: 'Errore del servizio assistenza' });
};

// Società del cliente: deve essere tra quelle del token e avere un piano con l'assistenza
async function contestoCliente(req, societaRaw) {
    const role = req.user?.role;
    if (role === 'socio') throw new HttpError(403, 'Accesso non consentito');
    if (role === 'superuser') throw new HttpError(403, 'Il supporto gestisce i ticket da Backoffice → Ticket');
    const societaId = parseInt(societaRaw ?? req.user?.societaId, 10);
    const consentite = Array.isArray(req.user?.societaIds) ? req.user.societaIds : [];
    if (!Number.isInteger(societaId) || (societaId !== req.user?.societaId && !consentite.includes(societaId))) {
        throw new HttpError(403, 'Società non consentita');
    }
    const licenza = await getLicenzaContext(models, societaId);
    if (licenza?.limiti && licenza.limiti.assistenza === false) {
        throw new HttpError(403, `L'assistenza non è inclusa nel piano ${licenza.piano_nome}`, { code: 'LIMITE_PIANO' });
    }
    return { societaId, licenzaId: licenza?.licenza_id || null };
}

const numero = (t) => `#${t.id}`;
const linkTicket = (req, t, perParte) => `${appUrl(req.headers.origin)}${perParte === 'supporto' ? 'backoffice/ticket' : 'assistenza'}?ticket=${t.id}`;

// Avvisi email: mai bloccanti per la risposta HTTP
function avvisa(req, ticket, messaggio, verso) {
    (async () => {
        const societa = await Societa.findByPk(ticket.societa_id, { attributes: ['denominazione'] });
        const valori = {
            NUMERO_TICKET: numero(ticket),
            OGGETTO_TICKET: ticket.oggetto,
            ASSOCIAZIONE: societa?.denominazione || '',
            AUTORE: ticket.autore_email || '',
            STATO_TICKET: ETICHETTE_STATO[ticket.stato] || ticket.stato,
            MESSAGGIO: messaggio.testo,
            LINK_TICKET: linkTicket(req, ticket, verso),
        };
        if (verso === 'supporto') await inviaEmailAiDestinatari(models, 'ticket_supporto', { valori });
        else if (ticket.autore_email) await inviaEmail(models, 'ticket_risposta', { to: ticket.autore_email, valori });
    })().catch(err => console.error(`[ticket] avviso email ${numero(ticket)} non inviato:`, err.message));
}

// Conteggio per stato (per i filtri), nello stesso perimetro della lista
async function conteggi(where) {
    const righe = await Ticket.findAll({
        where,
        attributes: ['stato', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
        group: ['stato'],
        raw: true,
    });
    const out = Object.fromEntries(STATI.map(s => [s, 0]));
    righe.forEach(r => { out[r.stato] = parseInt(r.n, 10); });
    return out;
}

const MESSAGGI_INCLUDE = { model: TicketMessaggio, as: 'messaggi' };
const MESSAGGI_ORDER = [[{ model: TicketMessaggio, as: 'messaggi' }, 'createdAt', 'ASC'], [{ model: TicketMessaggio, as: 'messaggi' }, 'id', 'ASC']];

const ticketController = {
    // --- Cliente ------------------------------------------------------------

    // GET /tickets?societaId=&stato=&ordina=creazione|ultimo_messaggio&dir=asc|desc&pagina=
    async list(req, res) {
        try {
            const { societaId } = await contestoCliente(req, req.query.societaId);
            const opt = parseLista(req.query);
            const base = { societa_id: societaId };
            const where = opt.stato ? { ...base, stato: opt.stato } : base;
            const [{ rows, count }, perStato] = await Promise.all([
                Ticket.findAndCountAll({ where, order: opt.order, limit: opt.limit, offset: opt.offset }),
                conteggi(base),
            ]);
            return res.json({ items: rows.map(t => serializza(t, 'cliente')), total: count, pagina: opt.pagina, per_pagina: opt.perPagina, conteggi: perStato });
        } catch (err) { return sendError(res, err, 'lista'); }
    },

    // POST /tickets { societaId, oggetto, categoria, priorita, testo }
    async create(req, res) {
        try {
            const { societaId, licenzaId } = await contestoCliente(req, req.body?.societaId);
            const oggetto = typeof req.body?.oggetto === 'string' ? req.body.oggetto.trim() : '';
            const testo = testoValido(req.body?.testo);
            const categoria = CATEGORIE.includes(req.body?.categoria) ? req.body.categoria : 'tecnico';
            const priorita = PRIORITA.includes(req.body?.priorita) ? req.body.priorita : 'normale';
            if (!oggetto || oggetto.length > MAX_OGGETTO) throw new HttpError(400, `Indica un oggetto (massimo ${MAX_OGGETTO} caratteri)`, { field: 'oggetto' });
            if (!testo) throw new HttpError(400, 'Descrivi la richiesta (massimo 5000 caratteri)', { field: 'testo' });
            if (!limiteNuoviTicket(`u${req.user.id}`)) throw new HttpError(429, 'Hai aperto troppi ticket nell\'ultima ora: riprova più tardi');

            const adesso = new Date();
            const ticket = await sequelize.transaction(async (transaction) => {
                const t = await Ticket.create({
                    societa_id: societaId,
                    licenza_id: licenzaId,
                    oggetto,
                    categoria,
                    priorita,
                    stato: 'aperto',
                    autore_user_id: req.user.id,
                    autore_email: req.user.email,
                    ultimo_messaggio_at: adesso,
                    ultimo_messaggio_da: 'cliente',
                    letto_cliente_at: adesso,
                }, { transaction });
                await TicketMessaggio.create({
                    ticket_id: t.id, autore_tipo: 'cliente', autore_user_id: req.user.id, autore_email: req.user.email, testo,
                }, { transaction });
                return t;
            });
            avvisa(req, ticket, { testo }, 'supporto');
            const full = await Ticket.findByPk(ticket.id, { include: [MESSAGGI_INCLUDE], order: MESSAGGI_ORDER });
            return res.status(201).json(serializza(full, 'cliente'));
        } catch (err) { return sendError(res, err, 'creazione'); }
    },

    // GET /tickets/:id?societaId= — thread (segna come letto)
    async get(req, res) {
        try {
            const { societaId } = await contestoCliente(req, req.query.societaId);
            const ticket = await Ticket.findOne({ where: { id: req.params.id, societa_id: societaId }, include: [MESSAGGI_INCLUDE], order: MESSAGGI_ORDER });
            if (!ticket) throw new HttpError(404, 'Ticket non trovato');
            await ticket.update({ letto_cliente_at: new Date() }, { silent: true });
            return res.json(serializza(ticket, 'cliente'));
        } catch (err) { return sendError(res, err, 'dettaglio'); }
    },

    // POST /tickets/:id/messaggi { societaId, testo } — risposta del cliente (riapre il ticket)
    async rispondi(req, res) {
        try {
            const { societaId } = await contestoCliente(req, req.body?.societaId);
            const testo = testoValido(req.body?.testo);
            if (!testo) throw new HttpError(400, 'Scrivi un messaggio (massimo 5000 caratteri)', { field: 'testo' });
            if (!limiteMessaggi(`u${req.user.id}`)) throw new HttpError(429, 'Troppi messaggi nell\'ultima ora: riprova più tardi');

            const ticket = await sequelize.transaction(async (transaction) => {
                const t = await Ticket.findOne({ where: { id: req.params.id, societa_id: societaId }, transaction, lock: transaction.LOCK.UPDATE });
                if (!t) throw new HttpError(404, 'Ticket non trovato');
                if (t.stato === 'chiuso') throw new HttpError(409, 'Il ticket è chiuso: aprine uno nuovo se ti serve ancora aiuto');
                const adesso = new Date();
                const nuovoStato = ['in_attesa_cliente', 'risolto'].includes(t.stato) ? 'aperto' : t.stato;
                await TicketMessaggio.create({
                    ticket_id: t.id, autore_tipo: 'cliente', autore_user_id: req.user.id, autore_email: req.user.email, testo,
                    stato_impostato: nuovoStato !== t.stato ? nuovoStato : null,
                }, { transaction });
                await t.update({
                    ...(nuovoStato !== t.stato ? campiStato(nuovoStato, adesso) : {}),
                    ultimo_messaggio_at: adesso, ultimo_messaggio_da: 'cliente', letto_cliente_at: adesso,
                }, { transaction });
                return t;
            });
            avvisa(req, ticket, { testo }, 'supporto');
            const full = await Ticket.findByPk(ticket.id, { include: [MESSAGGI_INCLUDE], order: MESSAGGI_ORDER });
            return res.status(201).json(serializza(full, 'cliente'));
        } catch (err) { return sendError(res, err, 'risposta cliente'); }
    },

    // POST /tickets/:id/chiudi { societaId } — il cliente conferma che il problema è risolto
    async chiudi(req, res) {
        try {
            const { societaId } = await contestoCliente(req, req.body?.societaId);
            const ticket = await Ticket.findOne({ where: { id: req.params.id, societa_id: societaId } });
            if (!ticket) throw new HttpError(404, 'Ticket non trovato');
            if (ticket.stato !== 'chiuso') {
                await sequelize.transaction(async (transaction) => {
                    await TicketMessaggio.create({
                        ticket_id: ticket.id, autore_tipo: 'cliente', autore_user_id: req.user.id, autore_email: req.user.email,
                        testo: 'Ticket chiuso dal cliente: problema risolto.', stato_impostato: 'chiuso',
                    }, { transaction });
                    await ticket.update(campiStato('chiuso'), { transaction });
                });
            }
            const full = await Ticket.findByPk(ticket.id, { include: [MESSAGGI_INCLUDE], order: MESSAGGI_ORDER });
            return res.json(serializza(full, 'cliente'));
        } catch (err) { return sendError(res, err, 'chiusura'); }
    },

    // --- Supporto (Backoffice, solo superuser) -------------------------------

    // GET /tickets/backoffice?stato=&q=&non_letti=1&ordina=&dir=&pagina=
    async backofficeList(req, res) {
        try {
            const opt = parseLista(req.query);
            const base = {};
            const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
            if (q) {
                const like = { [Op.iLike]: `%${q.replace(/[%_\\]/g, '\\$&')}%` };
                const societa = await Societa.findAll({ where: { denominazione: like }, attributes: ['id'], limit: 500 });
                const idNumero = /^#?\d+$/.test(q) ? parseInt(q.replace('#', ''), 10) : null;
                base[Op.or] = [
                    { oggetto: like },
                    { autore_email: like },
                    ...(societa.length ? [{ societa_id: societa.map(s => s.id) }] : []),
                    ...(idNumero ? [{ id: idNumero }] : []),
                ];
            }
            const where = { ...base };
            if (opt.stato) where.stato = opt.stato;
            if (req.query.non_letti === '1') {
                where.ultimo_messaggio_da = 'cliente';
                where[Op.and] = [{ [Op.or]: [{ letto_supporto_at: null }, { letto_supporto_at: { [Op.lt]: sequelize.col('ultimo_messaggio_at') } }] }];
            }
            const [{ rows, count }, perStato] = await Promise.all([
                Ticket.findAndCountAll({
                    where, order: opt.order, limit: opt.limit, offset: opt.offset,
                    include: [{ model: Societa, as: 'societa', attributes: ['id', 'denominazione'] }],
                }),
                conteggi(base),
            ]);
            return res.json({ items: rows.map(t => serializza(t, 'supporto')), total: count, pagina: opt.pagina, per_pagina: opt.perPagina, conteggi: perStato });
        } catch (err) { return sendError(res, err, 'lista backoffice'); }
    },

    // GET /tickets/backoffice/:id — thread con note interne (segna come letto)
    async backofficeGet(req, res) {
        try {
            const ticket = await Ticket.findByPk(req.params.id, {
                include: [MESSAGGI_INCLUDE, { model: Societa, as: 'societa', attributes: ['id', 'denominazione'] }],
                order: MESSAGGI_ORDER,
            });
            if (!ticket) throw new HttpError(404, 'Ticket non trovato');
            await ticket.update({ letto_supporto_at: new Date() }, { silent: true });
            return res.json(serializza(ticket, 'supporto'));
        } catch (err) { return sendError(res, err, 'dettaglio backoffice'); }
    },

    // POST /tickets/backoffice/:id/messaggi { testo, nota_interna, stato }
    // Risposta al cliente (stato predefinito: in attesa di risposta) o nota interna.
    async backofficeRispondi(req, res) {
        try {
            const testo = testoValido(req.body?.testo);
            if (!testo) throw new HttpError(400, 'Scrivi un messaggio (massimo 5000 caratteri)', { field: 'testo' });
            const notaInterna = req.body?.nota_interna === true;
            const statoRichiesto = req.body?.stato === undefined || req.body?.stato === null || req.body?.stato === ''
                ? null : req.body.stato;
            if (statoRichiesto && !STATI.includes(statoRichiesto)) throw new HttpError(400, 'Stato non valido');

            const ticket = await sequelize.transaction(async (transaction) => {
                const t = await Ticket.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
                if (!t) throw new HttpError(404, 'Ticket non trovato');
                const adesso = new Date();
                const nuovoStato = statoRichiesto || (notaInterna ? t.stato : 'in_attesa_cliente');
                await TicketMessaggio.create({
                    ticket_id: t.id, autore_tipo: 'supporto', autore_user_id: req.user.id, autore_email: req.user.email,
                    testo, nota_interna: notaInterna,
                    stato_impostato: nuovoStato !== t.stato ? nuovoStato : null,
                }, { transaction });
                await t.update({
                    ...(nuovoStato !== t.stato ? campiStato(nuovoStato, adesso) : {}),
                    // Le note interne non contano come risposta al cliente
                    ...(notaInterna ? {} : { ultimo_messaggio_at: adesso, ultimo_messaggio_da: 'supporto' }),
                    letto_supporto_at: adesso,
                }, { transaction });
                return t;
            });
            if (!notaInterna) avvisa(req, ticket, { testo }, 'cliente');
            const full = await Ticket.findByPk(ticket.id, {
                include: [MESSAGGI_INCLUDE, { model: Societa, as: 'societa', attributes: ['id', 'denominazione'] }],
                order: MESSAGGI_ORDER,
            });
            return res.status(201).json(serializza(full, 'supporto'));
        } catch (err) { return sendError(res, err, 'risposta supporto'); }
    },

    // PATCH /tickets/backoffice/:id { stato?, priorita?, categoria? } — senza messaggio al cliente
    async backofficeAggiorna(req, res) {
        try {
            const modifiche = {};
            const { stato, priorita, categoria } = req.body || {};
            if (stato !== undefined && !STATI.includes(stato)) throw new HttpError(400, 'Stato non valido');
            if (priorita !== undefined && !PRIORITA.includes(priorita)) throw new HttpError(400, 'Priorità non valida');
            if (categoria !== undefined && !CATEGORIE.includes(categoria)) throw new HttpError(400, 'Categoria non valida');

            await sequelize.transaction(async (transaction) => {
                const t = await Ticket.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
                if (!t) throw new HttpError(404, 'Ticket non trovato');
                if (priorita !== undefined) modifiche.priorita = priorita;
                if (categoria !== undefined) modifiche.categoria = categoria;
                if (stato !== undefined && stato !== t.stato) {
                    Object.assign(modifiche, campiStato(stato));
                    // Traccia del cambio di stato nel thread (visibile solo al supporto)
                    await TicketMessaggio.create({
                        ticket_id: t.id, autore_tipo: 'supporto', autore_user_id: req.user.id, autore_email: req.user.email,
                        testo: `Stato cambiato da "${ETICHETTE_STATO[t.stato]}" a "${ETICHETTE_STATO[stato]}".`,
                        nota_interna: true, stato_impostato: stato,
                    }, { transaction });
                }
                if (Object.keys(modifiche).length) await t.update(modifiche, { transaction });
            });
            const full = await Ticket.findByPk(req.params.id, {
                include: [MESSAGGI_INCLUDE, { model: Societa, as: 'societa', attributes: ['id', 'denominazione'] }],
                order: MESSAGGI_ORDER,
            });
            return res.json(serializza(full, 'supporto'));
        } catch (err) { return sendError(res, err, 'aggiornamento backoffice'); }
    },
};

module.exports = ticketController;
