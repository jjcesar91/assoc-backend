'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Product.init({
    societaId: {
        type: DataTypes.INTEGER,
        allowNull: true // Imposto a true temporaneamente per i dati vecchi, cambialo in false se ritieni
    },
    type: {
        type: DataTypes.ENUM('generic', 'subscription', 'quota_associativa', 'tesseramento'),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    basePrice: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    visible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    sellableOnline: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    visibleInFast: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    hasRevenueCenter: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Specific fields
    periodicity: DataTypes.STRING, // periodic_quota
    duration: DataTypes.STRING, // subscription
    unlimitedEntries: DataTypes.BOOLEAN, // subscription
    numEntries: DataTypes.INTEGER, // subscription
    season: DataTypes.STRING, // inscription, schedule
    numInstallments: DataTypes.INTEGER, // schedule
    installments: DataTypes.JSON // schedule installments array
  }, {
    sequelize,
    modelName: 'Product',
    tableName: 'Products',
    timestamps: true,
  });
  return Product;
};
