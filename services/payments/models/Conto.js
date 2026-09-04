const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Conto extends Model {
    static associate(models) {
      // associations can be defined here
    }
  }
  Conto.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    descrizione: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Un conto può avere più modalità di pagamento associate (array). Colonna
    // fisica "modalita" (vedi migration 20260722000000-add-modalita-array-to-conti),
    // per non dover convertire in-place il tipo della vecchia colonna a valore
    // singolo. NB: l'attributo NON si chiama "modalita_pagamento" apposta —
    // quel nome coincide col "field" dell'attributo legacy qui sotto, e avere
    // un attributo il cui NOME coincide col FIELD di un altro fa sì che
    // Sequelize confonda le due colonne nel risultato di INSERT/RETURNING
    // (verificato empiricamente). La forma pubblica "modalita_pagamento" che
    // il resto dell'app si aspetta viene ricostruita esplicitamente nel
    // controller (vedi withModalitaFallback in ContoController.js).
    modalita: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    // Legacy: valore singolo pre-migrazione, non più scritto da codice nuovo.
    // Il controller lo usa come fallback in lettura per i conti creati prima
    // di questa modifica e il cui "modalita" non è ancora stato popolato.
    modalita_pagamento_legacy: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'modalita_pagamento'
    },
    iban: {
      type: DataTypes.STRING(34),
      allowNull: true
    },
    istruzioni_pagamento: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    predefinito: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    // Saldo di apertura del conto e data a cui si riferisce (registrati alla
    // creazione, in "Configurazione → Conti").
    saldo_iniziale: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    saldo_iniziale_data: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Conto',
    tableName: 'conti',
    timestamps: true
  });
  return Conto;
};