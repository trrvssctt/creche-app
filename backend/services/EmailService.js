let nodemailer;
try {
  nodemailer = (await import('nodemailer')).default;
} catch {
  console.warn('[EmailService] nodemailer non disponible — les emails seront désactivés');
}

// Transporteurs par rôle — chaque adresse a ses propres credentials IONOS
const transporters = {};

function getTransporter(role = 'support') {
  if (!nodemailer) return null;
  if (transporters[role]) return transporters[role];

  const configs = {
    support: {
      host: process.env.SMTP_PROVIDER_HOST || 'smtp.ionos.fr',
      port: parseInt(process.env.SMTP_PROVIDER_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.MAIL_SUPPORT_PARENT,
        pass: process.env.PASSWORD_SUPPORT_PARENT,
      },
    },
    comptabilite: {
      host: process.env.SMTP_PROVIDER_HOST || 'smtp.ionos.fr',
      port: parseInt(process.env.SMTP_PROVIDER_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.MAIL_COMPTABILITE,
        pass: process.env.PASSWORD_COMPTABILITE,
      },
    },
    contact: {
      host: process.env.SMTP_PROVIDER_HOST || 'smtp.ionos.fr',
      port: parseInt(process.env.SMTP_PROVIDER_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.MAIL_CONTACT,
        pass: process.env.PASSWORD_CONTACT,
      },
    },
  };

  const cfg = configs[role] || configs.support;
  if (!cfg.auth.user || !cfg.auth.pass) {
    console.warn(`[EmailService] Credentials manquantes pour le rôle "${role}"`);
    return null;
  }

  transporters[role] = nodemailer.createTransport(cfg);
  return transporters[role];
}

function baseLayout(content, ecoleNom = 'Le Toit des Anges', logoUrl = '') {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${ecoleNom}" width="72" height="72" style="display:block;margin:0 auto 12px;border-radius:14px;background:#fff;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,0.12);object-fit:contain" />`
    : '';
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:'Segoe UI',Roboto,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6f3;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
  <tr><td style="background:linear-gradient(135deg,#f59e0b,#f97316);padding:28px 32px;text-align:center">
    ${logoHtml}
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px">${ecoleNom}</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px">Espace Parents</p>
  </td></tr>
  <tr><td style="padding:32px">${content}</td></tr>
  <tr><td style="background:#faf9f7;padding:20px 32px;text-align:center;border-top:1px solid #f0ede8">
    <p style="margin:0;color:#9ca3af;font-size:11px">
      ${ecoleNom} &mdash; Cet email a été envoyé automatiquement, merci de ne pas y répondre.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export class EmailService {

  static async sendWelcomeParent({ to, parentName, email, tempPassword, loginUrl, ecoleNom, logoUrl }) {
    const transporter = getTransporter('support');
    if (!transporter) { console.warn('[EmailService] Pas de transporteur support — email non envoyé'); return; }

    const content = `
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px">Bienvenue ${parentName} !</h2>
      <p style="color:#475569;font-size:14px;line-height:1.7">
        Votre compte parent a été créé sur la plateforme de suivi scolaire de <strong>${ecoleNom}</strong>.
        Vous pouvez dès à présent accéder au portail parents pour suivre la scolarité de vos enfants.
      </p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px">Vos identifiants de connexion</p>
        <table style="width:100%">
          <tr><td style="color:#78716c;font-size:13px;padding:4px 0">Email :</td><td style="font-weight:700;color:#1e293b;font-size:14px">${email}</td></tr>
          <tr><td style="color:#78716c;font-size:13px;padding:4px 0">Mot de passe :</td><td style="font-weight:700;color:#d97706;font-size:16px;font-family:monospace;letter-spacing:2px">${tempPassword}</td></tr>
        </table>
      </div>
      <p style="color:#475569;font-size:13px;line-height:1.6">
        Nous vous recommandons de <strong>changer votre mot de passe</strong> dès votre première connexion depuis votre profil.
      </p>
      <div style="text-align:center;margin:28px 0 12px">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:14px;letter-spacing:0.5px">
          Accéder au portail parents
        </a>
      </div>`;

    await transporter.sendMail({
      from: `"${ecoleNom}" <${process.env.MAIL_SUPPORT_PARENT}>`,
      to,
      subject: `Bienvenue sur l'espace parents — ${ecoleNom}`,
      html: baseLayout(content, ecoleNom, logoUrl),
    });
  }

  static async sendPasswordReset({ to, parentName, resetUrl, ecoleNom, logoUrl }) {
    const transporter = getTransporter('support');
    if (!transporter) return;

    const content = `
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px">Réinitialisation de votre mot de passe</h2>
      <p style="color:#475569;font-size:14px;line-height:1.7">
        Bonjour ${parentName},<br>
        Une demande de réinitialisation de mot de passe a été effectuée pour votre compte sur la plateforme de <strong>${ecoleNom}</strong>.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:14px">
          Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.6">
        Ce lien est valable <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
      </p>`;

    await transporter.sendMail({
      from: `"${ecoleNom}" <${process.env.MAIL_SUPPORT_PARENT}>`,
      to,
      subject: `Réinitialisation de mot de passe — ${ecoleNom}`,
      html: baseLayout(content, ecoleNom, logoUrl),
    });
  }

  static async sendAdminResetNotification({ to, parentName, newPassword, loginUrl, ecoleNom, logoUrl }) {
    const transporter = getTransporter('support');
    if (!transporter) return;

    const content = `
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px">Votre mot de passe a été réinitialisé</h2>
      <p style="color:#475569;font-size:14px;line-height:1.7">
        Bonjour ${parentName},<br>
        L'administration de <strong>${ecoleNom}</strong> a réinitialisé votre mot de passe d'accès au portail parents.
      </p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px">Nouveau mot de passe</p>
        <p style="margin:0;font-weight:700;color:#d97706;font-size:20px;font-family:monospace;letter-spacing:3px;text-align:center">${newPassword}</p>
      </div>
      <p style="color:#475569;font-size:13px;line-height:1.6">
        Nous vous recommandons de <strong>changer ce mot de passe</strong> dès votre prochaine connexion.
      </p>
      <div style="text-align:center;margin:28px 0 12px">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:14px">
          Se connecter
        </a>
      </div>`;

    await transporter.sendMail({
      from: `"${ecoleNom}" <${process.env.MAIL_SUPPORT_PARENT}>`,
      to,
      subject: `Mot de passe réinitialisé — ${ecoleNom}`,
      html: baseLayout(content, ecoleNom, logoUrl),
    });
  }

  static async sendInvoice({ to, parentName, ecoleNom, enfantNom, mois, montant, currency, echeances, logoUrl, attachments, subject: customSubject }) {
    const transporter = getTransporter('comptabilite');
    if (!transporter) return;

    const rows = (echeances || []).map(e => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:13px;color:#475569">${e.label || e.description || 'Scolarité'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:13px;color:#475569;text-align:center">${e.mois || mois}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:14px;font-weight:700;color:#1e293b;text-align:right">${(e.montant || 0).toLocaleString('fr-FR')} ${currency}</td>
      </tr>`).join('');

    const content = `
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px">Relevé de facture</h2>
      <p style="color:#475569;font-size:14px;line-height:1.7">
        Bonjour ${parentName},<br>
        Veuillez trouver ci-dessous le détail des échéances de scolarité pour <strong>${enfantNom}</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #f0ede8;border-radius:8px;overflow:hidden">
        <tr style="background:#faf9f7">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px">Description</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px">Période</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px">Montant</th>
        </tr>
        ${rows}
        <tr style="background:#fffbeb">
          <td colspan="2" style="padding:12px;font-size:13px;font-weight:800;color:#92400e;text-transform:uppercase">Total</td>
          <td style="padding:12px;font-size:16px;font-weight:900;color:#d97706;text-align:right">${(montant || 0).toLocaleString('fr-FR')} ${currency}</td>
        </tr>
      </table>
      ${attachments?.length ? '<p style="color:#475569;font-size:12px;margin-top:16px">📎 La facture PDF est jointe à cet email.</p>' : ''}
      <p style="color:#94a3b8;font-size:12px;line-height:1.6">
        Pour toute question concernant la facturation, contactez l'administration de l'école.
      </p>`;

    await transporter.sendMail({
      from: `"${ecoleNom} — Comptabilité" <${process.env.MAIL_COMPTABILITE}>`,
      to,
      subject: customSubject || `Facture scolarité ${enfantNom} — ${mois} — ${ecoleNom}`,
      html: baseLayout(content, ecoleNom, logoUrl),
      ...(attachments?.length ? { attachments } : {}),
    });
  }

  static async sendGenericInfo({ to, subject, body, ecoleNom, role = 'contact', logoUrl, attachments }) {
    console.log(`[EmailService.sendGenericInfo] to="${to}", role="${role}", subject="${subject}"`);
    const transporter = getTransporter(role);
    if (!transporter) {
      console.warn(`[EmailService.sendGenericInfo] Pas de transporteur pour role="${role}" — email non envoyé`);
      return;
    }

    const fromMap = {
      support: process.env.MAIL_SUPPORT_PARENT,
      comptabilite: process.env.MAIL_COMPTABILITE,
      contact: process.env.MAIL_CONTACT,
    };

    const content = `
      <div style="color:#475569;font-size:14px;line-height:1.7">${body}</div>`;

    const info = await transporter.sendMail({
      from: `"${ecoleNom}" <${fromMap[role] || fromMap.contact}>`,
      to,
      subject,
      html: baseLayout(content, ecoleNom, logoUrl),
      ...(attachments?.length ? { attachments } : {}),
    });
    console.log(`[EmailService.sendGenericInfo] Email envoyé OK → messageId=${info.messageId}`);
  }
}
