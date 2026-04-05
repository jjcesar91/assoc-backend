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
    modalita_pagamento: {
      type: DataTypes.ENUM('Contanti', 'POS', 'Assegno', 'Bonifico'),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Conto',
    tableName: 'conti',
    timestamps: true
  });
  return Conto;
};