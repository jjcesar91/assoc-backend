'use strict';
const { Model } = require('sequelize');

// Collegamento molti-a-molti tra corsi e prodotti di tipo abbonamento (servizio products):
// un abbonamento può dare accesso a più corsi e un corso può essere incluso in più abbonamenti.
module.exports = (sequelize, DataTypes) => {
  class CorsoAbbonamento extends Model {
    static associate(models) {
      CorsoAbbonamento.belongsTo(models.Corso, { foreignKey: 'corsoId', as: 'corso' });
    }
  }
  CorsoAbbonamento.init({
    corsoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    abbonamentoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    societaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'CorsoAbbonamento',
    tableName: 'CorsoAbbonamenti',
    timestamps: true,
    indexes: [
      { name: 'corso_abbonamenti_corso_abbonamento_unique', unique: true, fields: ['corsoId', 'abbonamentoId'] },
      { name: 'corso_abbonamenti_abbonamento', fields: ['abbonamentoId'] },
    ],
  });
  return CorsoAbbonamento;
};
