module.exports = (sequelize, DataTypes) => {
    // Personalizzazione ("skin") dell'ambiente: una sola riga (id = 1) per database,
    // quindi ogni ambiente (dev / prod / prod2) ha la propria. Campi null = default.
    const PiattaformaConfig = sequelize.define('PiattaformaConfig', {
        nome_ambiente: {
            type: DataTypes.STRING(80),
            allowNull: true // titolo del tab del browser
        },
        favicon_path: {
            type: DataTypes.STRING,
            allowNull: true
        },
        colore_primario: {
            type: DataTypes.STRING(7),
            allowNull: true // #rrggbb
        },
        colore_header: {
            type: DataTypes.STRING(7),
            allowNull: true // #rrggbb, null = colore primario
        },
        logo_path: {
            type: DataTypes.STRING,
            allowNull: true // logo della pagina di login
        },
        titolo: {
            type: DataTypes.STRING(120),
            allowNull: true
        },
        sottotitolo: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        descrizione_html: {
            type: DataTypes.TEXT,
            allowNull: true // HTML ripulito (vedi sanitizeDescrizioneHtml)
        },
        // PRIVATO (mai nell'endpoint pubblico): amministratori che ricevono in copia
        // nascosta l'email di benvenuto inviata a ogni nuova registrazione.
        registrazione_ccn: {
            type: DataTypes.JSON,
            allowNull: true // array di indirizzi email
        }
    }, {
        tableName: 'piattaforma_config',
        timestamps: true
    });

    return PiattaformaConfig;
};
