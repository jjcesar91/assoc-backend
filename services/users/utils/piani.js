// Limiti e funzionalità per piano di licenza: UNICA fonte di verità, esposta agli
// altri servizi (endpoint interno) e al frontend (licenza corrente).
//   max_*: numero massimo (null = illimitato)
//   booleani: funzionalità disponibile
// Pro e Advanced per ora non hanno limiti (da definire quando verranno venduti).
const SENZA_LIMITI = {
    max_soci: null,          // per licenza (somma delle sue società)
    max_conti: null,         // per società
    max_moduli: null,        // per società
    gruppi_personalizzati: true,
    bilancio: true,
    ordini_prodotti_generici: true,
    creazione_utenti: true,
};

const PIANI_LIMITI = {
    free: {
        max_soci: 50,
        max_conti: 2,
        max_moduli: 2,
        gruppi_personalizzati: false,
        bilancio: false,
        ordini_prodotti_generici: false,
        creazione_utenti: false,
    },
    pro: { ...SENZA_LIMITI },
    advanced: { ...SENZA_LIMITI },
};

const NOMI_PIANI = { free: 'Free', pro: 'Pro', advanced: 'Advanced' };

const limitiPerPiano = (piano) => PIANI_LIMITI[piano] || PIANI_LIMITI.free;

module.exports = { PIANI_LIMITI, NOMI_PIANI, limitiPerPiano };
