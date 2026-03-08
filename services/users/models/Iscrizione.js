'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Iscrizione extends Model {
    static associate(models) {
      // define association here
      Iscrizione.belongsTo(models.Socio, {
        foreignKey: 'socio_id',
        as: 'socio'
      });
    }
  }
  Iscrizione.init({
    socio_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    anno: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    data_iscrizione: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Iscrizione',
    tableName: 'iscrizioni',
    underscored: true,
  });
  return Iscrizione;
};