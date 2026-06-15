'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Socio extends Model {
    static associate(models) {
      // Socio belongs to a User
      Socio.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
      // Socio belongs to a Societa
      Socio.belongsTo(models.Societa, {
        foreignKey: 'societa_id',
        as: 'societa'
      });
      // Socio has many Iscrizioni
      Socio.hasMany(models.Iscrizione, {
        foreignKey: 'socio_id',
        as: 'iscrizioni'
      });
    }
  }
  
  Socio.init({
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
      // unique non messo qui: gestito a livello DB con indice parziale (solo valori non-null)
    },
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null initially for migration/seeding, but logically required
      references: {
        model: 'societa',
        key: 'id'
      }
    },
    // Tipo socio: 'persona_fisica' (default) o 'associazione'
    tipo_socio: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'persona_fisica'
    },

    // Campi associazione
    ragione_sociale: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    partita_iva: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    codice_sdi: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    pec: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    tipo_associazione: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    cognome_rappresentante: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    nome_rappresentante: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    // Anagrafica Base (persona fisica)
    cognome: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sesso: {
      type: DataTypes.STRING(10), // M, F, etc.
      allowNull: true
    },
    data_nascita: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    luogo_nascita: {
      type: DataTypes.STRING,
      allowNull: true
    },
    codice_fiscale: {
      type: DataTypes.STRING(16),
      allowNull: true,
      // unique composito con societa_id — definito in indexes
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Address
    indirizzo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    indirizzo_2: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    comune: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cap: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    
    // Parent/Guardian Info (Optional)
    cf_genitore: {
      type: DataTypes.STRING(16),
      allowNull: true
    },
    cognome_genitore: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nome_genitore: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Contacts
    recapito_2: {
      type: DataTypes.STRING,
      allowNull: true
    },
    recapito_3: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Membership Info
    scadenza_certificato: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    data_ammissione: { // Data di prima iscrizione come socio (libro soci)
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    livello: {
      type: DataTypes.STRING,
      allowNull: true
    },
    valutazione: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tessera_societa: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tessera_federazione: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tessera_eps: {
      type: DataTypes.STRING,
      allowNull: true
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    data_scadenza_tesseramento: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    id_badge: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Campi extra associazione (da CSV Odoo)
    anno_associativo: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    codice_affiliazione: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    scadenza_affiliazione: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    costo_affiliazione: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    costo_tessera_base: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    costo_tessera_associativa: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    costo_tessera_completa: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    durata_consiglio_direttivo: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    scadenza_consiglio_direttivo: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    etichette: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    runts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    somministrazione: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    sito_web: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    // Accesso frontend socio
    frontend_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    frontend_password_plain: {
      type: DataTypes.STRING,
      allowNull: true
    },
    frontend_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }

  }, {
    sequelize,
    modelName: 'Socio',
    tableName: 'socios',
    indexes: [
      {
        unique: true,
        fields: ['codice_fiscale', 'societa_id'],
        name: 'socios_cf_societa_unique'
      }
    ]
  });
  
  return Socio;
};
