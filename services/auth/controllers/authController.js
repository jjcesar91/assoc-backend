const { User, PasswordResetToken, sequelize } = require('../models');
const jwt = require('jsonwebtoken');
const {
    createResetToken,
    findValidToken,
    generateUnusablePassword,
} = require('../utils/passwordReset');
const { filtraSocietaAttive } = require('../utils/licenze');
const { getLicenzaLimiti } = require('../utils/licenzaLimiti');

// Password per persona: la stessa email ha una riga per ogni società in cui
// lavora (gestionale). Quando la persona cambia o reimposta la password, l'hash
// viene copiato su tutte le sue righe del gestionale (mai su quelle Area Soci).
async function propagaPassword(user, options = {}) {
    if (isSocioRole(user.role)) return;
    await User.update(
        { password: user.password, ...(options.revoca ? { sessions_revoked_at: options.revoca } : {}) },
        {
            where: { [Op.and]: [emailWhere(user.email), { role: { [Op.ne]: 'socio' } }, { id: { [Op.ne]: user.id } }] },
            hooks: false, validate: false, transaction: options.transaction,
        }
    );
}

const LICENZA_MESSAGGI = {
    in_attesa: 'La registrazione è in attesa di attivazione: riceverai conferma quando la licenza sarà attiva.',
    sospesa: 'La licenza è sospesa: contatta l\'assistenza.',
    scaduta: 'La licenza è scaduta: contatta l\'assistenza per il rinnovo.',
};
const { randomUUID } = require('crypto');
const { ValidationError, Op } = require('sequelize');

const {
    MIN_PASSWORD_LENGTH,
    validatePasswordOrThrow,
} = require('../utils/passwordPolicy');

const PASSWORD_SPECIAL_CHARACTERS = '!@#$%^&*';

const formatErrorMessage = (error) => {
    if (!error) return 'Errore interno';
    if (error.name === 'PasswordValidationError' && Array.isArray(error.details) && error.details.length > 0) {
        return error.details.join('. ');
    }
    if (error instanceof ValidationError && Array.isArray(error.errors) && error.errors.length > 0) {
        return error.errors.map((entry) => entry.message).join('. ');
    }
    return error.message || 'Errore interno';
};

// Un account con role 'socio' vive nel frontend Area Soci; ogni altro ruolo
// (user/admin/staff/superuser) vive nel gestionale. La stessa email può esistere
// in entrambi i mondi: la tendina "cambia società" deve restare confinata al
// mondo della sessione corrente.
const isSocioRole = (role) => role === 'socio';

// Elenco delle società per cui una data email è registrata (una riga User per società).
// Serve a popolare la tendina "cambia società" come per il superuser.
// `isSocio`:
//   - true  → solo le righe con role 'socio' (tendina Area Soci)
//   - false → solo le righe gestionali (role !== 'socio')
//   - null  → tutte (retrocompatibilità)
// Confronto email senza distinzione di maiuscole/minuscole (lower(email) = ...).
// Niente ILIKE: "_" e "%" negli indirizzi verrebbero interpretati come jolly.
const emailWhere = (email) => sequelize.where(sequelize.fn('lower', sequelize.col('email')), String(email || '').trim().toLowerCase());

const getSocietaIdsForEmail = async (email, isSocio = null) => {
    if (!email) return [];
    const rows = await User.findAll({
        where: emailWhere(email),
        attributes: ['societaId', 'role'],
    });
    const filtered = isSocio === null
        ? rows
        : rows.filter(r => isSocioRole(r.role) === isSocio);
    return [...new Set(filtered.map(r => r.societaId).filter(id => id != null))];
};

const generateTokens = (user, societaIds = null) => {
    const ids = Array.isArray(societaIds)
        ? societaIds
        : (user.societaId != null ? [user.societaId] : []);
    const accessToken = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            socio_ref_id: user.socio_ref_id || null,
            societaId: user.societaId || null,   // società attiva
            societaIds: ids,                       // società consentite (tendina)
        },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
        { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
};

exports.register = async (req, res) => {
    try {
        const { email, password } = req.body;
        validatePasswordOrThrow(password);
        const user = await User.create({ email, password });
        const tokens = generateTokens(user);
        res.json({ user: { id: user.id, email: user.email }, ...tokens });
    } catch (error) {
        res.status(400).json({ error: formatErrorMessage(error) });
    }
};

exports.login = async (req, res) => {
    try {
        // `accessType`: 'socio' | 'gestionale' | undefined. Serve solo quando la
        // stessa email+password apre sia il gestionale sia l'Area Soci: in quel
        // caso il client deve scegliere in quale mondo entrare.
        const { email, password, accessType } = req.body;
        console.log(`Login attempt for: ${email}`);

        // La stessa email può esistere in più società (stessa persona): recuperiamo
        // tutte le righe e teniamo solo quelle attive con password valida.
        const candidates = await User.findAll({ where: emailWhere(email) });
        if (!candidates.length) {
            console.log('User not found');
            return res.status(401).json({ error: 'User not found' }); // DEV: specific message
        }

        const matched = [];
        for (const candidate of candidates) {
            if (candidate.attivo === false) continue;
            if (await candidate.validatePassword(password)) {
                matched.push(candidate);
            }
        }

        if (!matched.length) {
            console.log('Password invalid');
            return res.status(401).json({ error: 'Invalid password' }); // DEV: specific message
        }

        // Separiamo i due mondi: Area Soci (role 'socio') e gestionale (altri ruoli).
        const socioRows = matched.filter(u => isSocioRole(u.role));
        let gestRows = matched.filter(u => !isSocioRole(u.role));

        // Gestionale: solo le società con licenza attiva (i superuser non hanno società).
        if (gestRows.some(u => u.societaId != null)) {
            let esito;
            try {
                esito = await filtraSocietaAttive(gestRows.map(u => u.societaId));
            } catch (e) {
                console.error('Login: verifica licenze non disponibile', e.message);
                return res.status(503).json({ error: 'Servizio temporaneamente non disponibile, riprova tra poco.' });
            }
            const consentite = new Set(esito.consentite);
            const bloccate = Object.values(esito.bloccate);
            gestRows = gestRows.filter(u => u.societaId == null || consentite.has(u.societaId));
            if (!gestRows.length && !socioRows.length && bloccate.length) {
                const stato = bloccate.includes('sospesa') ? 'sospesa' : bloccate.includes('scaduta') ? 'scaduta' : 'in_attesa';
                return res.status(403).json({ error: LICENZA_MESSAGGI[stato], code: 'LICENZA_NON_ATTIVA', stato });
            }
        }

        // Se l'email apre entrambi i mondi e il client non ha ancora scelto,
        // restituiamo la richiesta di scelta (nessun token emesso).
        if (socioRows.length && gestRows.length && accessType !== 'socio' && accessType !== 'gestionale') {
            return res.json({ requiresRoleChoice: true });
        }

        let group;
        if (accessType === 'socio' && socioRows.length) group = socioRows;
        else if (accessType === 'gestionale' && gestRows.length) group = gestRows;
        else group = socioRows.length && !gestRows.length ? socioRows : (gestRows.length ? gestRows : matched);

        // Società consentite = quelle delle righe del mondo scelto.
        const societaIds = [...new Set(group.map(u => u.societaId).filter(id => id != null))];
        // Società attiva di default: la prima riga con società (altrimenti la prima match).
        const active = group.find(u => u.societaId != null) || group[0];

        const tokens = generateTokens(active, societaIds);
        res.json({
            user: { id: active.id, email: active.email, role: active.role, societaId: active.societaId, societaIds },
            ...tokens,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.refreshToken = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'your_refresh_secret', async (err, decoded) => {
        if (err) return res.sendStatus(403);
        
        const user = await User.findByPk(decoded.id);
        if (!user) return res.sendStatus(403);
        // Sessioni revocate (es. password reimpostata via link): il refresh token
        // emesso prima della revoca non vale più.
        if (user.sessions_revoked_at && decoded.iat * 1000 < new Date(user.sessions_revoked_at).getTime()) {
            return res.sendStatus(403);
        }

        let societaIds = await getSocietaIdsForEmail(user.email, isSocioRole(user.role));
        if (!isSocioRole(user.role)) {
            // Licenza della società attiva non più attiva: niente rinnovo, si torna al login
            const { consentite } = await filtraSocietaAttive(societaIds, { failOpen: true });
            if (user.societaId != null && !consentite.includes(user.societaId)) return res.sendStatus(403);
            societaIds = consentite;
        }
        const tokens = generateTokens(user, societaIds.length ? societaIds : null);
        res.json(tokens);
    });
};

exports.me = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) return res.sendStatus(404);
        // Espone l'elenco delle società consentite (per la tendina di cambio società),
        // confinato al mondo della sessione corrente (Area Soci vs gestionale).
        let societaIds = await getSocietaIdsForEmail(user.email, isSocioRole(user.role));
        if (!isSocioRole(user.role)) {
            societaIds = (await filtraSocietaAttive(societaIds, { failOpen: true })).consentite;
        }
        res.json({ ...user.toJSON(), societaIds });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Cambio società per un utente la cui email è registrata in più società.
// Riemette il token per la riga User della società scelta (ruolo/features corretti).
exports.switchSocieta = async (req, res) => {
    try {
        const targetSocietaId = parseInt(req.body.societaId, 10);
        if (!Number.isInteger(targetSocietaId)) {
            return res.status(400).json({ error: 'societaId non valido' });
        }
        // Restiamo nello stesso mondo (Area Soci vs gestionale) della sessione corrente.
        const isSocio = isSocioRole(req.user.role);
        let societaIds = await getSocietaIdsForEmail(req.user.email, isSocio);
        if (!isSocio) {
            const esito = await filtraSocietaAttive(societaIds, { failOpen: true });
            if (esito.bloccate[targetSocietaId]) {
                return res.status(403).json({ error: LICENZA_MESSAGGI[esito.bloccate[targetSocietaId]] || 'Licenza non attiva', code: 'LICENZA_NON_ATTIVA' });
            }
            societaIds = esito.consentite;
        }
        if (!societaIds.includes(targetSocietaId)) {
            return res.status(403).json({ error: 'Società non consentita per questo utente' });
        }
        const target = await User.findOne({
            where: {
                [Op.and]: [
                    emailWhere(req.user.email),
                    { societaId: targetSocietaId },
                    { role: isSocio ? 'socio' : { [Op.ne]: 'socio' } },
                ],
            },
        });
        if (!target) return res.status(404).json({ error: 'Utente non trovato per la società scelta' });

        const tokens = generateTokens(target, societaIds);
        res.json({
            user: { id: target.id, email: target.email, role: target.role, societaId: target.societaId, societaIds },
            ...tokens,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { nome, cognome, email, telefono } = req.body;
        const user = await User.findByPk(req.user.id);
        
        if (!user) return res.sendStatus(404);

        if (email && email !== user.email) {
            const { Op } = require('sequelize');
            // Unicità email solo all'interno della stessa società.
            const exists = await User.findOne({
                where: { email, societaId: user.societaId, id: { [Op.ne]: user.id } },
            });
            if (exists) return res.status(400).json({ error: 'Email già in uso in questa società' });
        }

        user.nome = nome || user.nome;
        user.cognome = cognome || user.cognome;
        user.email = email || user.email;
        user.telefono = telefono || user.telefono;

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                email: user.email,
                nome: user.nome,
                cognome: user.cognome,
                telefono: user.telefono
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findByPk(req.user.id);
        
        if (!user) return res.sendStatus(404);

        if (!(await user.validatePassword(oldPassword))) {
            return res.status(400).json({ error: 'Invalid old password' });
        }

        validatePasswordOrThrow(newPassword);
        user.password = newPassword; // Will be hashed by beforeUpdate hook
        await user.save();
        await propagaPassword(user); // stessa password su tutte le società della persona

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(400).json({ error: formatErrorMessage(error) });
    }
};

// ── Ingresso all'area riservata soci su WordPress ────────────────────────────
// GET /api/wp-root-token (solo role 'socio')
// Genera un JWT usa-e-getta (90s, verificato dal plugin WP "Soci Gate SSO")
// per aprire la sezione /root/ del sito senza credenziali WordPress.
exports.getWpRootAccessToken = async (req, res) => {
    if (!isSocioRole(req.user.role)) {
        return res.status(403).json({ error: 'Accesso riservato ai soci' });
    }

    const wpSecret = process.env.WP_SSO_SECRET;
    const wpBaseUrl = process.env.WP_BASE_URL;
    if (!wpSecret || !wpBaseUrl) {
        return res.status(500).json({ error: 'Integrazione WordPress non configurata' });
    }

    const token = jwt.sign(
        { scope: 'wp-root-access', jti: randomUUID() },
        wpSecret,
        { expiresIn: '90s' }
    );

    res.json({ url: `${wpBaseUrl.replace(/\/$/, '')}/root/sso?token=${token}` });
};

// ── Interno: email destinatari notifiche (solo admin della società) ──────────
// GET /api/internal/admin-emails?societaId=X&tipo=<chiave>  (protetto da secret interno)
// Riceve le notifiche SOLO l'admin della società indicata (i superuser sono esclusi).
// Il parametro `tipo` (opzionale) è la chiave del tipo di notifica: gli admin che
// hanno disattivato quel tipo nelle preferenze vengono esclusi.
exports.internalAdminEmails = async (req, res) => {
    try {
        const { societaId, tipo } = req.query;
        if (!societaId) {
            return res.status(400).json({ error: 'societaId è obbligatorio' });
        }
        const parsedSocietaId = parseInt(societaId, 10);

        const users = await User.findAll({
            where: {
                attivo: true,
                role: 'admin',
                societaId: parsedSocietaId,
            },
            attributes: ['email', 'nome', 'cognome', 'role', 'comunicazioni_preferenze'],
            order: [['id', 'ASC']],
        });

        // Escludi gli admin che hanno disattivato questo tipo di notifica.
        // Preferenze null/chiave assente ⇒ abilitato.
        const filtered = users.filter(u => {
            if (!tipo) return true;
            const prefs = u.comunicazioni_preferenze;
            return !prefs || prefs[tipo] !== false;
        });

        res.json(filtered.map(({ email, nome, cognome, role }) => ({ email, nome, cognome, role })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Admin: gestione utenti ──────────────────────────────────────────────────

exports.adminListUsers = async (req, res) => {
    try {
        const { Op } = require('sequelize');
        // Non mostrare mai i superuser nella lista
        const where = { role: { [Op.ne]: 'superuser' } };
        // Filtra sempre per la società passata dalla tendina (obbligatoria)
        const { societaId } = req.query;
        if (!societaId) {
            return res.status(400).json({ error: 'societaId è obbligatorio' });
        }
        const parsedSocietaId = parseInt(societaId, 10);

        // Recupera gli id dei soci di questa società per includere anche gli utenti
        // soci legacy creati senza societaId
        let legacySocioRefIds = [];
        try {
            const usersResp = await fetch(`http://users_ms:3000/api/soci?societa_id=${parsedSocietaId}`);
            if (usersResp.ok) {
                const soci = await usersResp.json();
                legacySocioRefIds = soci.map(s => s.id);
            }
        } catch (_) {
            // Se il users-service non è raggiungibile, ignora la lookup legacy
        }

        const orConditions = [{ societaId: parsedSocietaId }];
        if (legacySocioRefIds.length > 0) {
            orConditions.push({ role: 'socio', societaId: null, socio_ref_id: { [Op.in]: legacySocioRefIds } });
        }
        where[Op.or] = orConditions;

        const users = await User.findAll({
            where,
            attributes: { exclude: ['password'] },
            order: [['id', 'ASC']],
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.adminCreateUser = async (req, res) => {
    try {
        const { email, password, nome, cognome, telefono, role, societaId } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'email e password sono obbligatori' });
        }
        const effectiveRole = role || 'user';
        // I superuser non hanno mai societaId; tutti gli altri lo richiedono
        const effectiveSocietaId = effectiveRole === 'superuser'
            ? null
            : (societaId ? parseInt(societaId, 10) : null);
        if (effectiveRole !== 'superuser' && !effectiveSocietaId) {
            return res.status(400).json({ error: 'societaId è obbligatorio per utenti non-superuser' });
        }
        validatePasswordOrThrow(password);
        // Piano senza creazione utenti: resta solo l'amministratore della licenza
        if (req.user?.role !== 'superuser' && effectiveSocietaId) {
            const ctx = await getLicenzaLimiti(effectiveSocietaId);
            if (ctx?.limiti && ctx.limiti.creazione_utenti === false) {
                return res.status(403).json({ error: `Il piano ${ctx.piano_nome} non consente di creare altri utenti.`, code: 'LIMITE_PIANO' });
            }
        }
        // Unicità email solo all'interno della stessa società.
        const existingEmail = await User.findOne({ where: { email, societaId: effectiveSocietaId } });
        if (existingEmail) return res.status(400).json({ error: 'Email già in uso in questa società' });
        const user = await User.create({ email, password, nome, cognome, telefono, role: effectiveRole, attivo: true, societaId: effectiveSocietaId });
        const { password: _, ...safe } = user.toJSON();
        res.status(201).json(safe);
    } catch (error) {
        res.status(400).json({ error: formatErrorMessage(error) });
    }
};

exports.adminUpdateUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.sendStatus(404);
        const { Op } = require('sequelize');
        const { email, nome, cognome, telefono, role, password, societaId } = req.body;
        // La società di riferimento per il controllo unicità: quella nuova se cambiata,
        // altrimenti quella attuale dell'utente.
        const targetSocietaId = societaId !== undefined
            ? (societaId ? parseInt(societaId, 10) : null)
            : user.societaId;
        if (email && email !== user.email) {
            const dup = await User.findOne({
                where: { email, societaId: targetSocietaId, id: { [Op.ne]: user.id } },
            });
            if (dup) return res.status(400).json({ error: 'Email già in uso in questa società' });
        }
        if (email !== undefined) user.email = email;
        if (nome !== undefined) user.nome = nome;
        if (cognome !== undefined) user.cognome = cognome;
        if (telefono !== undefined) user.telefono = telefono;
        if (role !== undefined) user.role = role;
        if (societaId !== undefined) user.societaId = societaId ? parseInt(societaId, 10) : null;
        if (password) {
            validatePasswordOrThrow(password);
            user.password = password;
        }
        await user.save();
        const { password: _, ...safe } = user.toJSON();
        res.json(safe);
    } catch (error) {
        res.status(400).json({ error: formatErrorMessage(error) });
    }
};

exports.adminToggleAttivo = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.sendStatus(404);
        user.attivo = !user.attivo;
        await user.save();
        const { password: _, ...safe } = user.toJSON();
        res.json(safe);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Preferenze di comunicazione (per tipo di notifica) di un admin
exports.adminGetComunicazioni = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, { attributes: ['id', 'email', 'role', 'comunicazioni_preferenze'] });
        if (!user) return res.sendStatus(404);
        res.json({ comunicazioni: user.comunicazioni_preferenze });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.adminSetComunicazioni = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.sendStatus(404);
        if (user.role !== 'admin') {
            return res.status(400).json({ error: 'Configurabile solo per utenti Amministratore' });
        }
        // comunicazioni: null (tutte abilitate) oppure mappa { chiave_notifica: boolean }
        const { comunicazioni } = req.body;
        user.comunicazioni_preferenze = (comunicazioni && typeof comunicazioni === 'object' && !Array.isArray(comunicazioni))
            ? comunicazioni
            : null;
        await user.save();
        res.json({ comunicazioni: user.comunicazioni_preferenze });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.adminDeleteUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.sendStatus(404);
        await user.destroy();
        res.json({ message: 'Utente eliminato' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.adminImpersonate = async (req, res) => {
    try {
        // Prevent impersonating yourself
        if (parseInt(req.params.id, 10) === req.user.id) {
            return res.status(400).json({ error: 'Non puoi impersonare te stesso' });
        }
        const target = await User.findByPk(req.params.id);
        if (!target) return res.sendStatus(404);
        const { accessToken } = generateTokens(target);
        res.json({
            accessToken,
            user: { id: target.id, email: target.email, role: target.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Admin: funzionalità utente ──────────────────────────────────────────────

exports.adminGetUserFeatures = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, { attributes: ['id', 'email', 'features'] });
        if (!user) return res.sendStatus(404);
        res.json({ features: user.features });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.adminSetUserFeatures = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.sendStatus(404);
        // features: null (tutto abilitato) oppure array di id voci menu
        const { features } = req.body;
        user.features = Array.isArray(features) ? features : null;
        await user.save();
        res.json({ features: user.features });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Accesso frontend soci ───────────────────────────────────────────────────

const PASSPHRASE_WORDS = [
    'apple','bridge','cabin','daisy','eagle','fence','globe','honey','island','jungle',
    'kite','lemon','mirror','needle','ocean','piano','queen','river','sunset','table',
    'umbrella','violet','window','yellow','zebra','anchor','basket','candle','desert',
    'engine','falcon','garden','harbor','iceberg','jasmine','kettle','lantern','meadow',
    'nebula','orange','parrot','quartz','rocket','silver','temple','uniform','velvet',
    'walnut','xylophone','yoga','zephyr','acorn','breeze','copper','dagger','emerald',
    'forest','granite','helmet','ivory','journal','kitten','lotus','marble','nectar',
    'onion','pepper','quill','ribbon','saddle','tower','utopia','venus','winter',
    'xenon','yarn','zigzag','alpine','blossom','crystal','dolphin','eclipse','flame',
    'glacier','hollow','impact','jaguar','knapsack','legend','mango','nomad','optic',
    'pebble','riddle','sphinx','tundra','uplift','vapor','whisper','xylem','zeal',
];

function generateRandomPassword() {
    const pick = () => PASSPHRASE_WORDS[Math.floor(Math.random() * PASSPHRASE_WORDS.length)];
    const num = Math.floor(Math.random() * 90) + 10; // 10-99
    const special = PASSWORD_SPECIAL_CHARACTERS[Math.floor(Math.random() * PASSWORD_SPECIAL_CHARACTERS.length)];
    const base = `${pick()}-${pick()}-${pick()}-${num}${special}A`;

    if (base.length >= MIN_PASSWORD_LENGTH) {
        return base;
    }

    return `${base}${pick().slice(0, MIN_PASSWORD_LENGTH - base.length)}`;
}

// Stato condiviso dell'accesso frontend per una email.
// L'accesso Area Soci è legato alla MAIL, non al singolo socio: se esiste almeno
// una riga User role='socio' con quella email, l'accesso è considerato attivo per
// tutti i soci (di qualunque società) che condividono la mail.
// GET /api/socio-access/status?email=X
exports.getSocioAccessStatus = async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: 'email è obbligatoria' });

        const rows = await User.findAll({ where: { email, role: 'socio' } });
        res.json({
            enabled: rows.length > 0,
            entries: rows.map(u => ({ user_id: u.id, societaId: u.societaId, socio_ref_id: u.socio_ref_id })),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Abilita l'accesso frontend per una mail su tutte le società indicate.
// Body:
//   email        (obbligatoria)
//   targets      [{ socio_ref_id, societaId, nome, cognome }]  — un socio per società
//   sharedPassword?  password in chiaro condivisa (se l'accesso esiste già altrove)
//   socio_ref_id / societaId / nome / cognome  — forma legacy a socio singolo
// Tutte le righe User create/aggiornate condividono la STESSA password, così il
// login aggrega le società in un'unica sessione con tendina di cambio società.
exports.createSocioAccess = async (req, res) => {
    try {
        const { email, sharedPassword } = req.body;
        let targets = Array.isArray(req.body.targets) ? req.body.targets : null;
        if (!targets) {
            // Forma legacy a socio singolo
            const { socio_ref_id, societaId, nome, cognome } = req.body;
            targets = socio_ref_id ? [{ socio_ref_id, societaId, nome, cognome }] : [];
        }
        targets = targets.filter(t => t && t.socio_ref_id);

        if (!email || !targets.length) {
            return res.status(400).json({ error: 'email e almeno un socio sono obbligatori' });
        }

        // Righe socio già esistenti per questa mail → account condiviso già attivo.
        const existingSocioUsers = await User.findAll({ where: { email, role: 'socio' } });

        // Determina la password condivisa da usare per le nuove righe:
        //  1) sharedPassword esplicita dal client (chiaro noto)
        //  2) altrimenti riusa l'hash di una riga socio esistente
        //  3) altrimenti genera una nuova password
        let plainForNew = null;   // chiaro da restituire/salvare (null se sconosciuto)
        let hashToReuse = null;
        if (sharedPassword) {
            plainForNew = sharedPassword;
        } else if (existingSocioUsers.length) {
            hashToReuse = existingSocioUsers[0].password; // già hashata
        } else {
            plainForNew = generateRandomPassword();
        }

        const entries = [];
        for (const t of targets) {
            const tSocietaId = t.societaId != null ? parseInt(t.societaId, 10) : null;
            const tRefId = parseInt(t.socio_ref_id, 10);

            // Vincolo unico (email, societaId): al più una riga per società.
            const existing = await User.findOne({ where: { email, societaId: tSocietaId } });
            if (existing) {
                if (!isSocioRole(existing.role)) {
                    // Utente gestionale con la stessa mail in questa società: non lo
                    // tocchiamo (la scelta gestionale/socio avviene al login). Segnaliamo.
                    entries.push({ socio_ref_id: tRefId, societaId: tSocietaId, user_id: existing.id, skipped: true });
                    continue;
                }
                if (existing.socio_ref_id !== tRefId) {
                    existing.socio_ref_id = tRefId;
                    await existing.save();
                }
                entries.push({ socio_ref_id: tRefId, societaId: tSocietaId, user_id: existing.id, already_existed: true });
                continue;
            }

            // Nuova riga socio. Se riusiamo un hash, creiamo con una password valida
            // temporanea e poi sovrascriviamo la colonna con l'hash condiviso.
            const created = await User.create({
                email,
                password: plainForNew || generateRandomPassword(),
                nome: t.nome || '',
                cognome: t.cognome || '',
                role: 'socio',
                attivo: true,
                socio_ref_id: tRefId,
                societaId: tSocietaId,
            });
            if (hashToReuse) {
                // Update statico → nessun hook di hashing: scrive l'hash così com'è.
                await User.update({ password: hashToReuse }, { where: { id: created.id }, hooks: false });
            }
            entries.push({ socio_ref_id: tRefId, societaId: tSocietaId, user_id: created.id });
        }

        res.status(existingSocioUsers.length ? 200 : 201).json({
            password_plain: plainForNew, // null se hash riusato senza chiaro noto
            already_existed: existingSocioUsers.length > 0,
            entries,
        });
    } catch (error) {
        res.status(400).json({ error: formatErrorMessage(error) });
    }
};

// Revoca l'accesso frontend per l'intera mail (tutte le società).
// Il socio_ref_id in path serve solo a risalire alla mail.
exports.deleteSocioAccess = async (req, res) => {
    try {
        const socio_ref_id = parseInt(req.params.socio_ref_id, 10);
        const user = await User.findOne({ where: { socio_ref_id, role: 'socio' } });
        if (!user) return res.status(404).json({ error: 'Nessun accesso trovato per questo socio' });

        const destroyed = await User.destroy({ where: { email: user.email, role: 'socio' } });
        res.json({ message: 'Accesso frontend rimosso', removed: destroyed });
    } catch (error) {
        res.status(400).json({ error: formatErrorMessage(error) });
    }
};

// Rigenera la password condivisa: viene applicata a TUTTE le righe socio della mail.
exports.resetSocioPassword = async (req, res) => {
    try {
        const socio_ref_id = parseInt(req.params.socio_ref_id, 10);
        const user = await User.findOne({ where: { socio_ref_id, role: 'socio' } });
        if (!user) return res.status(404).json({ error: 'Nessun accesso trovato per questo socio' });

        const plainPassword = generateRandomPassword();
        const rows = await User.findAll({ where: { email: user.email, role: 'socio' } });
        for (const row of rows) {
            row.password = plainPassword; // hashata dall'hook beforeUpdate
            await row.save();
        }

        res.json({ password_plain: plainPassword });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ---------------------------------------------------------------------------
// Link di impostazione/reimpostazione password (Backoffice superuser)
// Il token viaggia nel frammento dell'URL (#t=...) e qui solo nel body delle POST:
// non finisce nei log di accesso né nell'header Referer.
// ---------------------------------------------------------------------------

const INVALID_LINK_ERROR = 'Link non valido o scaduto. Chiedi un nuovo link.';

// POST /admin/users/:id/password-reset-link (superuser) → { token, expiresAt }
// Genera un nuovo link per l'utente; i link precedenti non usati smettono di valere.
exports.adminCreatePasswordResetLink = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.sendStatus(404);
        if (user.role === 'superuser') {
            return res.status(403).json({ error: 'Non è possibile generare link per un superuser' });
        }
        const { token, expiresAt } = await createResetToken(PasswordResetToken, user.id, req.user.id);
        res.status(201).json({ token, expiresAt, email: user.email });
    } catch (error) {
        console.error('adminCreatePasswordResetLink:', error);
        res.status(500).json({ error: 'Errore nella generazione del link' });
    }
};

// POST /admin/onboarding-admin (superuser) { societaId, email, nome, cognome, telefono }
// Crea l'amministratore di una nuova società senza password utilizzabile e ritorna
// il link per impostarla, in un'unica transazione.
exports.adminOnboardAdmin = async (req, res) => {
    const { societaId, licenzaId, email, nome, cognome, telefono } = req.body || {};
    const parsedSocietaId = parseInt(societaId, 10);
    const parsedLicenzaId = licenzaId ? parseInt(licenzaId, 10) : null;
    if (!parsedSocietaId || !email) {
        return res.status(400).json({ error: 'societaId ed email sono obbligatori' });
    }
    try {
        // Solo trim: il login confronta l'email così com'è salvata (come adminCreateUser).
        const normalizedEmail = String(email).trim();
        const existing = await User.findOne({ where: { email: normalizedEmail, societaId: parsedSocietaId } });
        if (existing) return res.status(400).json({ error: 'Email già in uso in questa società' });

        const result = await sequelize.transaction(async (transaction) => {
            const user = await User.create({
                email: normalizedEmail,
                password: generateUnusablePassword(),
                nome: nome || null,
                cognome: cognome || null,
                telefono: telefono || null,
                role: 'admin',
                attivo: true,
                societaId: parsedSocietaId,
                licenzaId: parsedLicenzaId,
            }, { transaction });
            const link = await createResetToken(PasswordResetToken, user.id, req.user.id, transaction);
            return { user, ...link };
        });
        const { password: _, ...safe } = result.user.toJSON();
        res.status(201).json({ user: safe, token: result.token, expiresAt: result.expiresAt });
    } catch (error) {
        res.status(400).json({ error: formatErrorMessage(error) });
    }
};

// POST /password-reset/verify { token } (pubblico) → { email, expiresAt }
exports.verifyPasswordReset = async (req, res) => {
    try {
        const record = await findValidToken(PasswordResetToken, req.body?.token);
        if (!record) return res.status(400).json({ error: INVALID_LINK_ERROR });
        const user = await User.findByPk(record.userId, { attributes: ['email', 'attivo'] });
        if (!user || user.attivo === false) return res.status(400).json({ error: INVALID_LINK_ERROR });
        res.json({ email: user.email, expiresAt: record.expiresAt });
    } catch (error) {
        console.error('verifyPasswordReset:', error);
        res.status(500).json({ error: 'Errore interno' });
    }
};

// POST /password-reset { token, password } (pubblico)
// Imposta la password, consuma il token (monouso), invalida gli altri token
// dell'utente e revoca le sessioni aperte.
exports.completePasswordReset = async (req, res) => {
    const { token, password } = req.body || {};
    try {
        validatePasswordOrThrow(password);
    } catch (error) {
        return res.status(400).json({ error: formatErrorMessage(error) });
    }
    try {
        const email = await sequelize.transaction(async (transaction) => {
            // Lock della riga: due richieste concorrenti con lo stesso token non
            // possono entrambe impostare la password.
            const record = await findValidToken(PasswordResetToken, token, { transaction, lock: transaction.LOCK.UPDATE });
            if (!record) return null;
            const user = await User.findByPk(record.userId, { transaction });
            if (!user || user.attivo === false) return null;

            const now = new Date();
            user.password = password;
            user.sessions_revoked_at = now;
            await user.save({ transaction });
            await propagaPassword(user, { transaction, revoca: now });
            record.usedAt = now;
            await record.save({ transaction });
            await PasswordResetToken.destroy({
                where: { userId: user.id, usedAt: null },
                transaction,
            });
            return user.email;
        });
        if (!email) return res.status(400).json({ error: INVALID_LINK_ERROR });
        res.json({ ok: true, email });
    } catch (error) {
        console.error('completePasswordReset:', error);
        res.status(400).json({ error: formatErrorMessage(error) });
    }
};

// ---------------------------------------------------------------------------
// Registrazione dal sito (chiamate interne dal servizio users)
// ---------------------------------------------------------------------------

// Una persona può registrare una sola volta la stessa email come gestionale
async function verificaRegistrazione(email, password) {
    validatePasswordOrThrow(password);
    const esistente = await User.findOne({ where: { [Op.and]: [emailWhere(email), { role: { [Op.ne]: 'socio' } }] } });
    if (esistente) {
        const e = new Error('Email già registrata: accedi con le tue credenziali o contatta l\'assistenza.');
        e.status = 400;
        throw e;
    }
}

// POST /internal/registrazione-admin/verifica { email, password }
exports.internalVerificaRegistrazione = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ error: 'Email obbligatoria' });
        await verificaRegistrazione(email, req.body?.password);
        res.json({ ok: true });
    } catch (error) {
        res.status(400).json({ error: formatErrorMessage(error) });
    }
};

// POST /internal/registrazione-admin { email, password, nome, cognome, telefono, societaId, licenzaId }
// Crea l'amministratore della licenza registrata: l'accesso resta bloccato
// (login) finché la licenza non è attiva.
exports.internalRegistrazioneAdmin = async (req, res) => {
    try {
        const { password, nome, cognome, telefono } = req.body || {};
        const email = String(req.body?.email || '').trim().toLowerCase();
        const societaId = parseInt(req.body?.societaId, 10);
        const licenzaId = parseInt(req.body?.licenzaId, 10);
        if (!email || !societaId || !licenzaId) return res.status(400).json({ error: 'Dati mancanti' });
        await verificaRegistrazione(email, password);
        const user = await User.create({
            email, password, nome: nome || null, cognome: cognome || null, telefono: telefono || null,
            role: 'admin', attivo: true, societaId, licenzaId,
        });
        res.status(201).json({ id: user.id });
    } catch (error) {
        res.status(error.status || 400).json({ error: formatErrorMessage(error) });
    }
};

// ---------------------------------------------------------------------------
// Amministratori di licenza (Backoffice, solo superuser)
// Un amministratore di licenza è una persona (email) con una riga admin, con
// licenzaId, in ogni società della licenza.
// ---------------------------------------------------------------------------

const raggruppaPerEmail = (rows) => {
    const byEmail = new Map();
    rows.forEach(u => {
        const g = byEmail.get(u.email) || { email: u.email, nome: u.nome, cognome: u.cognome, telefono: u.telefono, attivo: false, userIds: [], societaIds: [] };
        g.nome = g.nome || u.nome;
        g.cognome = g.cognome || u.cognome;
        g.telefono = g.telefono || u.telefono;
        g.attivo = g.attivo || u.attivo !== false;
        g.userIds.push(u.id);
        if (u.societaId != null) g.societaIds.push(u.societaId);
        byEmail.set(u.email, g);
    });
    return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
};

// Crea (o promuove) la riga admin della persona nella società. La nuova riga
// riceve la stessa password delle altre righe gestionale della persona; se la
// persona non ne ha, una password non utilizzabile (imposterà la sua col link).
async function assicuraRigaAdmin({ email, nome, cognome, telefono, societaId, licenzaId }, transaction) {
    const riga = await User.findOne({ where: { [Op.and]: [emailWhere(email), { societaId }] }, transaction });
    if (riga) {
        if (isSocioRole(riga.role)) {
            const e = new Error(`L'email ${email} è già usata da un socio nella società ${societaId}`);
            e.status = 400;
            throw e;
        }
        await riga.update({ role: 'admin', licenzaId }, { transaction, hooks: false, validate: false });
        return { user: riga, creata: false };
    }
    const modello = await User.findOne({ where: { [Op.and]: [emailWhere(email), { role: { [Op.ne]: 'socio' } }] }, transaction });
    const user = await User.create({
        email: modello?.email || email, password: generateUnusablePassword(), nome: nome || modello?.nome || null,
        cognome: cognome || modello?.cognome || null, telefono: telefono || modello?.telefono || null,
        role: 'admin', attivo: true, societaId, licenzaId,
    }, { transaction });
    if (modello) {
        await User.update({ password: modello.password }, { where: { id: user.id }, hooks: false, validate: false, transaction });
    }
    return { user, creata: true, nuovaPersona: !modello };
}

// GET /admin/licenze/amministratori-conteggio → { licenzaId: n }
exports.adminContaAmministratoriLicenze = async (req, res) => {
    try {
        const rows = await User.findAll({ where: { licenzaId: { [Op.ne]: null } }, attributes: ['licenzaId', 'email'] });
        const perLicenza = {};
        rows.forEach(r => { (perLicenza[r.licenzaId] = perLicenza[r.licenzaId] || new Set()).add(r.email); });
        res.json(Object.fromEntries(Object.entries(perLicenza).map(([k, v]) => [k, v.size])));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /admin/licenze/:licenzaId/amministratori
exports.adminListAmministratoriLicenza = async (req, res) => {
    try {
        const licenzaId = parseInt(req.params.licenzaId, 10);
        const rows = await User.findAll({
            where: { licenzaId },
            attributes: ['id', 'email', 'nome', 'cognome', 'telefono', 'attivo', 'societaId'],
        });
        res.json(raggruppaPerEmail(rows));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /admin/licenze/:licenzaId/amministratori { email, nome, cognome, telefono, societaIds }
// Ritorna un link per impostare la password se la persona è nuova.
exports.adminAddAmministratoreLicenza = async (req, res) => {
    try {
        const licenzaId = parseInt(req.params.licenzaId, 10);
        const email = String(req.body?.email || '').trim().toLowerCase();
        const societaIds = (Array.isArray(req.body?.societaIds) ? req.body.societaIds : [])
            .map(v => parseInt(v, 10)).filter(Number.isInteger);
        if (!licenzaId || !email || !societaIds.length) {
            return res.status(400).json({ error: 'Email e almeno una società sono obbligatorie' });
        }
        const { nome, cognome, telefono } = req.body || {};
        const result = await sequelize.transaction(async (transaction) => {
            let primo = null;
            let nuovaPersona = false;
            for (const societaId of societaIds) {
                const r = await assicuraRigaAdmin({ email, nome, cognome, telefono, societaId, licenzaId }, transaction);
                primo = primo || r.user;
                nuovaPersona = nuovaPersona || !!r.nuovaPersona;
            }
            const link = nuovaPersona ? await createResetToken(PasswordResetToken, primo.id, req.user.id, transaction) : null;
            return { userId: primo.id, link };
        });
        res.status(201).json({ email, userId: result.userId, ...(result.link || {}) });
    } catch (error) {
        res.status(error.status || 400).json({ error: formatErrorMessage(error) });
    }
};

// DELETE /admin/licenze/:licenzaId/amministratori?email=... — toglie alla persona
// l'accesso alle società della licenza. Deve restare almeno un amministratore.
exports.adminRemoveAmministratoreLicenza = async (req, res) => {
    try {
        const licenzaId = parseInt(req.params.licenzaId, 10);
        const email = String(req.query.email || '').trim();
        const rows = await User.findAll({ where: { licenzaId }, attributes: ['email'] });
        const emails = new Set(rows.map(r => r.email));
        if (!emails.has(email)) return res.sendStatus(404);
        if (emails.size <= 1) {
            return res.status(400).json({ error: 'La licenza deve avere almeno un amministratore' });
        }
        await User.destroy({ where: { licenzaId, email } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /admin/licenze/:licenzaId/provisioning { societaId } — dopo aver aggiunto una
// società alla licenza: i suoi amministratori ottengono l'accesso anche a quella.
exports.adminProvisioningSocietaLicenza = async (req, res) => {
    try {
        const licenzaId = parseInt(req.params.licenzaId, 10);
        const societaId = parseInt(req.body?.societaId, 10);
        if (!licenzaId || !societaId) return res.status(400).json({ error: 'Dati mancanti' });
        const rows = await User.findAll({ where: { licenzaId } });
        const persone = raggruppaPerEmail(rows);
        await sequelize.transaction(async (transaction) => {
            for (const p of persone) {
                await assicuraRigaAdmin({ email: p.email, nome: p.nome, cognome: p.cognome, telefono: p.telefono, societaId, licenzaId }, transaction);
            }
        });
        res.json({ amministratori: persone.length });
    } catch (error) {
        res.status(error.status || 400).json({ error: formatErrorMessage(error) });
    }
};
