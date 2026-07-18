'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CorsoOrario extends Model {
    static associate(models) {
      CorsoOrario.belongsTo(models.Corso, { foreignKey: 'corsoId', as: 'corso' });
    }
  }
  CorsoOrario.init({
    corsoId: {
      type: DataTypes.INTEGER,
      allowNull: false
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
    }
  }, {
    sequelize,
    modelName: 'CorsoOrario',
    tableName: 'CorsoOrari',
    timestamps: true,
    indexes: [
      { fields: ['corsoId'] },
    ],
  });
  return CorsoOrario;
};
