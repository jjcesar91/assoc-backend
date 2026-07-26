'use strict';

const { Op } = require('sequelize');
const { Societa, Socio, AutomazioneConfig, AutomazioneInvio } = require('../models');
const { TIPI, getDefinizione, resolveConfig } = require('../utils/automazioniRegistry');
const { computeOccorrenzaSocieta } = require('../utils/deadlineCalculator');
const { runAutomazioniCheck } = require('../jobs/runAutomazioni');

const getUserScope = (req) => {
  const role = req.user?.role || 'user';
  const societaId = req.user?.societaId != null ? parseInt(req.user.societaId, 10) : null;
  const societaIds = Array.isArray(req.user?.societaIds)
    ? req.user.societaIds.map((id) => parseInt(id, 10)).filter(Number.isInteger)
    : [];
  return { role, societaId, societaIds };
};

// Verifica che l'utente possa operare sulla società richiesta.
function assertSocietaConsentita(req, requestedId) {
  const { role, societaId, societaIds } = getUserScope(req);
  if (role === 'superuser') return true;
  return requestedId === societaId || societaIds.includes(requestedId);
}

class AutomazioneController {

  // GET /automazioni/config?societaId=
  async getConfig(req, res) {
    try {
      const societaId = parseInt(req.query.societaId, 10);
      if (!Number.isInteger(societaId)) {
        return res.status(400).json({ error: 'societaId obbligatorio' });
      }
      if (!assertSocietaConsentita(req, societaId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const societa = await Societa.findByPk(societaId);
      if (!societa) return res.status(404).json({ error: 'Società non trovata' });

      const savedRows = await AutomazioneConfig.findAll({ where: { societa_id: societaId } });
      const savedByTipo = new Map(savedRows.map(r => [r.tipo, r]));

      const rules = await Promise.all(TIPI.map(async (tipo) => {
        const def = getDefinizione(tipo);
        const saved = savedByTipo.get(tipo);
        const config = resolveConfig(tipo, saved, societa);

        let prossimoInvio = null;
        if (def.ambito === 'societa') {
          const occorrenza = computeOccorrenzaSocieta(tipo, config, societa);
          prossimoInvio = occorrenza?.scadenza ?? null;
        }

        const ultimoInvioRow = await AutomazioneInvio.findOne({
          where: { societa_id: societaId, tipo, esito: 'INVIATO' },
          order: [['data_invio', 'DESC']],
        });

        return {
          tipo,
          categoria: def.categoria,
          ambito: def.ambito,
          label: def.label,
          applicabile: config.applicabile,
          attiva: config.attiva,
          giorni_anticipo: config.giorni_anticipo,
          data_riferimento: config.data_riferimento,
          extra_config: config.extra_config,
          oggetto_email: config.oggetto_email,
          testo_email: config.testo_email,
          prossimo_invio: prossimoInvio,
          ultimo_invio: ultimoInvioRow?.data_invio ?? null,
          richiedeDataRiferimento: def.strategy === 'manual_date',
          richiedeExtraBiennale: def.strategy === 'biannual_calendar',
        };
      }));

      return res.status(200).json({ societaId, rules });
    } catch (error) {
      console.error('Error fetching automazioni config:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // PUT /automazioni/config  { societaId, rules: [...] }
  async updateConfig(req, res) {
    try {
      const societaId = parseInt(req.body.societaId, 10);
      if (!Number.isInteger(societaId)) {
        return res.status(400).json({ error: 'societaId obbligatorio' });
      }
      if (!assertSocietaConsentita(req, societaId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const rules = Array.isArray(req.body.rules) ? req.body.rules : [];

      for (const rule of rules) {
        if (!TIPI.includes(rule.tipo)) continue;
        const payload = {
          attiva: !!rule.attiva,
          giorni_anticipo: Number.isInteger(rule.giorni_anticipo) ? rule.giorni_anticipo : getDefinizione(rule.tipo).giorniAnticipoDefault,
          data_riferimento: rule.data_riferimento || null,
          extra_config: rule.extra_config || null,
          oggetto_email: rule.oggetto_email || null,
          testo_email: rule.testo_email || null,
        };

        const [row] = await AutomazioneConfig.findOrCreate({
          where: { societa_id: societaId, tipo: rule.tipo },
          defaults: { societa_id: societaId, tipo: rule.tipo, ...payload },
        });
        await row.update(payload);
      }

      return res.status(200).json({ message: 'Configurazione salvata' });
    } catch (error) {
      console.error('Error updating automazioni config:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /automazioni/log?societaId=&tipo=&dataDa=&dataA=
  async getLog(req, res) {
    try {
      const societaId = parseInt(req.query.societaId, 10);
      if (!Number.isInteger(societaId)) {
        return res.status(400).json({ error: 'societaId obbligatorio' });
      }
      if (!assertSocietaConsentita(req, societaId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const where = { societa_id: societaId };
      if (req.query.tipo) where.tipo = req.query.tipo;
      if (req.query.dataDa || req.query.dataA) {
        where.data_invio = {};
        if (req.query.dataDa) where.data_invio[Op.gte] = new Date(req.query.dataDa);
        if (req.query.dataA) where.data_invio[Op.lte] = new Date(`${req.query.dataA}T23:59:59`);
      }

      const rows = await AutomazioneInvio.findAll({
        where,
        include: [{ model: Socio, as: 'socio', attributes: ['id', 'nome', 'cognome'] }],
        order: [['data_invio', 'DESC']],
        limit: 500,
      });

      return res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching automazioni log:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // POST /automazioni/run  { societaId? } — esecuzione manuale (test/ops), solo admin/superuser.
  async runNow(req, res) {
    try {
      const { role } = getUserScope(req);
      if (!['admin', 'superuser'].includes(role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      let societaId = req.body?.societaId ? parseInt(req.body.societaId, 10) : null;
      if (societaId && !assertSocietaConsentita(req, societaId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (role !== 'superuser' && !societaId) {
        societaId = getUserScope(req).societaId;
      }

      const risultato = await runAutomazioniCheck({ societaId });
      return res.status(200).json(risultato);
    } catch (error) {
      console.error('Error running automazioni check:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AutomazioneController();
