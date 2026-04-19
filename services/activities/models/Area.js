'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Area extends Model {
    static associate(models) {
      Area.belongsTo(models.Struttura, { foreignKey: 'strutturaId', as: 'struttura' });
    }
  }
  Area.init({
    strutturaId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    descrizione: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Area',
    tableName: 'Aree',
    timestamps: true,
  });
  return Area;
};
