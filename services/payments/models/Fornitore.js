const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Fornitore extends Model {
    static associate(models) {
      // associations can be defined here
    }
  }
  Fornitore.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    denominazione: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    codice_fiscale: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    partita_iva: {
      type: DataTypes.STRING(11),
      allowNull: true,
    },
    codice_sdi: {
      type: DataTypes.STRING(7),
      allowNull: true,
    },
    pec: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    indirizzo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    comune: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cap: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Fornitore',
    tableName: 'fornitori',
    timestamps: true,
  });
  return Fornitore;
};
