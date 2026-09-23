import nodemailer, { type Transporter } from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Lien d'action du message (vérification, réinitialisation), pour le mode console et les tests. */
  link: string;
}

/**
 * Envoi des e-mails de compte. Trois modes :
 * - « smtp » : vrai envoi (production) ;
 * - « console » : développement uniquement, le lien est écrit dans le terminal et gardé en mémoire ;
 * - « off » : aucun envoi possible → l'inscription par e-mail est désactivée (jamais simulée en production).
 */
export class Mailer {
  readonly mode: 'smtp' | 'console' | 'off';
  /** Derniers messages en mode console (tests automatisés, développement). */
  readonly outbox: OutgoingMail[] = [];
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(smtp: SmtpConfig | null, allowConsole: boolean, private readonly quiet = false) {
    if (smtp) {
      this.mode = 'smtp';
      this.from = smtp.from;
      this.transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      });
    } else {
      this.mode = allowConsole ? 'console' : 'off';
      this.from = 'Undercover <no-reply@localhost>';
      this.transport = null;
    }
  }

  get enabled(): boolean {
    return this.mode !== 'off';
  }

  async send(mail: OutgoingMail): Promise<void> {
    if (this.mode === 'off') throw new Error('Envoi d’e-mails non configuré');
    if (this.mode === 'console') {
      this.outbox.push(mail);
      if (this.outbox.length > 50) this.outbox.shift();
      if (!this.quiet) console.log(`[undercover] (dev) e-mail pour ${mail.to} — ${mail.subject}\n  ${mail.link}`);
      return;
    }
    await this.transport?.sendMail({ from: this.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Message simple et lisible, sans ressource externe. */
export function actionMail(to: string, subject: string, intro: string, action: string, link: string, outro: string): OutgoingMail {
  const text = `${intro}\n\n${action} : ${link}\n\n${outro}\n\n— Undercover`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#2a1b12;max-width:520px">
<p>${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#ff8a2b;color:#2a1b12;font-weight:700;padding:12px 20px;border-radius:12px;border:2px solid #2a1b12;text-decoration:none">${escapeHtml(action)}</a></p>
<p style="font-size:13px;color:#5b4334">${escapeHtml(outro)}</p>
<p style="font-size:13px;color:#7d6453">Lien direct : ${escapeHtml(link)}</p></div>`;
  return { to, subject, text, html, link };
}
