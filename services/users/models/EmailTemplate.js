module.exports = (sequelize, DataTypes) => {
    // Testi delle email automatiche della piattaforma (Backoffice → Email), uno per
    // chiave (vedi utils/emailTemplates.js). Campi null = testo predefinito.
    const EmailTemplate = sequelize.define('EmailTemplate', {
        chiave: {
            type: DataTypes.STRING(40),
            primaryKey: true
        },
        oggetto: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        corpo_html: {
            type: DataTypes.TEXT,
            allowNull: true // HTML ripulito: solo tag di formattazione, segnaposto {{CAMPO}}
        },
        ccn: {
            type: DataTypes.JSON,
            allowNull: true // amministratori in copia nascosta (array di email)
        }
    }, {
        tableName: 'email_template',
        timestamps: true
    });

    return EmailTemplate;
};
