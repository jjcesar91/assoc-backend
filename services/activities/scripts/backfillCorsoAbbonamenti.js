/**
 * Migrazione dati: crea il collegamento in CorsoAbbonamenti per i corsi che
 * avevano un solo abbonamento sulla riga stessa (Corso.abbonamentoId).
 *
 * È idempotente: considera solo i corsi che non hanno ancora alcun collegamento.
 */
module.exports = async function backfillCorsoAbbonamenti(db) {
    const { Corso, CorsoAbbonamento, sequelize } = db;

    const corsi = await Corso.findAll({
        where: sequelize.literal(
            '"Corso"."abbonamentoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CorsoAbbonamenti" AS l WHERE l."corsoId" = "Corso"."id")'
        ),
        attributes: ['id', 'societaId', 'abbonamentoId'],
    });

    if (corsi.length === 0) return 0;

    await CorsoAbbonamento.bulkCreate(
        corsi.map(c => ({ corsoId: c.id, abbonamentoId: c.abbonamentoId, societaId: c.societaId })),
        { ignoreDuplicates: true }
    );

    return corsi.length;
};
