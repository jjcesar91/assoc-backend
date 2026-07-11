const { Op } = require('sequelize');
const { Societa, SocietaAffiliazioni } = require('../models');

const getUserScope = (req) => {
    const role = req.user?.role || 'user';
    const societaId = req.user?.societaId != null ? parseInt(req.user.societaId, 10) : null;
    // Elenco delle società consentite (utente multi-società: stessa email in più società).
    const societaIds = Array.isArray(req.user?.societaIds)
        ? req.user.societaIds.map((id) => parseInt(id, 10)).filter(Number.isInteger)
        : [];
    return { role, societaId, societaIds };
};

class SocietaController {

    // Get all Societa
    async getAllSocieta(req, res) {
        try {
            const { role, societaId, societaIds } = getUserScope(req);
            let where;
            if (role === 'superuser') {
                where = undefined;                                  // tutte
            } else if (societaIds.length > 1) {
                where = { id: { [Op.in]: societaIds } };            // multi-società: la tendina
            } else if (Number.isInteger(societaId)) {
                where = { id: societaId };
            } else {
                where = { id: -1 };
            }

            const societa = await Societa.findAll({
                where,
                include: [{
                    model: SocietaAffiliazioni,
                    as: 'affiliazioni'
                }]
            });
            return res.status(200).json(societa);
        } catch (error) {
            console.error('Error fetching societa:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Get Societa by ID
    async getSocietaById(req, res) {
        try {
            const { id } = req.params;
            const requestedId = parseInt(id, 10);
            const { role, societaId, societaIds } = getUserScope(req);

            // Consentito se è la società attiva oppure una delle società consentite (multi-società).
            const allowed = requestedId === societaId || societaIds.includes(requestedId);
            if (role !== 'superuser' && Number.isInteger(societaId) && !allowed) {
                return res.status(403).json({ message: 'Forbidden' });
            }

            const societa = await Societa.findByPk(id, {
                include: [{
                    model: SocietaAffiliazioni,
                    as: 'affiliazioni'
                }]
            });
            
            if (!societa) {
                return res.status(404).json({ message: 'Societa not found' });
            }
            
            return res.status(200).json(societa);
        } catch (error) {
            console.error('Error fetching societa:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Create Societa
    async createSocieta(req, res) {
        try {
            const societaData = { ...req.body };
            // Simple validation or cleanup could happen here
            const societa = await Societa.create(societaData);

             // Create default modules for the new society
             try {
                 const defaultModules = [
                     {
                         descrizione: 'MODULO ISCRIZIONE',
                         testo: '',
                         htmlContent: '',
                         societa_id: societa.id
                     },
                     {
                         descrizione: 'INFORMATIVA PRIVACY',
                         testo: '',
                         htmlContent: '',
                         societa_id: societa.id
                     }
                 ];

                 // Use the internal docker service name and port
                 const documentsServiceUrl = process.env.DOCUMENTS_SERVICE_URL || 'http://documents_ms:3000';

                 await fetch(`${documentsServiceUrl}/api/moduli`, {
                     method: 'POST',
                     headers: {
                         'Content-Type': 'application/json',
                         'Authorization': req.headers.authorization
                     },
                     body: JSON.stringify(defaultModules)
                 });
             } catch (moduleError) {
                 // Log error but don't fail the society creation, or maybe we should?
                 // For now, just log it as the society is already created.
                 console.error('Error creating default modules:', moduleError);
             }

             // Create default CASSA account for the new society
             try {
                 const paymentsServiceUrl = process.env.PAYMENTS_SERVICE_URL || 'http://payments_ms:3000';
                 await fetch(`${paymentsServiceUrl}/api/conti`, {
                     method: 'POST',
                     headers: { 
                         'Content-Type': 'application/json',
                         'Authorization': req.headers.authorization
                     },
                     body: JSON.stringify({
                         descrizione: 'CASSA',
                         modalita_pagamento: 'Contanti',
                         societa_id: societa.id
                     })
                 });
             } catch (contoError) {
                 console.error('Error creating default CASSA account:', contoError);
             }

             // Create default APS groups if tipo_associazione is APS
             if (societaData.tipo_associazione === 'APS') {
                 try {
                     const paymentsServiceUrl = process.env.PAYMENTS_SERVICE_URL || 'http://payments_ms:3000';
                     await fetch(`${paymentsServiceUrl}/api/gruppi/init-aps`, {
                         method: 'POST',
                         headers: { 
                             'Content-Type': 'application/json',
                             'Authorization': req.headers.authorization
                         },
                         body: JSON.stringify({ societa_id: societa.id }),
                     });
                 } catch (gruppiError) {
                     console.error('Error creating default APS groups:', gruppiError);
                 }
             } else if (societaData.tipo_associazione === 'ASD') {
                 try {
                     const paymentsServiceUrl = process.env.PAYMENTS_SERVICE_URL || 'http://payments_ms:3000';
                     await fetch(`${paymentsServiceUrl}/api/gruppi/init-asd`, {
                         method: 'POST',
                         headers: { 
                             'Content-Type': 'application/json',
                             'Authorization': req.headers.authorization
                         },
                         body: JSON.stringify({ societa_id: societa.id }),
                     });
                 } catch (gruppiError) {
                     console.error('Error creating default ASD groups:', gruppiError);
                 }
             }

            return res.status(201).json(societa);
        } catch (error) {
            console.error('Error creating societa:', error);
            return res.status(500).json({ error: error.message });
        }
    }
        
    // Update Societa
    async updateSocieta(req, res) {
        let transaction;
        try {
            transaction = await Societa.sequelize.transaction();
            const { id } = req.params;
            const societa = await Societa.findByPk(id, { transaction });

            if (!societa) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Societa not found' });
            }

            // Explicitly allow the new fields update
            const {    
                denominazione, codice_fiscale, partita_iva, codice_sdi, pec, email, telefono, 
                indirizzo, comune, cap, cognome_rappr_legale, nome_rappr_legale, 
                alias_sms, alias_email, affiliazioni,
                tipo_anno_associativo, data_inizio_anno_associativo,
                footer_text, email_text, receipt_footer_text, // Added template fields
                quota_tesseramento_unico,  // Impostazione quota+tesseramento unico
                tipo_associazione,  // ASD o APS
                // Comunicazioni ordini
                com_proforma_stato, com_proforma_oggetto, com_proforma_testo, com_proforma_ccn,
                com_pagamento_stato, com_pagamento_oggetto, com_pagamento_testo, com_pagamento_ccn
            } = req.body;

            await societa.update({
                denominazione, codice_fiscale, partita_iva, codice_sdi, pec, email, telefono,
                indirizzo, comune, cap, cognome_rappr_legale, nome_rappr_legale,
                alias_sms, alias_email,
                tipo_anno_associativo, data_inizio_anno_associativo,
                footer_text, email_text, receipt_footer_text, // Added template fields
                quota_tesseramento_unico,  // Impostazione quota+tesseramento unico
                tipo_associazione,  // ASD o APS
                // Comunicazioni ordini
                com_proforma_stato, com_proforma_oggetto, com_proforma_testo, com_proforma_ccn,
                com_pagamento_stato, com_pagamento_oggetto, com_pagamento_testo, com_pagamento_ccn
            }, { transaction });

            if (affiliazioni && Array.isArray(affiliazioni)) {
                // Delete existing
                await SocietaAffiliazioni.destroy({
                    where: { societa_id: id },
                    transaction
                });

                // Add new
                if (affiliazioni.length > 0) {
                    const newAffiliazioni = affiliazioni.map(a => ({
                        societa_id: id,
                        tipo: a.tipo,
                        nome: a.nome
                    }));
                    await SocietaAffiliazioni.bulkCreate(newAffiliazioni, { transaction });
                }
            }
            
            await transaction.commit();

            // Refresh to return full object with affiliations
            const updatedSocieta = await Societa.findByPk(id, {
                include: [{ model: SocietaAffiliazioni, as: 'affiliazioni' }]
            });

            return res.status(200).json(updatedSocieta);
        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error('Error updating societa:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Upload Logo
    async uploadLogo(req, res) {
        try {
            const { id } = req.params;
            const societa = await Societa.findByPk(id);

            if (!societa) {
                return res.status(404).json({ message: 'Societa not found' });
            }

            if (!req.file) {
                 return res.status(400).json({ message: 'No file uploaded' });
            }

            const logoPath = `uploads/${req.file.filename}`;
            
            societa.logo_path = logoPath;
            await societa.save();

            return res.status(200).json({ message: 'Logo uploaded successfully', logo_path: logoPath });
        } catch (error) {
             console.error('Error uploading logo:', error);
             return res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SocietaController();
