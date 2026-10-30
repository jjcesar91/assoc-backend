const { Model } = require('sequelize');

// Storico delle modifiche al saldo iniziale dei conti (Prima Nota e Configurazione → Conti):
// valori prima e dopo, chi l'ha fatto e da dove. Una riga per ogni modifica effettiva.
module.exports = (sequelize, DataTypes) => {
  class ContoSaldoStorico extends Model {}
  ContoSaldoStorico.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    conto_id: { type: DataTypes.INTEGER, allowNull: false },
    societa_id: { type: DataTypes.INTEGER, allowNull: false },
    saldo_precedente: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    data_precedente: { type: DataTypes.DATEONLY, allowNull: true },
    saldo_nuovo: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    data_nuova: { type: DataTypes.DATEONLY, allowNull: true },
    utente_id: { type: DataTypes.INTEGER, allowNull: true },
    utente_email: { type: DataTypes.STRING, allowNull: true },
    utente_ruolo: { type: DataTypes.STRING(20), allowNull: true },
    // 'prima_nota' | 'conti'
    origine: { type: DataTypes.STRING(20), allowNull: true },
  }, {
    sequelize,
    modelName: 'ContoSaldoStorico',
    tableName: 'conto_saldo_storico',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['conto_id'], name: 'conto_saldo_storico_conto_idx' }],
  });
  return ContoSaldoStorico;
};
