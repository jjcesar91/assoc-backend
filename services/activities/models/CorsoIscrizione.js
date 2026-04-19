'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CorsoIscrizione extends Model {
    static associate(models) {
      CorsoIscrizione.belongsTo(models.Corso, { foreignKey: 'corsoId', as: 'corso' });
    }
  }
  CorsoIscrizione.init({
    corsoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    socioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dataIscrizione: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'CorsoIscrizione',
    tableName: 'CorsoIscrizioni',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['corsoId', 'socioId'] },
    ],
  });
  return CorsoIscrizione;
};
