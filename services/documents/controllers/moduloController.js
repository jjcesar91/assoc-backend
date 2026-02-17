const { Modulo } = require('../models');

module.exports = {
  async create(req, res) {
    try {
      const isArray = Array.isArray(req.body);
      
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
      const modulis = await Modulo.findAll();
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
  }
};
