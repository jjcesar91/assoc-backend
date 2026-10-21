// Messaggio del thread di un ticket. Le note interne (solo supporto) non sono
// mai restituite al cliente.
module.exports = (sequelize, DataTypes) => {
    const TicketMessaggio = sequelize.define('TicketMessaggio', {
        ticket_id: { type: DataTypes.INTEGER, allowNull: false },
        autore_tipo: {
            type: DataTypes.STRING(10),
            allowNull: false,
            validate: { isIn: [['cliente', 'supporto']] },
        },
        autore_user_id: { type: DataTypes.INTEGER, allowNull: true },
        autore_email: { type: DataTypes.STRING, allowNull: true },
        testo: { type: DataTypes.TEXT, allowNull: false }, // testo semplice, mai HTML
        nota_interna: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        // Cambio di stato fatto insieme al messaggio (per il thread)
        stato_impostato: { type: DataTypes.STRING(20), allowNull: true },
    }, {
        tableName: 'ticket_messaggi',
        indexes: [{ name: 'ticket_messaggi_ticket', fields: ['ticket_id', 'createdAt'] }],
    });

    TicketMessaggio.associate = (models) => {
        TicketMessaggio.belongsTo(models.Ticket, { foreignKey: 'ticket_id', as: 'ticket', constraints: false });
    };

    return TicketMessaggio;
};
