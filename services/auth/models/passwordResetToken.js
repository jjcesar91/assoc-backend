'use strict';
const { Model } = require('sequelize');

// Token monouso per impostare/reimpostare la password tramite link.
// Del token si salva solo l'hash SHA-256: il valore in chiaro esiste solo nel
// link consegnato all'utente, quindi un dump del DB non permette di usarlo.
module.exports = (sequelize, DataTypes) => {
  class PasswordResetToken extends Model {}

  PasswordResetToken.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true   // id del superuser che ha generato il link
    }
  }, {
    sequelize,
    modelName: 'PasswordResetToken',
    tableName: 'password_reset_tokens',
    // Indici con nome esplicito: con sync({ alter: true }) un `unique: true` sulla
    // colonna verrebbe ricreato a ogni avvio.
    indexes: [
      { unique: true, fields: ['tokenHash'], name: 'password_reset_tokens_hash_unique' },
      { fields: ['userId'], name: 'password_reset_tokens_user_idx' }
    ]
  });

  return PasswordResetToken;
};
