'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SocietaAffiliazioni extends Model {
    static associate(models) {
      // Define association with Societa
      SocietaAffiliazioni.belongsTo(models.Societa, {
        foreignKey: 'societa_id',
        as: 'societa'
      });
    }
  }

  SocietaAffiliazioni.init({
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'SocietaAffiliazioni',
    tableName: 'SocietaAffiliazioni'
  });
  return SocietaAffiliazioni;
};
