const { Op } = require('sequelize');
const { limitiPerPiano, NOMI_PIANI } = require('./piani');

// Licenza di una società con piano, limiti e società della stessa licenza.
// null se la società non esiste o non ha licenza.
async function getLicenzaContext(models, societaId) {
    const { Societa, Licenza } = models;
    const societa = await Societa.findByPk(societaId, { attributes: ['id', 'licenza_id'] });
    if (!societa?.licenza_id) return null;
    const licenza = await Licenza.findByPk(societa.licenza_id, { attributes: ['id', 'piano', 'stato'] });
    if (!licenza) return null;
    const societaIds = (await Societa.findAll({ where: { licenza_id: licenza.id }, attributes: ['id'] })).map(s => s.id);
    return {
        licenza_id: licenza.id,
        piano: licenza.piano,
        piano_nome: NOMI_PIANI[licenza.piano] || licenza.piano,
        stato: licenza.stato,
        limiti: limitiPerPiano(licenza.piano),
        societaIds,
    };
}

// Numero di soci della licenza (tutte le sue società)
async function contaSociLicenza(models, societaIds) {
    if (!societaIds?.length) return 0;
    return models.Socio.count({ where: { societa_id: { [Op.in]: societaIds } } });
}

// Errore standard di limite di piano (gestito dal frontend tramite code)
function limiteError(res, messaggio, extra = {}) {
    return res.status(403).json({ error: messaggio, code: 'LIMITE_PIANO', ...extra });
}

module.exports = { getLicenzaContext, contaSociLicenza, limiteError };
