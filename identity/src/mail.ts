import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

export async function getTransport() {
  if (transporter) return transporter;
  const testAcc = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAcc.smtp.host,
    port: testAcc.smtp.port,
    secure: testAcc.smtp.secure,
    auth: { user: testAcc.user, pass: testAcc.pass }
  });
  return transporter;
}

export async function sendInviteMail(to: string, subject: string, html: string) {
  const t = await getTransport();
  const info = await t.sendMail({
    to,
    from: '"TAXIPartner" <no-reply@taxipartner.test>',
    subject,
    html
  });
  return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
}
