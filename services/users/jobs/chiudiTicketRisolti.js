const { Op } = require('sequelize');
const { Ticket, TicketMessaggio, sequelize } = require('../models');
const { GIORNI_CHIUSURA_AUTOMATICA, campiStato } = require('../utils/ticket');

// Chiude i ticket "Risolto" senza risposta del cliente da GIORNI_CHIUSURA_AUTOMATICA giorni
async function chiudiTicketRisolti() {
    const limite = new Date(Date.now() - GIORNI_CHIUSURA_AUTOMATICA * 24 * 60 * 60 * 1000);
    const tickets = await Ticket.findAll({ where: { stato: 'risolto', risolto_at: { [Op.lt]: limite } }, attributes: ['id'] });
    for (const { id } of tickets) {
        await sequelize.transaction(async (transaction) => {
            await TicketMessaggio.create({
                ticket_id: id, autore_tipo: 'supporto', nota_interna: false, stato_impostato: 'chiuso',
                testo: `Ticket chiuso automaticamente: nessuna risposta per ${GIORNI_CHIUSURA_AUTOMATICA} giorni dopo la risoluzione.`,
            }, { transaction });
            await Ticket.update(campiStato('chiuso'), { where: { id, stato: 'risolto' }, transaction });
        });
    }
    if (tickets.length) console.log(`[ticket] chiusi automaticamente ${tickets.length} ticket risolti`);
    return tickets.length;
}

module.exports = { chiudiTicketRisolti };
