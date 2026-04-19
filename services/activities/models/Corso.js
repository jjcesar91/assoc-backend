'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Corso extends Model {
    static associate(models) {
      Corso.belongsTo(models.Attivita, { foreignKey: 'attivitaId', as: 'attivita' });
      Corso.belongsTo(models.Struttura, { foreignKey: 'strutturaId', as: 'struttura' });
      Corso.belongsTo(models.Area, { foreignKey: 'areaId', as: 'area' });
      Corso.belongsTo(models.Staff, { foreignKey: 'staffId', as: 'staff' });
      Corso.hasMany(models.CorsoIscrizione, { foreignKey: 'corsoId', as: 'iscrizioni' });
    }
  }
  Corso.init({
    societaId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    attivitaId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    strutturaId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    areaId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    staffId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // 0 = LUN, 1 = MAR, 2 = MER, 3 = GIO, 4 = VEN, 5 = SAB, 6 = DOM
    giorno: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    oraInizio: {
      type: DataTypes.STRING(5),
      allowNull: false
    },
    durataMinuti: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50
    },
    maxSoci: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    abbonamentoId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Corso',
    tableName: 'Corsi',
    timestamps: true,
  });
  return Corso;
};
