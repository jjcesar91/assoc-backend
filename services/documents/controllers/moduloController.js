const { Modulo } = require('../models');
const { getLicenzaLimiti, esente, limiteError } = require('../utils/licenzaLimiti');

module.exports = {
  async create(req, res) {
    try {
      const isArray = Array.isArray(req.body);

      // Limite di moduli per società del piano della licenza
      if (!esente(req)) {
        const nuovi = isArray ? req.body : [req.body];
        const perSocieta = {};
        nuovi.forEach(m => { perSocieta[m?.societa_id] = (perSocieta[m?.societa_id] || 0) + 1; });
        for (const [societaId, quanti] of Object.entries(perSocieta)) {
          const ctx = await getLicenzaLimiti(societaId);
          const max = ctx?.limiti?.max_moduli;
          if (max != null && (await Modulo.count({ where: { societa_id: societaId } })) + quanti > max) {
            return limiteError(res, `Il piano ${ctx.piano_nome} consente al massimo ${max} moduli. Per aggiungerne altri passa a un piano superiore.`);
          }
        }
      }
      
      if (isArray) {
        // Bulk create
        const modulis = await Modulo.bulkCreate(req.body);
        return res.status(201).json(modulis);
      } else {
        // Single create
        const modulo = await Modulo.create(req.body);
        return res.status(201).json(modulo);
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      const { societa_id } = req.query;
      const where = {};
      if (societa_id) {
        where.societa_id = societa_id;
      }
      const modulis = await Modulo.findAll({ where });
      return res.status(200).json(modulis);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const modulo = await Modulo.findByPk(id);
      if (!modulo) {
        return res.status(404).json({ error: 'Modulo not found' });
      }
      return res.status(200).json(modulo);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const [updated] = await Modulo.update(req.body, {
        where: { id: id }
      });
      if (updated) {
        const updatedModulo = await Modulo.findByPk(id);
        return res.status(200).json(updatedModulo);
      }
      return res.status(404).json({ error: 'Modulo not found' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Modulo.destroy({
        where: { id: id }
      });
      if (deleted) {
        return res.status(204).send();
      }
      return res.status(404).json({ error: 'Modulo not found' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  // Modulo "effettivo" per una società — versione PUBBLICA (nessuna autenticazione),
  // usata dalla pagina pubblica /ricevuta-telematica/:societaId.
  // Se modulo_id è passato ed appartiene alla società, lo usa; altrimenti ricade
  // sul primo modulo della società (ordinato per id) come da configurazione di default.
  async getEffettivo(req, res) {
    try {
      const { societa_id, modulo_id } = req.query;
      if (!societa_id) {
        return res.status(400).json({ error: 'societa_id obbligatorio' });
      }

      let modulo = null;
      // modulo_id arriva da una rotta pubblica: valida che sia numerico prima di
      // usarlo in query, altrimenti Sequelize solleverebbe un errore invece di
      // ricadere semplicemente sul modulo di default.
      if (modulo_id && /^\d+$/.test(String(modulo_id))) {
        modulo = await Modulo.findOne({ where: { id: modulo_id, societa_id } });
      }
      if (!modulo) {
        modulo = await Modulo.findOne({ where: { societa_id }, order: [['id', 'ASC']] });
      }

      if (!modulo) {
        return res.status(404).json({ error: 'Nessun modulo configurato per questa società' });
      }

      return res.status(200).json({
        id: modulo.id,
        descrizione: modulo.descrizione,
        testo: modulo.testo,
        htmlContent: modulo.htmlContent,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
};
