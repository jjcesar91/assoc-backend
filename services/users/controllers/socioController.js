const { Socio, User } = require('../models');

class SocioController {

    // Create a new Socio
    async createSocio(req, res) {
        try {
            // Note: In a real scenario, you probably want to create a User first or link it here.
            // For now, we assume user_id might be provided or we create a socio standalone if allowed 
            // (but our model requires user_id).
            // Example: { user_id: 1, nome: 'Mario', cognome: 'Rossi', ... }
            
            // Handle optional fields: convert empty strings to null to avoid database errors
            const socioData = { ...req.body };
            Object.keys(socioData).forEach(key => {
                if (socioData[key] === '') {
                    socioData[key] = null;
                }
            });

            const socio = await Socio.create(socioData);
            return res.status(201).json(socio);
        } catch (error) {
            console.error('Error creating socio:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Get all Soci
    async getAllSoci(req, res) {
        try {
            const soci = await Socio.findAll({
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['email', 'role'] 
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
}

module.exports = new SocioController();
