'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Staff extends Model {
    static associate(models) {}
  }
  Staff.init({
    societaId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    cognome: {
      type: DataTypes.STRING,
      allowNull: false
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sesso: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    dataNascita: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    luogoNascita: {
      type: DataTypes.STRING,
      allowNull: false
    },
    codiceFiscale: {
      type: DataTypes.STRING(16),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true
    },
    indirizzo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    comune: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cap: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    descrizioneQualifica: {
      type: DataTypes.STRING,
      allowNull: false
    },
    attualmenteImpiegato: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    iban: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Staff',
    tableName: 'Staff',
    timestamps: true,
  });
  return Staff;
};
