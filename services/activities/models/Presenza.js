'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Presenza extends Model {
    static associate(models) {
      Presenza.belongsTo(models.Corso, { foreignKey: 'corsoId', as: 'corso' });
    }
  }
  Presenza.init({
    corsoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    data: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    presentiIds: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    savedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    savedByName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Presenza',
    tableName: 'CorsoPresenze',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['corsoId', 'data'] },
    ],
  });
  return Presenza;
};
