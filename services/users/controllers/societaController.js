const { Societa } = require('../models');

class SocietaController {

    // Get all Societa
    async getAllSocieta(req, res) {
        try {
            const societa = await Societa.findAll();
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
            const societa = await Societa.findByPk(id);
            
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
        try {
            const { id } = req.params;
            const societa = await Societa.findByPk(id);

            if (!societa) {
                return res.status(404).json({ message: 'Societa not found' });
            }

            // Explicitly allow the new fields update
            const { denominazione, codice_fiscale, partita_iva, codice_sdi, pec, email, telefono, indirizzo, comune, cap, cognome_rappr_legale, nome_rappr_legale, alias_sms, alias_email, tipo_associazione, associazione_riferimento } = req.body;
            
            await societa.update({
                denominazione, codice_fiscale, partita_iva, codice_sdi, pec, email, telefono, indirizzo, comune, cap, cognome_rappr_legale, nome_rappr_legale, alias_sms, alias_email, tipo_associazione, associazione_riferimento
            });
            
            return res.status(200).json(societa);
        } catch (error) {
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
