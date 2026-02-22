const { Societa, SocietaAffiliazioni } = require('../models');

class SocietaController {

    // Get all Societa
    async getAllSocieta(req, res) {
        try {
            const societa = await Societa.findAll({
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
            const { denominazione, codice_fiscale, partita_iva, codice_sdi, pec, email, telefono, indirizzo, comune, cap, cognome_rappr_legale, nome_rappr_legale, alias_sms, alias_email, affiliazioni } = req.body;
            
            await societa.update({
                denominazione, codice_fiscale, partita_iva, codice_sdi, pec, email, telefono, indirizzo, comune, cap, cognome_rappr_legale, nome_rappr_legale, alias_sms, alias_email
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
