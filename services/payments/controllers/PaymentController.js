const { Payment } = require('../models');

exports.getAll = async (req, res) => {
    try {
        const { societa_id } = req.query;
        if (!societa_id) {
            return res.status(400).json({ error: 'societa_id is required' });
        }
        const payments = await Payment.findAll({ where: { societa_id } });
        res.json(payments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
};

exports.create = async (req, res) => {
    try {
        const newPayment = await Payment.create(req.body);
        res.status(201).json(newPayment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create payment' });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Payment.update(req.body, { where: { id } });
        if (updated) {
            const updatedPayment = await Payment.findByPk(id);
            return res.json(updatedPayment);
        }
        throw new Error('Payment not found');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update payment' });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Payment.destroy({ where: { id } });
        if (deleted) {
            return res.status(204).send();
        }
        throw new Error('Payment not found');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete payment' });
    }
};
