module.exports = (sequelize, DataTypes) => {
    // Licenza d'uso del gestionale (Backoffice → Licenze). Una licenza raggruppa
    // una o più società (societa.licenza_id) e ha almeno un amministratore
    // (utenti auth con licenzaId). Il suo nome è l'associazione registrata.
    // Contiene la SNAPSHOT dei dati di registrazione così come inviati dal
    // cliente: volutamente indipendente dall'anagrafica delle società.
    const Licenza = sequelize.define('Licenza', {
        societa_id: {
            type: DataTypes.INTEGER,
            allowNull: false // società di registrazione (la prima della licenza)
        },
        piano: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'free',
            validate: { isIn: [['free', 'pro', 'advanced']] }
        },
        stato: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'in_attesa',
            // in_attesa = nuova licenza (sito o Backoffice), da attivare dal Backoffice
            validate: { isIn: [['attiva', 'in_attesa', 'sospesa', 'scaduta']] }
        },
        data_inizio: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        data_scadenza: {
            type: DataTypes.DATEONLY,
            allowNull: true // null = senza scadenza
        },
        note: {
            type: DataTypes.TEXT,
            allowNull: true // uso interno del Backoffice
        },

        // --- Dati di registrazione (snapshot) ---
        associazione: { type: DataTypes.STRING, allowNull: true },
        tipologia: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        indirizzo: { type: DataTypes.STRING, allowNull: true }, // via e numero civico
        cap: { type: DataTypes.STRING(10), allowNull: true },
        comune: { type: DataTypes.STRING, allowNull: true },
        provincia: { type: DataTypes.STRING(30), allowNull: true },
        anno_associativo_tipo: {
            type: DataTypes.STRING(20),
            allowNull: true,
            validate: { isIn: [['solare', 'sportivo', 'personalizzato']] }
        },
        anno_associativo_inizio: {
            type: DataTypes.STRING(5), // "gg-mm", solo per anno personalizzato
            allowNull: true
        },
        affiliazioni: { type: DataTypes.TEXT, allowNull: true },
        presidente: { type: DataTypes.STRING, allowNull: true },
        telefono: { type: DataTypes.STRING(50), allowNull: true }, // telefono associazione
        referente_nome: { type: DataTypes.STRING, allowNull: true },
        referente_telefono: { type: DataTypes.STRING(50), allowNull: true }
    }, {
        tableName: 'licenze',
        timestamps: true,
        // Indice con nome esplicito: con sync({ alter: true }) un `unique: true`
        // sulla colonna verrebbe ricreato a ogni avvio.
        indexes: [{ unique: true, fields: ['societa_id'], name: 'licenze_societa_unique' }]
    });

    return Licenza;
};
