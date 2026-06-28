'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Societa extends Model {
    static associate(models) {
      // Societa has many Soci
      Societa.hasMany(models.Socio, {
        foreignKey: 'societa_id',
        as: 'soci'
      });
      // Societa has many Affiliazioni
      Societa.hasMany(models.SocietaAffiliazioni, {
        foreignKey: 'societa_id',
        as: 'affiliazioni'
      });
    }
  }

  Societa.init({
    denominazione: {
      type: DataTypes.STRING,
      allowNull: false
    },
    codice_fiscale: {
      type: DataTypes.STRING,
      allowNull: false
    },
    partita_iva: {
      type: DataTypes.STRING,
      allowNull: true
    },
    codice_sdi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    pec: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true
    },
    indirizzo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    comune: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cap: {
      type: DataTypes.STRING,
      allowNull: true
    },
    logo_path: {
      type: DataTypes.STRING,
      allowNull: true
    },
    footer_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    receipt_footer_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    email_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    cognome_rappr_legale: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nome_rappr_legale: {
      type: DataTypes.STRING,
      allowNull: true
    },
    alias_sms: {
      type: DataTypes.STRING,
      allowNull: true
    },
    alias_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    smtp_host: {
      type: DataTypes.STRING,
      allowNull: true
    },
    smtp_port: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    smtp_user: {
      type: DataTypes.STRING,
      allowNull: true
    },
    smtp_password: {
      type: DataTypes.STRING,
      allowNull: true
    },
    smtp_secure: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    tipo_anno_associativo: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'solare' // 'solare', 'associativo', 'personalizzato'
    },
    data_inizio_anno_associativo: {
      type: DataTypes.STRING(5), // "DD-MM"
      allowNull: true
    },
    quota_tesseramento_unico: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    tipo_associazione: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ASD'
    },
    // --- Comunicazioni ordini ---
    // Stati ammessi: 'NON_ATTIVA' | 'CHIEDI' | 'AUTOMATICA'
    com_proforma_stato: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'NON_ATTIVA'
    },
    com_proforma_oggetto: {
      type: DataTypes.STRING,
      allowNull: true
    },
    com_proforma_testo: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    com_pagamento_stato: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'NON_ATTIVA'
    },
    com_pagamento_oggetto: {
      type: DataTypes.STRING,
      allowNull: true
    },
    com_pagamento_testo: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Societa',
    tableName: 'societa'
  });
  return Societa;
};
