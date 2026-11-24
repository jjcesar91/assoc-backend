const { Model } = require('sequelize');

// Storico delle modifiche a una ricevuta/proforma/movimento: una riga per evento
// (modifica di campi, annullamento, registrazione proforma, proroga, eliminazione,
// quietanza caricata, import voci) con i campi cambiati, l'autore e l'origine.
// Mostrato nel tab "Storico" del Dettaglio ricevuta; se il pagamento è di un socio
// lo stesso evento finisce nello storico socio (vedi utils/storicoRicevuta.js).
module.exports = (sequelize, DataTypes) => {
  class PaymentModifica extends Model {}
  PaymentModifica.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    payment_id: { type: DataTypes.INTEGER, allowNull: false },
    societa_id: { type: DataTypes.INTEGER, allowNull: false },
    socio_id: { type: DataTypes.INTEGER, allowNull: true },
    // 'modifica' | 'annullamento' | 'registrazione' | 'proroga' | 'eliminazione' | 'quietanza' | 'import'
    tipo: { type: DataTypes.STRING(30), allowNull: false },
    descrizione: { type: DataTypes.TEXT, allowNull: false },
    // [{ campo, etichetta, da, a }] con valori già formattati per la lettura
    modifiche: { type: DataTypes.JSONB, allowNull: true },
    utente_id: { type: DataTypes.INTEGER, allowNull: true },
    utente_email: { type: DataTypes.STRING, allowNull: true },
    utente_ruolo: { type: DataTypes.STRING(20), allowNull: true },
    // 'dettaglio_ricevuta' | 'prima_nota' | 'scadenziario' | 'area_soci' | 'import' | 'altro'
    origine: { type: DataTypes.STRING(30), allowNull: true },
  }, {
    sequelize,
    modelName: 'PaymentModifica',
    tableName: 'payment_modifiche',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['payment_id'], name: 'payment_modifiche_payment_idx' }],
  });
  return PaymentModifica;
};
