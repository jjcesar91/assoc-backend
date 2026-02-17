'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Modulo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Modulo.init({
    descrizione: DataTypes.STRING,
    testo: DataTypes.TEXT,
    htmlContent: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Modulo',
    tableName: 'moduli'
  });
  return Modulo;
};
