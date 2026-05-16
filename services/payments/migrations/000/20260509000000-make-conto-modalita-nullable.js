'use strict';

module.exports = {
  async up(queryInterface) {
    // Change ENUM to VARCHAR and drop NOT NULL constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE "conti"
        ALTER COLUMN "modalita_pagamento" TYPE VARCHAR(50)
          USING "modalita_pagamento"::VARCHAR,
        ALTER COLUMN "modalita_pagamento" DROP NOT NULL;
    `);
  },

  async down(queryInterface) {
    // Restore NOT NULL (fill NULLs first so the constraint doesn't fail)
    await queryInterface.sequelize.query(`
      UPDATE "conti" SET "modalita_pagamento" = 'Contanti' WHERE "modalita_pagamento" IS NULL;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "conti" ALTER COLUMN "modalita_pagamento" SET NOT NULL;
    `);
  },
};
