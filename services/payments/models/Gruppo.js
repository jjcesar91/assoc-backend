const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Gruppo extends Model {
    static associate(models) {
      Gruppo.hasMany(models.Gruppo, { foreignKey: 'gruppo_id', as: 'sottogruppi' });
      Gruppo.belongsTo(models.Gruppo, { foreignKey: 'gruppo_id', as: 'gruppo' });
    }
  }

  Gruppo.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    descrizione: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.ENUM('Entrata', 'Uscita', 'Entrata/Uscita'),
      allowNull: false,
      defaultValue: 'Entrata',
    },
    sezione: {
      type: DataTypes.CHAR(1),
      allowNull: true,
    },
    numero: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    codice: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    gruppo_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Gruppo',
    tableName: 'gruppi',
    timestamps: true,
  });

  return Gruppo;
};
