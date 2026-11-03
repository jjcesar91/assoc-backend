'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AutomazioneInvio extends Model {
    static associate(models) {
      AutomazioneInvio.belongsTo(models.Societa, {
        foreignKey: 'societa_id',
        as: 'societa'
      });
      AutomazioneInvio.belongsTo(models.Socio, {
        foreignKey: 'socio_id',
        as: 'socio'
      });
    }
  }
  AutomazioneInvio.init({
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    // Valorizzato solo per le automazioni per-socio (certificato medico, abbonamento).
    socio_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Occorrenza specifica della scadenza: è (parte del)la chiave di
    // idempotenza che impedisce l'invio duplicato quando il controllo gira
    // più volte.
    scadenza_riferimento: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    // Distingue più promemoria dello stesso tipo/socio/scadenza (es. due
    // abbonamenti diversi con la stessa data di scadenza): per "abbonamento"
    // contiene il product_id (o l'id del pagamento come fallback).
    riferimento_extra: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Numero del promemoria per la stessa occorrenza (1 = primo invio; >1 = ripetizioni,
    // vedi AutomazioneConfig.ripeti_ogni_giorni). Parte della chiave di idempotenza.
    promemoria_n: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    destinatario: {
      type: DataTypes.STRING,
      allowNull: true
    },
    esito: {
      type: DataTypes.STRING(20),
      allowNull: false // 'INVIATO' | 'ERRORE' | 'NON_INVIATO'
    },
    dettaglio_errore: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    data_invio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'AutomazioneInvio',
    tableName: 'automazioni_invii',
    timestamps: true
  });
  return AutomazioneInvio;
};
