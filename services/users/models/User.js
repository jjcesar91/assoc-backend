'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // User can have one Socio profile
      User.hasOne(models.Socio, {
        foreignKey: 'user_id',
        as: 'socioProfile',
        onDelete: 'CASCADE'
      });
    }
  }
  
  User.init({
    auth_ref_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Reference to the ID in the Auth Service'
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      // unicità nell'indice nominato sotto: `unique: true` qui fa creare a sync({alter})
      // un vincolo duplicato a ogni avvio
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.ENUM('ADMIN', 'SOCIO', 'STAFF'),
      defaultValue: 'SOCIO'
    },
    preferences: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'User UI/Business preferences'
    },
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Specific overriding permissions'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    indexes: [{ unique: true, fields: ['email'], name: 'users_email_key' }]
  });
  
  return User;
};
