const crypto = require('crypto');
const { Op } = require('sequelize');

// Durata del link (ore). 72h: il link viene inviato a mano via email al cliente.
const TTL_HOURS = Number(process.env.PASSWORD_RESET_TTL_HOURS) || 72;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// 32 byte casuali → 256 bit di entropia: non indovinabile per forza bruta.
const generateRawToken = () => crypto.randomBytes(32).toString('base64url');

// Password casuale conforme alla policy, mai comunicata a nessuno: l'utente
// imposta la propria tramite il link.
const generateUnusablePassword = () => `${crypto.randomBytes(24).toString('base64url')}Aa1!`;

// Crea un nuovo token per l'utente invalidando quelli precedenti non usati
// (vale sempre e solo l'ultimo link generato). Ritorna il token in chiaro.
async function createResetToken(PasswordResetToken, userId, createdBy, transaction) {
    const now = new Date();
    await PasswordResetToken.destroy({
        where: {
            [Op.or]: [
                { userId, usedAt: null },
                { expiresAt: { [Op.lt]: new Date(now.getTime() - 7 * 24 * 3600 * 1000) } }, // pulizia
            ],
        },
        transaction,
    });
    const token = generateRawToken();
    const expiresAt = new Date(now.getTime() + TTL_HOURS * 3600 * 1000);
    await PasswordResetToken.create(
        { userId, tokenHash: hashToken(token), expiresAt, createdBy: createdBy || null },
        { transaction }
    );
    return { token, expiresAt };
}

// Token valido = esiste, non usato, non scaduto. Input non plausibili scartati subito.
async function findValidToken(PasswordResetToken, token, options = {}) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 128) return null;
    return PasswordResetToken.findOne({
        where: {
            tokenHash: hashToken(token),
            usedAt: null,
            expiresAt: { [Op.gt]: new Date() },
        },
        ...options,
    });
}

module.exports = {
    TTL_HOURS,
    createResetToken,
    findValidToken,
    generateUnusablePassword,
};
