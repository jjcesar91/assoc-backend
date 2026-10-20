const models = require('../models');
const { inviaEmail, valoriLicenza } = require('./emailTemplates');

// Email "Registrazione ricevuta": all'indirizzo di registrazione dopo l'invio del
// form pubblico. Testo configurabile in Backoffice → Email (registrazione_ricevuta).
async function inviaEmailRegistrazione({ licenza, origin }) {
    return inviaEmail(models, 'registrazione_ricevuta', {
        to: licenza.email,
        valori: valoriLicenza(licenza, { origin }),
    });
}

// Email "Benvenuto e primi passi": all'amministratore dopo la prima impostazione
// della password dal link di attivazione (richiesta dal servizio auth).
async function inviaEmailBenvenuto({ licenza, email, nome, origin }) {
    return inviaEmail(models, 'benvenuto', {
        to: email,
        valori: valoriLicenza(licenza, { nome, email, origin }),
    });
}

module.exports = { inviaEmailRegistrazione, inviaEmailBenvenuto };
