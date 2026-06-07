import twilio from 'twilio';
import { Resend } from 'resend';

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface OrderNotificationData {
  orderNumber: number;
  clientName: string;
  cityName: string;
  phone: string;
  email?: string;
  items: { name: string; quantity: number; subtotal: number }[];
  total: number;
  cashbackUsed: number;
  cashbackEarned: number;
  deliveryDate: Date;
  preferredTimeRange: string;
  notes?: string;
  newCashbackBalance: number;
  createdAt: Date;
}

export async function sendWhatsAppToAdmin(data: OrderNotificationData, adminNumber: string): Promise<void> {
  try {
    if (!twilioClient) { console.log('[Twilio] No configurado — WhatsApp omitido.'); return; }
    if (!adminNumber) { console.log('[Twilio] Número de admin no configurado — WhatsApp omitido.'); return; }

    const itemsList = data.items
      .map((i) => `• ${i.name} x${i.quantity} — $${i.subtotal.toFixed(2)}`)
      .join('\n');

    const body = `🛒 Nuevo pedido recibido — Varieté
📍 Establecimiento: ${data.clientName}
🏙️ Ciudad: ${data.cityName}
📞 Teléfono: ${data.phone}
📧 Email: ${data.email || 'No informado'}

Detalle del pedido:
${itemsList}

💰 Total del pedido: $${data.total.toFixed(2)}
🎁 Saldo de beneficios utilizado: ${data.cashbackUsed > 0 ? '$' + data.cashbackUsed.toFixed(2) : 'No utilizado'}
💸 Beneficio generado en esta compra: $${data.cashbackEarned.toFixed(2)}
📅 Fecha de entrega seleccionada: ${data.deliveryDate.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
🕐 Rango horario solicitado: ${data.preferredTimeRange}
📝 Observaciones: ${data.notes || 'Sin observaciones'}
⏰ Registrado el: ${data.createdAt.toLocaleString('es-AR')}`;

    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: adminNumber,
      body,
    });
  } catch (err) {
    console.error('Error enviando WhatsApp al administrador:', err);
  }
}

export async function sendOrderConfirmationEmail(data: OrderNotificationData): Promise<void> {
  try {
    if (!data.email || !resend) { if (!resend) console.log('[Resend] No configurado — email omitido.'); return; }

    const itemsRows = data.items
      .map(
        (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #2d2d2d;">${i.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2d2d2d;text-align:center;">${i.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2d2d2d;text-align:right;">$${(i.subtotal / i.quantity).toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2d2d2d;text-align:right;">$${i.subtotal.toFixed(2)}</td>
      </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Confirmación de Pedido — Varieté</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e5e5e5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:12px;overflow:hidden;border:1px solid #2d2d2d;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2000 100%);padding:40px;text-align:center;border-bottom:2px solid #d97706;">
            <h1 style="margin:0;font-size:36px;font-weight:800;letter-spacing:4px;color:#d97706;">VARIETÉ</h1>
            <p style="margin:8px 0 0;color:#a0a0a0;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Plataforma de Distribución B2B</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="font-size:16px;margin:0 0 8px;">Estimado/a <strong style="color:#d97706;">${data.clientName}</strong>:</p>
            <p style="color:#a0a0a0;margin:0 0 30px;">Le confirmamos la recepción de su pedido N° <strong style="color:#fff;">#${data.orderNumber}</strong>.</p>

            <!-- Items table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2d2d2d;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#1e1e1e;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#a0a0a0;text-transform:uppercase;letter-spacing:1px;">Producto</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;color:#a0a0a0;text-transform:uppercase;letter-spacing:1px;">Cant.</th>
                <th style="padding:10px 12px;text-align:right;font-size:12px;color:#a0a0a0;text-transform:uppercase;letter-spacing:1px;">P. Unit.</th>
                <th style="padding:10px 12px;text-align:right;font-size:12px;color:#a0a0a0;text-transform:uppercase;letter-spacing:1px;">Subtotal</th>
              </tr>
              ${itemsRows}
            </table>

            <!-- Totals -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              ${data.cashbackUsed > 0 ? `
              <tr>
                <td style="padding:6px 0;color:#a0a0a0;">Saldo de beneficios utilizado:</td>
                <td style="padding:6px 0;text-align:right;color:#10b981;">-$${data.cashbackUsed.toFixed(2)}</td>
              </tr>` : ''}
              <tr style="border-top:1px solid #2d2d2d;">
                <td style="padding:12px 0;font-size:18px;font-weight:700;">Total abonado:</td>
                <td style="padding:12px 0;text-align:right;font-size:18px;font-weight:700;color:#d97706;">$${data.total.toFixed(2)}</td>
              </tr>
            </table>

            <!-- Cashback info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a2a1a;border:1px solid #1a4a1a;border-radius:8px;padding:16px;margin-bottom:24px;">
              <tr>
                <td style="padding:4px 16px;">
                  <p style="margin:0;color:#10b981;font-size:14px;">💸 Beneficio acumulado en esta compra: <strong>$${data.cashbackEarned.toFixed(2)}</strong></p>
                  <p style="margin:8px 0 0;color:#10b981;font-size:14px;">🏦 Nuevo saldo de beneficios disponible: <strong>$${data.newCashbackBalance.toFixed(2)}</strong></p>
                </td>
              </tr>
            </table>

            <!-- Delivery info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2a;border:1px solid #2d2d4d;border-radius:8px;padding:16px;margin-bottom:24px;">
              <tr>
                <td style="padding:4px 16px;">
                  <p style="margin:0;color:#a0a0ff;font-size:14px;">📅 Fecha de entrega programada: <strong style="color:#fff;">${data.deliveryDate.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
                  <p style="margin:8px 0 0;color:#a0a0ff;font-size:14px;">🕐 Rango horario: <strong style="color:#fff;">${data.preferredTimeRange}</strong></p>
                </td>
              </tr>
            </table>

            <p style="background:#2d1a00;border:1px solid #d97706;border-radius:8px;padding:12px 16px;color:#d97706;font-size:13px;margin-bottom:24px;">
              💳 Recordatorio: El pago se realiza contra entrega al momento de la recepción del pedido.
            </p>

            <p style="color:#a0a0a0;font-size:14px;line-height:1.6;margin:0;">
              Agradecemos su confianza en Varieté. Quedamos a su disposición ante cualquier consulta.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#0a0a0a;padding:24px 40px;border-top:1px solid #2d2d2d;text-align:center;">
            <p style="margin:0;color:#666;font-size:12px;">© ${new Date().getFullYear()} Varieté — Distribución B2B</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Varieté <noreply@variete.com>',
      to: data.email,
      subject: `Confirmación de Pedido #${data.orderNumber} — Varieté`,
      html,
    });
  } catch (err) {
    console.error('Error enviando email de confirmación:', err);
  }
}

export async function sendOrderStatusEmail(
  email: string,
  clientName: string,
  orderNumber: number,
  status: 'PREPARING' | 'DELIVERED'
): Promise<void> {
  try {
    if (!resend) { console.log('[Resend] No configurado — email de estado omitido.'); return; }
    const isDelivered = status === 'DELIVERED';
    const subject = isDelivered
      ? `Su pedido #${orderNumber} ha sido entregado — Varieté`
      : `Su pedido #${orderNumber} está siendo preparado — Varieté`;

    const bodyContent = isDelivered
      ? `<p>Su pedido N° <strong style="color:#d97706;">#${orderNumber}</strong> ha sido entregado exitosamente.</p>
         <p style="color:#a0a0a0;">Agradecemos su confianza en Varieté. Lo invitamos a realizar su próximo pedido cuando lo requiera.</p>`
      : `<p>Su pedido N° <strong style="color:#d97706;">#${orderNumber}</strong> se encuentra actualmente en proceso de preparación.</p>
         <p style="color:#a0a0a0;">Le notificaremos al momento de la entrega. Ante cualquier consulta, no dude en contactarnos.</p>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e5e5e5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:12px;overflow:hidden;border:1px solid #2d2d2d;">
      <tr><td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2000 100%);padding:40px;text-align:center;border-bottom:2px solid #d97706;">
        <h1 style="margin:0;font-size:36px;font-weight:800;letter-spacing:4px;color:#d97706;">VARIETÉ</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <p style="font-size:16px;margin:0 0 16px;">Estimado/a <strong style="color:#d97706;">${clientName}</strong>:</p>
        ${bodyContent}
      </td></tr>
      <tr><td style="background:#0a0a0a;padding:24px 40px;border-top:1px solid #2d2d2d;text-align:center;">
        <p style="margin:0;color:#666;font-size:12px;">© ${new Date().getFullYear()} Varieté — Distribución B2B</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Varieté <noreply@variete.com>',
      to: email,
      subject,
      html,
    });
  } catch (err) {
    console.error('Error enviando email de estado de pedido:', err);
  }
}
