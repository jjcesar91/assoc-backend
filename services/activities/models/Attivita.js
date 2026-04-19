'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Attivita extends Model {
    static associate(models) {}
  }
  Attivita.init({
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
    modelName: 'Attivita',
    tableName: 'Attivita',
    timestamps: true,
  });
  return Attivita;
};
