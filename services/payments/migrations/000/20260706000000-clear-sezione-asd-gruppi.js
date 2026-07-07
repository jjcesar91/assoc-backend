'use strict';

// Gli ASD non usano le sezioni del Mod. D. I gruppi/sottogruppi ASD di default
// erano però stati creati con sezione 'A' (Entrate) / 'B' (Uscite), che nel
// Bilancio li faceva apparire divisi in sezioni. Qui azzeriamo la sezione sui
// soli gruppi ASD di default (codici E, U, E1..En, U1..Un) così da renderli
// "flat". I codici APS (AE, AU, BE, EU, EE, ...) non corrispondono al pattern
// e restano intatti.
const ASD_CODICE_REGEX = "^[EU][0-9]*$";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE gruppi SET sezione = NULL
       WHERE is_default = true AND codice ~ :re`,
      { replacements: { re: ASD_CODICE_REGEX } }
    );
  },

  async down(queryInterface) {
    // Ripristino best-effort: E* -> sezione A, U* -> sezione B
    await queryInterface.sequelize.query(
      `UPDATE gruppi
         SET sezione = CASE WHEN codice ~ :reE THEN 'A' ELSE 'B' END
       WHERE is_default = true AND codice ~ :re`,
      { replacements: { re: ASD_CODICE_REGEX, reE: "^E[0-9]*$" } }
    );
  },
};
