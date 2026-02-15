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
    }
  }
  
  Socio.init({
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      unique: true // One socio profile per user
    },
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null initially for migration/seeding, but logically required
      references: {
        model: 'societa',
        key: 'id'
      }
    },
    // Anagrafica Base
    cognome: {
      type: DataTypes.STRING,
      allowNull: false
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sesso: {
      type: DataTypes.STRING(10), // M, F, etc.
      allowNull: false
    },
    data_nascita: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    luogo_nascita: {
      type: DataTypes.STRING,
      allowNull: false
    },
    codice_fiscale: {
      type: DataTypes.STRING(16),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false, // Image has *
      validate: {
        isEmail: true
      }
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: false // Image has * (assumed)
    },
    
    // Address
    indirizzo: {
      type: DataTypes.STRING,
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
    }

  }, {
    sequelize,
    modelName: 'Socio',
    tableName: 'socios'
  });
  
  return Socio;
};
