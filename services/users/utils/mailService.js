'use strict';

const nodemailer = require('nodemailer');

// Default SMTP config (env vars, con fallback ai valori webassociazioni)
const DEFAULT_SMTP = {
    host: process.env.SMTP_HOST || 'mail.webassociazioni.it',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' ? true : false,
    user: process.env.SMTP_USER || 'noreply',
    password: process.env.SMTP_PASSWORD,
    fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@webassociazioni.it',
    fromName: process.env.SMTP_FROM_NAME || 'WebAssociazioni'
};

/**
 * Builds a nodemailer transporter.
 * Uses society SMTP if configured, otherwise falls back to default.
 * @param {Object|null} societa - Sequelize Societa instance or plain object
 */
function buildTransporter(societa) {
    const hasCustomSmtp = societa && societa.smtp_host && societa.smtp_user && societa.smtp_password;

    if (hasCustomSmtp) {
        return nodemailer.createTransport({
            host: societa.smtp_host,
            port: societa.smtp_port || 587,
            secure: societa.smtp_secure === true,
            auth: {
                user: societa.smtp_user,
                pass: societa.smtp_password
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });
    }

    // Default transporter
    return nodemailer.createTransport({
        host: DEFAULT_SMTP.host,
        port: DEFAULT_SMTP.port,
        secure: DEFAULT_SMTP.secure,
        auth: {
            user: DEFAULT_SMTP.user,
            pass: DEFAULT_SMTP.password
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    });
}

/**
 * Returns the "from" address to use.
 * FROM è sempre noreply@webassociazioni.it.
 * L'alias_email della società viene usato come display name se disponibile.
 * @param {Object|null} societa
 */
function buildFromAddress(societa) {
    const fromName = (societa && societa.alias_email) || DEFAULT_SMTP.fromName;
    return `"${fromName}" <${DEFAULT_SMTP.fromEmail}>`;
}

/**
 * Returns the reply-to address: the email set in the società anagrafica.
 * @param {Object|null} societa
 * @returns {string|null}
 */
function buildReplyTo(societa) {
    if (societa && societa.email) {
        return societa.email;
    }
    return null;
}

/**
 * Returns the SMTP params snapshot to store in the comunicazione record.
 * @param {Object|null} societa
 */
function buildSmtpSnapshot(societa) {
    const hasCustomSmtp = societa && societa.smtp_host && societa.smtp_user && societa.smtp_password;

    if (hasCustomSmtp) {
        return {
            host: societa.smtp_host,
            port: societa.smtp_port || 587,
            secure: societa.smtp_secure === true,
            user: societa.smtp_user,
            source: 'societa'
        };
    }

    return {
        host: DEFAULT_SMTP.host,
        port: DEFAULT_SMTP.port,
        secure: DEFAULT_SMTP.secure,
        user: DEFAULT_SMTP.user,
        source: 'default'
    };
}

/**
 * Sends an email.
 * - FROM: sempre noreply@webassociazioni.it (con alias_email come display name)
 * - REPLY-TO: email dell'anagrafica società
 * - SMTP: custom della società se configurato, altrimenti default
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {Object|null} options.societa - Societa instance (for custom SMTP lookup)
 * @param {string|Array<string>} [options.cc] - Indirizzo/i in copia conoscenza (CC)
 * @param {Array<{filename: string, content: string, encoding?: string, contentType?: string}>} [options.attachments] - Allegati (es. ricevuta PDF in base64)
 * @returns {{ fromEmail: string, fromName: string, smtpParams: Object }}
 */
async function sendEmail({ to, subject, html, societa, cc, attachments }) {
    const transporter = buildTransporter(societa);
    const from = buildFromAddress(societa);
    const replyTo = buildReplyTo(societa);
    const smtpParams = buildSmtpSnapshot(societa);

    const mailOptions = {
        from,
        to,
        subject,
        html
    };

    if (replyTo) {
        mailOptions.replyTo = replyTo;
    }

    if (cc && (Array.isArray(cc) ? cc.length > 0 : true)) {
        mailOptions.cc = cc;
    }

    if (Array.isArray(attachments) && attachments.length > 0) {
        mailOptions.attachments = attachments.map(a => ({
            filename: a.filename,
            content: a.content,
            encoding: a.encoding || 'base64',
            contentType: a.contentType || 'application/pdf'
        }));
    }

    await transporter.sendMail(mailOptions);

    const fromName = (societa && societa.alias_email) || DEFAULT_SMTP.fromName;

    return { fromEmail: DEFAULT_SMTP.fromEmail, fromName, smtpParams };
}

module.exports = { sendEmail };
