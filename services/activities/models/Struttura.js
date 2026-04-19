'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Struttura extends Model {
    static associate(models) {
      Struttura.hasMany(models.Area, { foreignKey: 'strutturaId', as: 'aree' });
    }
  }
  Struttura.init({
    societaId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    descrizione: {
      type: DataTypes.STRING,
      allowNull: false
    },
    colore: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Struttura',
    tableName: 'Strutture',
    timestamps: true,
  });
  return Struttura;
};
