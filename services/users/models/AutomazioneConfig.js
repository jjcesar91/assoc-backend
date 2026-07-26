'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AutomazioneConfig extends Model {
    static associate(models) {
      AutomazioneConfig.belongsTo(models.Societa, {
        foreignKey: 'societa_id',
        as: 'societa'
      });
    }
  }
  AutomazioneConfig.init({
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    attiva: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    giorni_anticipo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15
    },
    // Data di riferimento inserita manualmente (es. scadenza organo di
    // amministrazione / documento del presidente): non calcolabile da altri campi.
    data_riferimento: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    // Configurazione aggiuntiva specifica del tipo (es. le due date/anno
    // per l'automazione "attività didattiche").
    extra_config: {
      type: DataTypes.JSON,
      allowNull: true
    },
    oggetto_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    testo_email: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AutomazioneConfig',
    tableName: 'automazioni_config',
    timestamps: true
  });
  return AutomazioneConfig;
};
