const { Socio, User, Societa, Comunicazione, Iscrizione } = require('../models');
const { Op } = require('sequelize');

// Helper to calculate fiscal year
function calculateAnnoContabile(date, societa) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    const day = d.getDate();

    if (societa.tipo_anno_associativo === 'solare') {
        return year;
    } else if (societa.tipo_anno_associativo === 'associativo') {
        // Begins Sept 1st.
        // If date < Sept 1st, it belongs to previous year (e.g. 2024-05-01 is 2023/2024 -> 2023)
        // If date >= Sept 1st, it starts new year (e.g. 2024-09-01 is 2024/2025 -> 2024)
        if (month < 9) return year - 1;
        return year;
    } else if (societa.tipo_anno_associativo === 'personalizzato' && societa.data_inizio_anno_associativo) {
        let cDay = 1, cMonth = 1;
        // Format assumption: 'DD-MM' or 'MM-DD'? 
        // Based on AnnoContabile.jsx: "setCustomDay(parts[0])" -> it seems 'DD-MM'
        const parts = societa.data_inizio_anno_associativo.split('-');
        if (parts.length === 2) {
             cDay = parseInt(parts[0], 10);
             cMonth = parseInt(parts[1], 10);
        }
        
        // If current date is BEFORE the start date of the 'fiscal year' in this calendar year
        // e.g. Start 01-04 (April 1st). Current 01-03 (March 1st).
        // March 1st 2024 belongs to Fiscal Year 2023 (started April 1 2023).
        
        if (month < cMonth || (month === cMonth && day < cDay)) {
            return year - 1;
        }
        return year;
    }
    return year;
}

class SocioController {

    // Create a new Communication
    async createComunicazione(req, res) {
        try {
            const socio_id = req.params.id; // From URL params
            const { tipo, oggetto, testo } = req.body;

            // Basic validation
            if (!socio_id || !tipo || !testo) {
                return res.status(400).json({ error: 'Campi obbligatori mancanti (tipo, testo)' });
            }

            // Implementazione demo
            const comunicazione = await Comunicazione.create({
                socio_id,
                tipo,
                oggetto: tipo === 'EMAIL' ? oggetto : null,
                testo,
                isInviato: false, 
                mittente_email: 'demo@example.com',
                mittente_nome: 'Utente Demo',
                mittente_smtp_params: { host: 'smtp.demo.com', port: 587 },
                data_invio: new Date()
            });

            return res.status(201).json(comunicazione);
        } catch (error) {
            console.error('Error creating comunicazione:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Get all Communications for a Socio
    async getComunicazioni(req, res) {
        try {
            const socio_id = req.params.id; // From URL params
            
            if (!socio_id) {
                return res.status(400).json({ error: 'ID socio mancante' });
            }

            const comunicazioni = await Comunicazione.findAll({
                where: { socio_id },
                order: [['createdAt', 'DESC']]
            });

            return res.status(200).json(comunicazioni);
        } catch (error) {
            console.error('Error fetching comunicazioni:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Create a new Socio
    async createSocio(req, res) {
        try {
            // Note: In a real scenario, you probably want to create a User first or link it here.
            // For now, we assume user_id might be provided or we create a socio standalone if allowed 
            // (but our model requires user_id).
            // Example: { user_id: 1, nome: 'Mario', cognome: 'Rossi', ... }
            
            const socioData = { ...req.body };

            // Check duplicate Codice Fiscale within the same Societa
            if (socioData.codice_fiscale && socioData.societa_id) {
                const existingSocio = await Socio.findOne({
                    where: { 
                        codice_fiscale: socioData.codice_fiscale,
                        societa_id: socioData.societa_id
                    }
                });

                if (existingSocio) {
                    return res.status(400).json({ 
                        error: `E' già presente un socio con il codice fiscale ${socioData.codice_fiscale} in questa società. Verificare i dati inseriti.` 
                    });
                }
            }

            // Handle optional fields: convert empty strings to null to avoid database errors
            Object.keys(socioData).forEach(key => {
                if (socioData[key] === '') {
                    socioData[key] = null;
                }
            });

            const socio = await Socio.create(socioData);
            return res.status(201).json(socio);
        } catch (error) {
            console.error('Error creating socio:', error);
            if (error.name === 'SequelizeUniqueConstraintError') {
                 return res.status(400).json({ error: 'Errore: Codice fiscale o altro campo univoco duplicato.' });
            }
            return res.status(500).json({ error: error.message });
        }
    }

    // Get all Soci
    async getAllSoci(req, res) {
        try {
            const whereClause = {};
            if (req.query.societa_id) {
                whereClause.societa_id = req.query.societa_id;
            }

            const soci = await Socio.findAll({
                where: whereClause,
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['email', 'role'] 
                }, {
                    model: Societa,
                    as: 'societa'
                }, {
                    model: Iscrizione,
                    as: 'iscrizioni'
                }]
            });
            return res.status(200).json(soci);
        } catch (error) {
            console.error('Error fetching soci:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Get Socio by ID
    async getSocioById(req, res) {
        try {
            const { id } = req.params;
            const socio = await Socio.findByPk(id, {
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['email', 'role']
                }, {
                    model: Societa,
                    as: 'societa'
                }, {
                    model: Iscrizione,
                    as: 'iscrizioni'
                }]
            });
            
            if (!socio) {
                return res.status(404).json({ message: 'Socio not found' });
            }
            
            return res.status(200).json(socio);
        } catch (error) {
            console.error('Error fetching socio:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Update Socio
    async updateSocio(req, res) {
        try {
            const { id } = req.params;

            // Handle optional fields: convert empty strings to null to avoid database errors
            // specifically for dates like scadenza_certificato or data_scadenza_tesseramento
            const updateData = { ...req.body };
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === '') {
                    updateData[key] = null;
                }
            });

            const [updated] = await Socio.update(updateData, {
                where: { id: id }
            });

            if (updated) {
                const updatedSocio = await Socio.findByPk(id);
                return res.status(200).json(updatedSocio);
            }
            
            return res.status(404).json({ message: 'Socio not found' });
        } catch (error) {
            console.error('Error updating socio:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Delete Socio
    async deleteSocio(req, res) {
        try {
            const { id } = req.params;
            const deleted = await Socio.destroy({
                where: { id: id }
            });

            if (deleted) {
                return res.status(204).send();
            }

            return res.status(404).json({ message: 'Socio not found' });
        } catch (error) {
            console.error('Error deleting socio:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Check if email exists
    async checkEmail(req, res) {
        try {
            const { email, excludeId } = req.body;
            if (!email) {
                return res.status(400).json({ message: 'Email is required' });
            }

            const whereClause = { email: email };
            if (excludeId) {
                whereClause.id = { [Op.ne]: excludeId };
            }

            // Check if email exists in Socio
            const socio = await Socio.findOne({
                where: whereClause,
                attributes: ['nome', 'cognome']
            });

            if (socio) {
                return res.status(200).json({
                    exists: true,
                    nome: socio.nome,
                    cognome: socio.cognome
                });
            }

            // Check in User as fallback
            const user = await User.findOne({
                where: { email: email },
                include: [{ model: Socio, as: 'socioProfile', attributes: ['id'] }]
            });

            if (user) {
                // If the user found is linked to the socio we are excluding, it's not a conflict
                if (excludeId && user.socioProfile && user.socioProfile.id == excludeId) {
                    return res.status(200).json({ exists: false });
                }

                return res.status(200).json({
                    exists: true,
                    nome: 'Utente',
                    cognome: 'Registrato'
                });
            }

            return res.status(200).json({ exists: false });
        } catch (error) {
            console.error('Error checking email:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Create a new Iscrizione/Renewal
    async createIscrizione(req, res) {
        try {
            const socio_id = req.params.id;
            const { data_iscrizione, tipo } = req.body;
            
            const socio = await Socio.findByPk(socio_id);
            if (!socio) return res.status(404).json({ error: 'Socio not found' });
            
            const societa = await Societa.findByPk(socio.societa_id);
            if (!societa) return res.status(404).json({ error: 'Societa not found' });
            
            // Calculate fiscal year based on date
            // Note: we can reuse this logic if needed elsewhere
            let d = new Date(data_iscrizione);
            if (isNaN(d.getTime())) {
                d = new Date(); // Use today if invalid
            }
            
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            
            let anno = year;
            
            if (societa.tipo_anno_associativo === 'associativo') {
                if (month < 9) anno = year - 1;
            } else if (societa.tipo_anno_associativo === 'personalizzato' && societa.data_inizio_anno_associativo) {
                const parts = societa.data_inizio_anno_associativo.split('-');
                if (parts.length === 2) {
                     const cDay = parseInt(parts[0], 10);
                     const cMonth = parseInt(parts[1], 10);
                     if (month < cMonth || (month === cMonth && day < cDay)) {
                         anno = year - 1;
                     }
                }
            }
            
            // Check if already exists for this year?
            let iscrizione = await Iscrizione.findOne({ where: { socio_id, anno } });
            
            if (iscrizione) {
               iscrizione.data_iscrizione = data_iscrizione;
               iscrizione.tipo = tipo || iscrizione.tipo;
               await iscrizione.save();
            } else {
               iscrizione = await Iscrizione.create({
                   socio_id,
                   anno,
                   data_iscrizione,
                   tipo
               });
            }
            
            return res.json({ iscrizione, status: 'ISCRITTO', anno });

        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: e.message });
        }
    }

    // Get Iscrizioni
    async getIscrizioni(req, res) {
         try {
            const socio_id = req.params.id;
            const iscrizioni = await Iscrizione.findAll({ where: { socio_id }, order: [['anno', 'DESC']] });
            return res.json(iscrizioni);
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: e.message });
        }
    }

    // Revoke Iscrizione
    async deleteIscrizione(req, res) {
        try {
            const socio_id = req.params.id;
            const { anno } = req.body; 

            if (!anno) {
                return res.status(400).json({ error: 'Anno mancante' });
            }

            const deleted = await Iscrizione.destroy({
                where: { socio_id, anno }
            });

            if (deleted) {
                 return res.json({ status: 'REVOCATO', anno });
            } else {
                 return res.status(404).json({ error: 'Iscrizione non trovata' });
            }
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: e.message });
        }
    }

}

module.exports = new SocioController();

