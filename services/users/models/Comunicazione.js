'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Comunicazione extends Model {
    static associate(models) {
      Comunicazione.belongsTo(models.Socio, {
        foreignKey: 'socio_id',
        as: 'socio'
      });
    }
  }
  Comunicazione.init({
    socio_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo: {
      type: DataTypes.ENUM('EMAIL', 'SMS'),
      allowNull: false
    },
    oggetto: {
      type: DataTypes.STRING,
      allowNull: true // SMS no oggetto
    },
    testo: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isInviato: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    mittente_email: DataTypes.STRING,
    mittente_nome: DataTypes.STRING,
    mittente_smtp_params: DataTypes.JSON,
    data_invio: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'Comunicazione',
    tableName: 'comunicazioni',
    timestamps: true
  });
  return Comunicazione;
};
