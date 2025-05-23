require('dotenv').config();

const nodemailer = require('nodemailer');

async function main() {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    let info = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'fernandomec2013@gmail.com',
        subject: 'Teste de envio',
        text: 'Este é um teste de envio de email via Nodemailer.'
    });

    console.log('Mensagem enviada: %s', info.messageId);
}

main().catch(console.error);
