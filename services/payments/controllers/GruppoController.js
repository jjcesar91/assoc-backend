const { Gruppo } = require('../models');
const { Op } = require('sequelize');

// ---------------------------------------------------------------------------
// Struttura default gruppi/sottogruppi per APS (Mod. D - Rendiconto per Cassa)
// ---------------------------------------------------------------------------
const APS_GRUPPI_RADICE = [
  { descrizione: 'Uscite da attività di interesse generale',      tipo: 'Uscita',  sezione: 'A', codice: 'AU' },
  { descrizione: 'Entrate da attività di interesse generale',     tipo: 'Entrata', sezione: 'A', codice: 'AE' },
  { descrizione: 'Uscite da attività diverse',                   tipo: 'Uscita',  sezione: 'B', codice: 'BU' },
  { descrizione: 'Entrate da attività diverse',                  tipo: 'Entrata', sezione: 'B', codice: 'BE' },
  { descrizione: 'Uscite da attività di raccolta fondi',         tipo: 'Uscita',  sezione: 'C', codice: 'CU' },
  { descrizione: 'Entrate da attività di raccolta fondi',        tipo: 'Entrata', sezione: 'C', codice: 'CE' },
  { descrizione: 'Uscite da attività finanziarie e patrimoniali',tipo: 'Uscita',  sezione: 'D', codice: 'DU' },
  { descrizione: 'Entrate da attività finanziarie e patrimoniali',tipo: 'Entrata',sezione: 'D', codice: 'DE' },
  { descrizione: 'Uscite di supporto generale',                  tipo: 'Uscita',  sezione: 'E', codice: 'EU' },
  { descrizione: 'Entrate di supporto generale',                 tipo: 'Entrata', sezione: 'E', codice: 'EE' },
];

const APS_SOTTOGRUPPI = [
  // AU
  { parentCodice: 'AU', descrizione: 'Materie prime, sussidiarie, di consumo e di merci', tipo: 'Uscita',  sezione: 'A', numero: 1,  codice: 'AU1'  },
  { parentCodice: 'AU', descrizione: 'Servizi',                                           tipo: 'Uscita',  sezione: 'A', numero: 2,  codice: 'AU2'  },
  { parentCodice: 'AU', descrizione: 'Godimento di beni di terzi',                        tipo: 'Uscita',  sezione: 'A', numero: 3,  codice: 'AU3'  },
  { parentCodice: 'AU', descrizione: 'Personale',                                         tipo: 'Uscita',  sezione: 'A', numero: 4,  codice: 'AU4'  },
  { parentCodice: 'AU', descrizione: 'Uscite diverse di gestione',                        tipo: 'Uscita',  sezione: 'A', numero: 5,  codice: 'AU5'  },
  // AE
  { parentCodice: 'AE', descrizione: 'Entrate da quote associative e apporti dei fondatori',         tipo: 'Entrata', sezione: 'A', numero: 1,  codice: 'AE1'  },
  { parentCodice: 'AE', descrizione: 'Entrate dagli associati per attività mutualistiche',           tipo: 'Entrata', sezione: 'A', numero: 2,  codice: 'AE2'  },
  { parentCodice: 'AE', descrizione: 'Entrate per prestazioni e cessioni ad associati e fondatori', tipo: 'Entrata', sezione: 'A', numero: 3,  codice: 'AE3'  },
  { parentCodice: 'AE', descrizione: 'Erogazioni liberali',                                          tipo: 'Entrata', sezione: 'A', numero: 4,  codice: 'AE4'  },
  { parentCodice: 'AE', descrizione: 'Entrate del 5 per mille',                                      tipo: 'Entrata', sezione: 'A', numero: 5,  codice: 'AE5'  },
  { parentCodice: 'AE', descrizione: 'Contributi da soggetti privati',                               tipo: 'Entrata', sezione: 'A', numero: 6,  codice: 'AE6'  },
  { parentCodice: 'AE', descrizione: 'Entrate per prestazioni e cessioni a terzi',                   tipo: 'Entrata', sezione: 'A', numero: 7,  codice: 'AE7'  },
  { parentCodice: 'AE', descrizione: 'Contributi da enti pubblici',                                  tipo: 'Entrata', sezione: 'A', numero: 8,  codice: 'AE8'  },
  { parentCodice: 'AE', descrizione: 'Entrate da contratti con enti pubblici',                       tipo: 'Entrata', sezione: 'A', numero: 9,  codice: 'AE9'  },
  { parentCodice: 'AE', descrizione: 'Altre entrate',                                                tipo: 'Entrata', sezione: 'A', numero: 10, codice: 'AE10' },
  // BU
  { parentCodice: 'BU', descrizione: 'Materie prime, sussidiarie, di consumo e di merci', tipo: 'Uscita',  sezione: 'B', numero: 1, codice: 'BU1' },
  { parentCodice: 'BU', descrizione: 'Servizi',                                           tipo: 'Uscita',  sezione: 'B', numero: 2, codice: 'BU2' },
  { parentCodice: 'BU', descrizione: 'Godimento di beni di terzi',                        tipo: 'Uscita',  sezione: 'B', numero: 3, codice: 'BU3' },
  { parentCodice: 'BU', descrizione: 'Personale',                                         tipo: 'Uscita',  sezione: 'B', numero: 4, codice: 'BU4' },
  { parentCodice: 'BU', descrizione: 'Uscite diverse di gestione',                        tipo: 'Uscita',  sezione: 'B', numero: 5, codice: 'BU5' },
  // BE
  { parentCodice: 'BE', descrizione: 'Entrate per prestazioni e cessioni ad associati e fondatori', tipo: 'Entrata', sezione: 'B', numero: 1, codice: 'BE1' },
  { parentCodice: 'BE', descrizione: 'Contributi da soggetti privati',                              tipo: 'Entrata', sezione: 'B', numero: 2, codice: 'BE2' },
  { parentCodice: 'BE', descrizione: 'Entrate per prestazioni e cessioni a terzi',                  tipo: 'Entrata', sezione: 'B', numero: 3, codice: 'BE3' },
  { parentCodice: 'BE', descrizione: 'Contributi da enti pubblici',                                 tipo: 'Entrata', sezione: 'B', numero: 4, codice: 'BE4' },
  { parentCodice: 'BE', descrizione: 'Entrate da contratti con enti pubblici',                      tipo: 'Entrata', sezione: 'B', numero: 5, codice: 'BE5' },
  { parentCodice: 'BE', descrizione: 'Altre entrate',                                               tipo: 'Entrata', sezione: 'B', numero: 6, codice: 'BE6' },
  // CU
  { parentCodice: 'CU', descrizione: 'Uscite per raccolte fondi abituali',   tipo: 'Uscita', sezione: 'C', numero: 1, codice: 'CU1' },
  { parentCodice: 'CU', descrizione: 'Uscite per raccolte fondi occasionali',tipo: 'Uscita', sezione: 'C', numero: 2, codice: 'CU2' },
  { parentCodice: 'CU', descrizione: 'Altre uscite',                         tipo: 'Uscita', sezione: 'C', numero: 3, codice: 'CU3' },
  // CE
  { parentCodice: 'CE', descrizione: 'Entrate da raccolte fondi abituali',   tipo: 'Entrata', sezione: 'C', numero: 1, codice: 'CE1' },
  { parentCodice: 'CE', descrizione: 'Entrate da raccolte fondi occasionali',tipo: 'Entrata', sezione: 'C', numero: 2, codice: 'CE2' },
  { parentCodice: 'CE', descrizione: 'Altre entrate',                         tipo: 'Entrata', sezione: 'C', numero: 3, codice: 'CE3' },
  // DU
  { parentCodice: 'DU', descrizione: 'Su rapporti bancari',           tipo: 'Uscita', sezione: 'D', numero: 1, codice: 'DU1' },
  { parentCodice: 'DU', descrizione: 'Su investimenti finanziari',    tipo: 'Uscita', sezione: 'D', numero: 2, codice: 'DU2' },
  { parentCodice: 'DU', descrizione: 'Su patrimonio edilizio',        tipo: 'Uscita', sezione: 'D', numero: 3, codice: 'DU3' },
  { parentCodice: 'DU', descrizione: 'Su altri beni patrimoniali',    tipo: 'Uscita', sezione: 'D', numero: 4, codice: 'DU4' },
  { parentCodice: 'DU', descrizione: 'Altre uscite',                  tipo: 'Uscita', sezione: 'D', numero: 5, codice: 'DU5' },
  // DE
  { parentCodice: 'DE', descrizione: 'Da rapporti bancari',            tipo: 'Entrata', sezione: 'D', numero: 1, codice: 'DE1' },
  { parentCodice: 'DE', descrizione: 'Da altri investimenti finanziari',tipo: 'Entrata', sezione: 'D', numero: 2, codice: 'DE2' },
  { parentCodice: 'DE', descrizione: 'Da patrimonio edilizio',         tipo: 'Entrata', sezione: 'D', numero: 3, codice: 'DE3' },
  { parentCodice: 'DE', descrizione: 'Da altri beni patrimoniali',     tipo: 'Entrata', sezione: 'D', numero: 4, codice: 'DE4' },
  { parentCodice: 'DE', descrizione: 'Altre entrate',                  tipo: 'Entrata', sezione: 'D', numero: 5, codice: 'DE5' },
  // EU
  { parentCodice: 'EU', descrizione: 'Materie prime, sussidiarie, di consumo e di merci', tipo: 'Uscita', sezione: 'E', numero: 1, codice: 'EU1' },
  { parentCodice: 'EU', descrizione: 'Servizi',                                           tipo: 'Uscita', sezione: 'E', numero: 2, codice: 'EU2' },
  { parentCodice: 'EU', descrizione: 'Godimento di beni di terzi',                        tipo: 'Uscita', sezione: 'E', numero: 3, codice: 'EU3' },
  { parentCodice: 'EU', descrizione: 'Personale',                                         tipo: 'Uscita', sezione: 'E', numero: 4, codice: 'EU4' },
  { parentCodice: 'EU', descrizione: 'Altre uscite',                                      tipo: 'Uscita', sezione: 'E', numero: 5, codice: 'EU5' },
  // EE
  { parentCodice: 'EE', descrizione: 'Entrate da distacco del personale',    tipo: 'Entrata', sezione: 'E', numero: 1, codice: 'EE1' },
  { parentCodice: 'EE', descrizione: 'Altre entrate di supporto generale',   tipo: 'Entrata', sezione: 'E', numero: 2, codice: 'EE2' },
];

// ---------------------------------------------------------------------------
// Struttura default gruppi/sottogruppi per ASD
// ---------------------------------------------------------------------------
const ASD_GRUPPI_RADICE = [
  { descrizione: 'Entrate attività istituzionale + attività commerciale', tipo: 'Entrata', sezione: 'A', codice: 'E' },
  { descrizione: 'Uscite attività istituzionale + attività commerciale',  tipo: 'Uscita',  sezione: 'B', codice: 'U' },
];

const ASD_SOTTOGRUPPI = [
  // E - Entrate
  { parentCodice: 'E', descrizione: 'Quote associative',                      tipo: 'Entrata', sezione: 'A', numero: 1,  codice: 'E1' },
  { parentCodice: 'E', descrizione: 'Tesseramenti',                           tipo: 'Entrata', sezione: 'A', numero: 2,  codice: 'E2' },
  { parentCodice: 'E', descrizione: 'Quote corsi/attività istituzionali',     tipo: 'Entrata', sezione: 'A', numero: 3,  codice: 'E3' },
  { parentCodice: 'E', descrizione: 'Contributi Enti pubblici',               tipo: 'Entrata', sezione: 'A', numero: 4,  codice: 'E4' },
  { parentCodice: 'E', descrizione: 'Contributi Enti privati',                tipo: 'Entrata', sezione: 'A', numero: 5,  codice: 'E5' },
  { parentCodice: 'E', descrizione: 'Donazioni/Erogazioni liberali',          tipo: 'Entrata', sezione: 'A', numero: 6,  codice: 'E6' },
  { parentCodice: 'E', descrizione: 'Interessi attivi bancari',               tipo: 'Entrata', sezione: 'A', numero: 7,  codice: 'E7' },
  { parentCodice: 'E', descrizione: 'Resi fornitori (note di credito forn.)', tipo: 'Entrata', sezione: 'A', numero: 8,  codice: 'E8' },
  { parentCodice: 'E', descrizione: 'Attività corsi commerciali (no soci)',   tipo: 'Entrata', sezione: 'A', numero: 9,  codice: 'E9' },
  { parentCodice: 'E', descrizione: 'Vendita abbigliamento/gadget',           tipo: 'Entrata', sezione: 'A', numero: 10, codice: 'E10' },
  { parentCodice: 'E', descrizione: 'Entrate bar',                            tipo: 'Entrata', sezione: 'A', numero: 11, codice: 'E11' },
  { parentCodice: 'E', descrizione: 'Entrate Sponsor',                        tipo: 'Entrata', sezione: 'A', numero: 12, codice: 'E12' },
  { parentCodice: 'E', descrizione: 'Prestito infruttifero soci',             tipo: 'Entrata', sezione: 'A', numero: 13, codice: 'E13' },
  
  // U - Uscite
  { parentCodice: 'U', descrizione: 'Affiliazioni/Tesseramenti',              tipo: 'Uscita',  sezione: 'B', numero: 1,  codice: 'U1' },
  { parentCodice: 'U', descrizione: 'Iscrizione eventi sportivi',             tipo: 'Uscita',  sezione: 'B', numero: 2,  codice: 'U2' },
  { parentCodice: 'U', descrizione: 'Formazione',                             tipo: 'Uscita',  sezione: 'B', numero: 3,  codice: 'U3' },
  { parentCodice: 'U', descrizione: 'Personale/collaboratori',                tipo: 'Uscita',  sezione: 'B', numero: 4,  codice: 'U4' },
  { parentCodice: 'U', descrizione: 'Consulenti',                             tipo: 'Uscita',  sezione: 'B', numero: 5,  codice: 'U5' },
  { parentCodice: 'U', descrizione: 'Materiali sportivi',                     tipo: 'Uscita',  sezione: 'B', numero: 6,  codice: 'U6' },
  { parentCodice: 'U', descrizione: 'Rimborsi spese',                         tipo: 'Uscita',  sezione: 'B', numero: 7,  codice: 'U7' },
  { parentCodice: 'U', descrizione: 'Spese generali',                         tipo: 'Uscita',  sezione: 'B', numero: 8,  codice: 'U8' },
  { parentCodice: 'U', descrizione: 'Spese Bancarie',                         tipo: 'Uscita',  sezione: 'B', numero: 9,  codice: 'U9' },
  { parentCodice: 'U', descrizione: 'Mutui/Finanziamenti',                    tipo: 'Uscita',  sezione: 'B', numero: 10, codice: 'U10' },
  { parentCodice: 'U', descrizione: 'Assicurazioni',                          tipo: 'Uscita',  sezione: 'B', numero: 11, codice: 'U11' },
  { parentCodice: 'U', descrizione: 'Affitti',                                tipo: 'Uscita',  sezione: 'B', numero: 12, codice: 'U12' },
  { parentCodice: 'U', descrizione: 'Utenze',                                 tipo: 'Uscita',  sezione: 'B', numero: 13, codice: 'U13' },
  { parentCodice: 'U', descrizione: 'Acquisto abbigliamento/gadget',          tipo: 'Uscita',  sezione: 'B', numero: 14, codice: 'U14' },
  { parentCodice: 'U', descrizione: 'Acquisti bar',                           tipo: 'Uscita',  sezione: 'B', numero: 15, codice: 'U15' },
  { parentCodice: 'U', descrizione: 'F24 ed altri tributi',                   tipo: 'Uscita',  sezione: 'B', numero: 16, codice: 'U16' },
  { parentCodice: 'U', descrizione: 'Donazioni/Erogazioni liberali',          tipo: 'Uscita',  sezione: 'B', numero: 17, codice: 'U17' },
  { parentCodice: 'U', descrizione: 'Restituzione prestito soci',             tipo: 'Uscita',  sezione: 'B', numero: 18, codice: 'U18' },
];

exports.getBySocieta = async (req, res) => {
    try {
        const { societa_id, solo_gruppi } = req.query;
        const where = {};
        if (societa_id) where.societa_id = societa_id;
        if (solo_gruppi === '1') where.gruppo_id = null;
        const records = await Gruppo.findAll({
            where,
            order: [
                ['codice', 'ASC'],
                ['descrizione', 'ASC'],
            ],
        });
        res.json(records);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Crea i gruppi/sottogruppi standard ASD per una società (idempotente: salta quelli già esistenti)
exports.initAsd = async (req, res) => {
    try {
        const { societa_id } = req.body;
        if (!societa_id) return res.status(400).json({ error: 'societa_id obbligatorio' });

        const created = [];

        // 1. Crea gruppi radice (se non esistono già)
        for (const g of ASD_GRUPPI_RADICE) {
            const exists = await Gruppo.findOne({ where: { societa_id, codice: g.codice } });
            if (!exists) {
                const record = await Gruppo.create({
                    societa_id,
                    descrizione: g.descrizione,
                    tipo: g.tipo,
                    sezione: g.sezione,
                    numero: null,
                    codice: g.codice,
                    gruppo_id: null,
                    is_default: true,
                });
                created.push(record);
            }
        }

        // 2. Crea sottogruppi (se non esistono già)
        for (const s of ASD_SOTTOGRUPPI) {
            const exists = await Gruppo.findOne({ where: { societa_id, codice: s.codice } });
            if (!exists) {
                const parent = await Gruppo.findOne({ where: { societa_id, codice: s.parentCodice } });
                if (!parent) continue;
                const record = await Gruppo.create({
                    societa_id,
                    descrizione: s.descrizione,
                    tipo: s.tipo,
                    sezione: s.sezione,
                    numero: s.numero,
                    codice: s.codice,
                    gruppo_id: parent.id,
                    is_default: true,
                });
                created.push(record);
            }
        }

        res.status(201).json({ created: created.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { societa_id, codice } = req.body;
        if (codice && societa_id) {
            const existing = await Gruppo.findOne({ where: { societa_id, codice } });
            if (existing) {
                return res.status(400).json({ error: `Il codice "${codice}" è già utilizzato da un altro gruppo o sottogruppo.` });
            }
        }
        const record = await Gruppo.create(req.body);
        res.status(201).json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        const { societa_id, codice } = req.body;
        if (codice && societa_id) {
            const existing = await Gruppo.findOne({
                where: { societa_id, codice, id: { [Op.ne]: id } },
            });
            if (existing) {
                return res.status(400).json({ error: `Il codice "${codice}" è già utilizzato da un altro gruppo o sottogruppo.` });
            }
        }
        const record = await Gruppo.findByPk(id);
        if (!record) return res.status(404).json({ error: 'Gruppo not found' });
            if (record.is_default) {
                return res.status(403).json({ error: 'Impossibile modificare: questo gruppo è predefinito e non può essere modificato.' });
            }
        await record.update(req.body);
        res.json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const id = req.params.id;
        const record = await Gruppo.findByPk(id);
        if (!record) return res.status(404).json({ error: 'Gruppo not found' });
        if (record.is_default) {
            return res.status(403).json({ error: 'Impossibile eliminare: questo gruppo è predefinito e non può essere rimosso.' });
        }
        const sottogruppiCount = await Gruppo.count({ where: { gruppo_id: id } });
        if (sottogruppiCount > 0) {
            return res.status(400).json({ error: 'Impossibile eliminare: il gruppo ha dei sottogruppi associati.' });
        }
        await record.destroy();
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Crea i gruppi/sottogruppi standard APS per una società (idempotente: salta quelli già esistenti)
exports.initAps = async (req, res) => {
    try {
        const { societa_id } = req.body;
        if (!societa_id) return res.status(400).json({ error: 'societa_id obbligatorio' });

        const created = [];

        // 1. Crea gruppi radice (se non esistono già)
        for (const g of APS_GRUPPI_RADICE) {
            const exists = await Gruppo.findOne({ where: { societa_id, codice: g.codice } });
            if (!exists) {
                const record = await Gruppo.create({
                    societa_id,
                    descrizione: g.descrizione,
                    tipo: g.tipo,
                    sezione: g.sezione,
                    numero: null,
                    codice: g.codice,
                    gruppo_id: null,
                    is_default: true,
                });
                created.push(record);
            }
        }

        // 2. Crea sottogruppi (se non esistono già)
        for (const s of APS_SOTTOGRUPPI) {
            const exists = await Gruppo.findOne({ where: { societa_id, codice: s.codice } });
            if (!exists) {
                const parent = await Gruppo.findOne({ where: { societa_id, codice: s.parentCodice } });
                if (!parent) continue;
                const record = await Gruppo.create({
                    societa_id,
                    descrizione: s.descrizione,
                    tipo: s.tipo,
                    sezione: s.sezione,
                    numero: s.numero,
                    codice: s.codice,
                    gruppo_id: parent.id,
                    is_default: true,
                });
                created.push(record);
            }
        }

        res.status(201).json({ created: created.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
