const { User } = require('../models');
const jwt = require('jsonwebtoken');
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
const getSocietaIdsForEmail = async (email, isSocio = null) => {
    if (!email) return [];
    const rows = await User.findAll({
        where: { email },
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
        const candidates = await User.findAll({ where: { email } });
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
        const gestRows = matched.filter(u => !isSocioRole(u.role));

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

        const societaIds = await getSocietaIdsForEmail(user.email, isSocioRole(user.role));
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
        const societaIds = await getSocietaIdsForEmail(user.email, isSocioRole(user.role));
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
        const societaIds = await getSocietaIdsForEmail(req.user.email, isSocio);
        if (!societaIds.includes(targetSocietaId)) {
            return res.status(403).json({ error: 'Società non consentita per questo utente' });
        }
        const target = await User.findOne({
            where: {
                email: req.user.email,
                societaId: targetSocietaId,
                role: isSocio ? 'socio' : { [Op.ne]: 'socio' },
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

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(400).json({ error: formatErrorMessage(error) });
    }
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
