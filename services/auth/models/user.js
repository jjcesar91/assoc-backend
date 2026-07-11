'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const { validatePasswordOrThrow } = require('../utils/passwordPolicy');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // define association here
    }

    async validatePassword(password) {
      return await bcrypt.compare(password, this.password);
    }
  }
  
  User.init({
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      // Unicità composita (email, societaId): la stessa email può esistere in
      // società diverse (stessa persona registrata per più società).
      validate: {
        isEmail: true
      }
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cognome: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isStrongEnough(value) {
          validatePasswordOrThrow(value);
        }
      }
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'user'
    },
    attivo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    features: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null   // null = tutte le funzionalità abilitate (nessuna restrizione)
    },
    socio_ref_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null   // id del socio nel users-service, solo per role='socio'
    },
    societaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null   // id della società di appartenenza (null solo per superuser)
    }
  }, {
    sequelize,
    modelName: 'User',
    indexes: [
      {
        unique: true,
        fields: ['email', 'societaId'],
        name: 'users_email_societa_unique'
      }
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });
  return User;
};
