const { User } = require('../models');
const jwt = require('jsonwebtoken');

const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role, socio_ref_id: user.socio_ref_id || null, societaId: user.societaId || null },
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
        const { username, email, password } = req.body;
        const user = await User.create({ username, email, password });
        const tokens = generateTokens(user);
        res.json({ user: { id: user.id, username: user.username, email: user.email }, ...tokens });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`Login attempt for: ${email}`);
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ error: 'User not found' }); // DEV: specific message
        }

        const isValid = await user.validatePassword(password);
        if (!isValid) {
            console.log('Password invalid');
            // DEV: return hash for debugging if really needed, but let's just say invalid password
            return res.status(401).json({ error: 'Invalid password' }); // DEV: specific message
        }

        const tokens = generateTokens(user);
        res.json({ user: { id: user.id, username: user.username, role: user.role }, ...tokens });
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

        const tokens = generateTokens(user);
        res.json(tokens);
    });
};

exports.me = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) return res.sendStatus(404);
        res.json(user);
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
            const exists = await User.findOne({ where: { email } });
            if (exists) return res.status(400).json({ error: 'Email already in use' });
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
                username: user.username, 
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

        user.password = newPassword; // Will be hashed by beforeUpdate hook
        await user.save();

        res.json({ message: 'Password updated successfully' });
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
        where.societaId = parseInt(societaId, 10);
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
        const { username, email, password, nome, cognome, telefono, role, societaId } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'username, email e password sono obbligatori' });
        }
        const effectiveRole = role || 'user';
        // I superuser non hanno mai societaId; tutti gli altri lo richiedono
        const effectiveSocietaId = effectiveRole === 'superuser'
            ? null
            : (societaId ? parseInt(societaId, 10) : null);
        if (effectiveRole !== 'superuser' && !effectiveSocietaId) {
            return res.status(400).json({ error: 'societaId è obbligatorio per utenti non-superuser' });
        }
        const existing = await User.findOne({ where: { username } });
        if (existing) return res.status(400).json({ error: 'Username già in uso' });
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) return res.status(400).json({ error: 'Email già in uso' });
        const user = await User.create({ username, email, password, nome, cognome, telefono, role: effectiveRole, attivo: true, societaId: effectiveSocietaId });
        const { password: _, ...safe } = user.toJSON();
        res.status(201).json(safe);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.adminUpdateUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.sendStatus(404);
        const { username, email, nome, cognome, telefono, role, password, societaId } = req.body;
        if (username && username !== user.username) {
            const dup = await User.findOne({ where: { username } });
            if (dup) return res.status(400).json({ error: 'Username già in uso' });
        }
        if (email && email !== user.email) {
            const dup = await User.findOne({ where: { email } });
            if (dup) return res.status(400).json({ error: 'Email già in uso' });
        }
        if (username !== undefined) user.username = username;
        if (email !== undefined) user.email = email;
        if (nome !== undefined) user.nome = nome;
        if (cognome !== undefined) user.cognome = cognome;
        if (telefono !== undefined) user.telefono = telefono;
        if (role !== undefined) user.role = role;
        if (societaId !== undefined) user.societaId = societaId ? parseInt(societaId, 10) : null;
        if (password) user.password = password;
        await user.save();
        const { password: _, ...safe } = user.toJSON();
        res.json(safe);
    } catch (error) {
        res.status(400).json({ error: error.message });
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
            user: { id: target.id, username: target.username, role: target.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Admin: funzionalità utente ──────────────────────────────────────────────

exports.adminGetUserFeatures = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, { attributes: ['id', 'username', 'features'] });
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
    return `${pick()}-${pick()}-${pick()}-${num}`;
}

exports.createSocioAccess = async (req, res) => {
    try {
        const { socio_ref_id, email, nome, cognome } = req.body;
        if (!socio_ref_id || !email) {
            return res.status(400).json({ error: 'socio_ref_id ed email sono obbligatori' });
        }

        // Se esiste già un utente per questo socio, restituisci i dati esistenti
        const existing = await User.findOne({ where: { socio_ref_id } });
        if (existing) {
            return res.status(200).json({
                user_id: existing.id,
                username: existing.username,
                email: existing.email,
                password_plain: null,
                already_existed: true,
            });
        }

        const plainPassword = generateRandomPassword();

        // Username formato: inizialenome.cognome (es. l.rossi)
        // Se ci sono omonimi: l.rossi1, l.rossi2, ...
        const iniziale = (nome || '').trim().charAt(0).toLowerCase();
        const cognomeClean = (cognome || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
        const baseUsername = iniziale && cognomeClean
            ? `${iniziale}.${cognomeClean}`
            : `socio_${socio_ref_id}`;

        let username = baseUsername;
        let counter = 0;
        while (await User.findOne({ where: { username } })) {
            counter += 1;
            username = `${baseUsername}${counter}`;
        }

        const user = await User.create({
            username,
            email,
            password: plainPassword,
            nome: nome || '',
            cognome: cognome || '',
            role: 'socio',
            attivo: true,
            socio_ref_id,
        });

        res.status(201).json({
            user_id: user.id,
            username: user.username,
            email: user.email,
            password_plain: plainPassword,
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteSocioAccess = async (req, res) => {
    try {
        const socio_ref_id = parseInt(req.params.socio_ref_id, 10);
        const user = await User.findOne({ where: { socio_ref_id } });
        if (!user) return res.status(404).json({ error: 'Nessun accesso trovato per questo socio' });
        await user.destroy();
        res.json({ message: 'Accesso frontend rimosso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.resetSocioPassword = async (req, res) => {
    try {
        const socio_ref_id = parseInt(req.params.socio_ref_id, 10);
        const user = await User.findOne({ where: { socio_ref_id } });
        if (!user) return res.status(404).json({ error: 'Nessun accesso trovato per questo socio' });

        const plainPassword = generateRandomPassword();
        user.password = plainPassword;
        await user.save();

        res.json({ password_plain: plainPassword });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
