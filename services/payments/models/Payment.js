const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      // associations can be defined here
    }
  }
  Payment.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    intestatario: DataTypes.STRING,
    data_pagamento: DataTypes.DATEONLY,
    importo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    numero_ricevuta: DataTypes.STRING,
    progressivo_stagione: DataTypes.INTEGER,
    data_ricevuta: DataTypes.DATEONLY,
    modalita_pagamento: DataTypes.STRING,
    conto_destinazione: DataTypes.STRING,
    codice_fiscale: DataTypes.STRING,
    codice_fiscale_genitore: DataTypes.STRING,
    partita_iva: DataTypes.STRING,
    note: DataTypes.TEXT,
    quote: DataTypes.STRING, // "Danza bimbe rata1", etc.
    quote_types: DataTypes.STRING, // comma-separated product types, e.g. "quota_associativa,generic"
    stato_pagamento: {
      type: DataTypes.STRING,
      defaultValue: '1. VALIDO CON RICEVUTA'
    },
    utente_id: DataTypes.INTEGER,
    utente_nome: DataTypes.STRING, // to store the operator name easily
    socio_id: DataTypes.INTEGER, // FK to soci table (for direct lookup)
    data_inizio_abbonamento: DataTypes.DATEONLY, // periodo abbonamento (inizio)
    data_scadenza_abbonamento: DataTypes.DATEONLY  // periodo abbonamento (scadenza)
  }, {
    sequelize,
    modelName: 'Payment',
    tableName: 'payments',
    timestamps: true
  });
  return Payment;
};
