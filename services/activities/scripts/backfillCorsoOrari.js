/**
 * Migrazione dati: popola CorsoOrari per i corsi preesistenti.
 *
 * Prima dell'introduzione degli orari multipli, ogni Corso aveva un solo
 * giorno/oraInizio/durataMinuti sulla riga stessa. Questo script crea la
 * riga corrispondente in CorsoOrari per ogni corso che non ne ha ancora.
 *
 * È idempotente: girando a ogni boot non duplica nulla.
 */
module.exports = async function backfillCorsoOrari(db) {
    const { Corso, CorsoOrario, sequelize } = db;

    const corsiSenzaOrari = await Corso.findAll({
        where: sequelize.literal(
            'NOT EXISTS (SELECT 1 FROM "CorsoOrari" AS o WHERE o."corsoId" = "Corso"."id")'
        ),
        attributes: ['id', 'giorno', 'oraInizio', 'durataMinuti'],
    });

    if (corsiSenzaOrari.length === 0) return 0;

    const now = new Date();
    await CorsoOrario.bulkCreate(
        corsiSenzaOrari.map(c => ({
            corsoId: c.id,
            giorno: c.giorno,
            oraInizio: c.oraInizio,
            durataMinuti: c.durataMinuti ?? 50,
            createdAt: now,
            updatedAt: now,
        }))
    );

    return corsiSenzaOrari.length;
};
