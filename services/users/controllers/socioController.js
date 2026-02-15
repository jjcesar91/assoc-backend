const { Socio, User, Societa } = require('../models');
const { Op } = require('sequelize');

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
}

module.exports = new SocioController();
