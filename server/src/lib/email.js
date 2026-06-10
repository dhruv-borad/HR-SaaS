// Transactional email via Resend (spec 2.2 / 8.3). Fire-and-forget: if
// RESEND_API_KEY is unset, emails are logged and skipped — the app keeps working.
export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email skipped — RESEND_API_KEY unset] to=${to} subject="${subject}"`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'HR Platform <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) console.error('Resend error:', res.status, await res.text());
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

const portalUrl = () => process.env.CUSTOMER_PORTAL_URL || '#';

export const templates = {
  welcome: (name, email, tempPassword) => ({
    subject: 'Welcome to your HR Platform account',
    html: `<p>Hi ${name},</p><p>Your account is ready.</p>
      <p><b>Login:</b> ${email}<br/><b>Temporary password:</b> ${tempPassword}</p>
      <p>Sign in at <a href="${portalUrl()}">${portalUrl()}</a> — you will be asked to set a new password on first login.</p>`,
  }),
  actionRequired: (managerName, employeeName, type) => ({
    subject: `Action required: ${type} request from ${employeeName}`,
    html: `<p>Hi ${managerName},</p><p>${employeeName} submitted a ${type} request that needs your review.</p>
      <p><a href="${portalUrl()}">Open pending approvals</a></p>`,
  }),
  submitted: (name, type) => ({
    subject: `Your ${type} request was submitted`,
    html: `<p>Hi ${name},</p><p>Your ${type} request was submitted and your manager has been notified.</p>`,
  }),
  decision: (name, type, approved, reason) => ({
    subject: `Your ${type} request was ${approved ? 'approved' : 'rejected'}`,
    html: `<p>Hi ${name},</p><p>Your ${type} request was <b>${approved ? 'approved' : 'rejected'}</b>.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ''}`,
  }),
  payslip: (name, month, year) => ({
    subject: `Your payslip for ${month}/${year} is ready`,
    html: `<p>Hi ${name},</p><p>Your payslip for ${month}/${year} is available in the portal.</p>
      <p><a href="${portalUrl()}">View payslip</a></p>`,
  }),
  expenseInPayroll: (name, amount, currency) => ({
    subject: 'Approved expense included in payroll',
    html: `<p>Hi ${name},</p><p>Your approved expense of ${currency} ${amount} has been included in the next payroll run.</p>`,
  }),
};
