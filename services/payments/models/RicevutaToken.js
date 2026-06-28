const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RicevutaToken extends Model {
    static associate(models) {
      // associations can be defined here
    }
  }
  RicevutaToken.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    payment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    societa_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Scadenza del link: momento di creazione (≈ invio comunicazione) + 72 ore
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // Valorizzato quando QUESTO token viene usato per caricare la ricevuta.
    // Lo stato "ricevuta caricata" a livello di ordine è invece su payments.ricevuta_*
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'RicevutaToken',
    tableName: 'ricevuta_tokens',
    timestamps: true,
  });
  return RicevutaToken;
};
