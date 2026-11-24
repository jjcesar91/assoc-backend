const { Model } = require('sequelize');

// Storico delle modifiche a modalità di pagamento e conto di una ricevuta/proforma:
// valori prima e dopo, chi l'ha fatto e da dove. Una riga per ogni modifica effettiva.
// Mostrato in Dettaglio ricevuta; la stessa modifica finisce anche nello storico socio.
module.exports = (sequelize, DataTypes) => {
  class PaymentModifica extends Model {}
  PaymentModifica.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    payment_id: { type: DataTypes.INTEGER, allowNull: false },
    societa_id: { type: DataTypes.INTEGER, allowNull: false },
    modalita_precedente: { type: DataTypes.STRING, allowNull: true },
    modalita_nuova: { type: DataTypes.STRING, allowNull: true },
    conto_precedente: { type: DataTypes.STRING, allowNull: true },
    conto_nuovo: { type: DataTypes.STRING, allowNull: true },
    utente_id: { type: DataTypes.INTEGER, allowNull: true },
    utente_email: { type: DataTypes.STRING, allowNull: true },
    utente_ruolo: { type: DataTypes.STRING(20), allowNull: true },
    // 'dettaglio_ricevuta' | 'prima_nota' | 'altro'
    origine: { type: DataTypes.STRING(30), allowNull: true },
  }, {
    sequelize,
    modelName: 'PaymentModifica',
    tableName: 'payment_modifiche',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['payment_id'], name: 'payment_modifiche_payment_idx' }],
  });
  return PaymentModifica;
};
