'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // In PostgreSQL, to change an ENUM we must:
    // 1. Convert the column to VARCHAR
    // 2. Drop the old ENUM type
    // 3. Create the new ENUM type
    // 4. Convert the column back
    await queryInterface.sequelize.transaction(async (t) => {
      // Step 1: convert to VARCHAR to freely manipulate values
      await queryInterface.sequelize.query(
        `ALTER TABLE "Products" ALTER COLUMN "type" TYPE VARCHAR(255);`,
        { transaction: t }
      );
      // Step 2: remap old values to new ones
      await queryInterface.sequelize.query(
        `UPDATE "Products" SET "type" = 'generic' WHERE "type" IN ('periodic_quota', 'inscription', 'schedule');`,
        { transaction: t }
      );
      // Step 3: drop old ENUM type
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_Products_type";`,
        { transaction: t }
      );
      // Step 4: create new ENUM type
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_Products_type" AS ENUM ('generic', 'subscription', 'quota_associativa', 'tesseramento');`,
        { transaction: t }
      );
      // Step 5: convert column back to ENUM
      await queryInterface.sequelize.query(
        `ALTER TABLE "Products" ALTER COLUMN "type" TYPE "enum_Products_type" USING ("type"::"enum_Products_type");`,
        { transaction: t }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE "Products" ALTER COLUMN "type" TYPE VARCHAR(255);`,
        { transaction: t }
      );
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_Products_type";`,
        { transaction: t }
      );
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_Products_type" AS ENUM ('generic', 'periodic_quota', 'subscription', 'inscription', 'schedule');`,
        { transaction: t }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Products" ALTER COLUMN "type" TYPE "enum_Products_type" USING ("type"::"enum_Products_type");`,
        { transaction: t }
      );
    });
  }
};
