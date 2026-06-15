'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SocioContatto extends Model {
    static associate(models) {
      SocioContatto.belongsTo(models.Socio, { foreignKey: 'socio_id', as: 'socio' });
    }
  }

  SocioContatto.init({
    socio_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'socios', key: 'id' }
    },
    nome: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    posizione_lavorativa: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    telefono: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    dispositivo_mobile: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
  }, {
    sequelize,
    modelName: 'SocioContatto',
    tableName: 'socio_contatti',
  });

  return SocioContatto;
};
