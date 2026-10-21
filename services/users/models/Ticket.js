// Ticket di assistenza aperto da un utente del gestionale per una società
// (menu Assistenza) e gestito dal supporto in Backoffice → Ticket.
// Stati e regole di passaggio in utils/ticket.js.
module.exports = (sequelize, DataTypes) => {
    const Ticket = sequelize.define('Ticket', {
        societa_id: { type: DataTypes.INTEGER, allowNull: false },
        licenza_id: { type: DataTypes.INTEGER, allowNull: true },
        oggetto: { type: DataTypes.STRING(150), allowNull: false },
        categoria: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'tecnico',
            validate: { isIn: [['tecnico', 'amministrativo', 'funzionalita', 'altro']] },
        },
        priorita: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'normale',
            validate: { isIn: [['bassa', 'normale', 'alta', 'urgente']] },
        },
        stato: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'aperto',
            validate: { isIn: [['aperto', 'in_lavorazione', 'in_attesa_cliente', 'risolto', 'chiuso']] },
        },
        // Autore (utente auth: id ed email dal token)
        autore_user_id: { type: DataTypes.INTEGER, allowNull: true },
        autore_email: { type: DataTypes.STRING, allowNull: true },
        // Ultimo messaggio visibile al cliente (le note interne non contano)
        ultimo_messaggio_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        ultimo_messaggio_da: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: 'cliente',
            validate: { isIn: [['cliente', 'supporto']] },
        },
        // Ultima lettura di ciascuna parte, per l'indicatore "nuova risposta"
        letto_cliente_at: { type: DataTypes.DATE, allowNull: true },
        letto_supporto_at: { type: DataTypes.DATE, allowNull: true },
        risolto_at: { type: DataTypes.DATE, allowNull: true },
        chiuso_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'tickets',
        indexes: [
            { name: 'tickets_societa_stato', fields: ['societa_id', 'stato'] },
            { name: 'tickets_ultimo_messaggio', fields: ['ultimo_messaggio_at'] },
        ],
    });

    Ticket.associate = (models) => {
        Ticket.belongsTo(models.Societa, { foreignKey: 'societa_id', as: 'societa', constraints: false });
        Ticket.hasMany(models.TicketMessaggio, { foreignKey: 'ticket_id', as: 'messaggi', onDelete: 'CASCADE' });
    };

    return Ticket;
};
