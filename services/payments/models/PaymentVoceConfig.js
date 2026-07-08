const { Model } = require('sequelize');

// Configurazione delle "voci di pagamento" del sistema: una riga per ogni
// tipo prodotto (quote_type), che associa quel tipo a un sottogruppo del
// bilancio. Sostituisce la mappatura hardcoded quote_type → codice.
module.exports = (sequelize, DataTypes) => {
  class PaymentVoceConfig extends Model {
    static associate(models) {
      PaymentVoceConfig.belongsTo(models.Gruppo, { foreignKey: 'gruppo_id', as: 'gruppo' });
    }
  }

  PaymentVoceConfig.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Tipo prodotto: 'generic' | 'subscription' | 'quota_associativa' | 'tesseramento'
    quote_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Sottogruppo (Gruppo con gruppo_id valorizzato) a cui la voce è assegnata.
    // null = nessun sottogruppo assegnato.
    gruppo_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'PaymentVoceConfig',
    tableName: 'payment_voci_config',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['societa_id', 'quote_type'] },
    ],
  });

  return PaymentVoceConfig;
};
