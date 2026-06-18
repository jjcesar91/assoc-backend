'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SocioStorico extends Model {
    static associate(models) {
      SocioStorico.belongsTo(models.Socio, {
        foreignKey: 'socio_id',
        as: 'socio'
      });
    }
  }

  SocioStorico.init({
    socio_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'socios', key: 'id' }
    },
    // 'ordine' | 'abbonamento' | 'iscrizione_attivita' | 'comunicazione' | 'accesso_frontend' | 'nota'
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    azione: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    dettagli: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    // 'sistema' | 'utente'
    owner_tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'sistema',
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    owner_label: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    allegato_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    allegato_nome: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    data_evento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    sequelize,
    modelName: 'SocioStorico',
    tableName: 'socio_storico',
  });

  return SocioStorico;
};
