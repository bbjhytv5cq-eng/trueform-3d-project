import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many order attempts right now. Please try again a little later.' }
});

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname)));

app.get('/api/catalog', (_req, res) => {
  res.json(catalog);
});

app.post('/api/order', orderLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const {
      itemId,
      customerName,
      customerEmail,
      phone,
      address,
      quantity,
      color,
      secondColor,
      website,
      formLoadedAt,
      notes,
      cart,
      kind,
      contactPreference,
      size,
      budget,
      description
    } = body;

    if (website) {
      return res.status(400).json({ error: 'Spam check triggered.' });
    }

    const safeName = String(customerName || '').trim();
    const safeEmail = String(customerEmail || '').trim().toLowerCase();
    const safePhone = String(phone || '').trim();
    const safeAddress = String(address || '').trim();
    const safeColor = String(color || '').trim();
    const safeSecondColor = String(secondColor || '').trim();
    const safeNotes = String(notes || '').trim();
    const safeContactPreference = String(contactPreference || '').trim();
    const safeSize = String(size || '').trim();
    const safeBudget = String(budget || '').trim();
    const safeDescription = String(description || '').trim();
    const quantityNumber = Number(quantity);
    const loadedAtMs = Number(formLoadedAt);

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!safeName || !safeEmail) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    if (!emailPattern.test(safeEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const to = process.env.ORDER_TO_EMAIL || catalog.contact?.email;
    const from = process.env.RESEND_FROM_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!from || !resendApiKey) {
      return res.status(500).json({ error: 'Email is not configured yet. Add Resend settings to .env first.' });
    }

    const resend = new Resend(resendApiKey);

    if (kind === 'custom-order') {
      if (!safeDescription) {
        return res.status(400).json({ error: 'Please describe what you want.' });
      }

      const subject = `New custom order request from ${safeName}`;
      const adminText = [
        'A customer submitted a custom order request.',
        '',
        `Customer name: ${safeName}`,
        `Customer email: ${safeEmail}`,
        `Phone: ${safePhone || 'Not provided'}`,
        `Contact preference: ${safeContactPreference || 'Not provided'}`,
        `Preferred size: ${safeSize || 'Not provided'}`,
        `Quantity needed: ${quantity || 'Not provided'}`,
        `Budget range: ${safeBudget || 'Not provided'}`,
        '',
        'Description:',
        safeDescription
      ].join('\n');

      const resendResult = await resend.emails.send({ from, to, replyTo: safeEmail, subject, text: adminText });
      if (resendResult?.error || !resendResult?.data?.id) {
        return res.status(500).json({ error: resendResult?.error?.message || 'Unable to send custom order email.' });
      }

      const customerResult = await resend.emails.send({
        from,
        to: safeEmail,
        replyTo: to,
        subject: 'We received your Trueform 3D custom order request',
        text: `Hi ${safeName},\n\nThank you for submitting your request! We look forward to working with you on this project! We will email you shortly to finalize your request!\n\nWe received the following details:\n- Preferred size: ${safeSize || 'Not provided'}\n- Quantity needed: ${quantity || 'Not provided'}\n- Budget range: ${safeBudget || 'Not provided'}\n- Contact preference: ${safeContactPreference || 'Not provided'}\n\nDescription:\n${safeDescription}\n\n— Trueform 3D`
      });

      return res.json({ ok: true, message: 'Custom order email accepted for delivery.', emailId: resendResult.data.id, confirmationEmailId: customerResult?.data?.id || null });
    }

    if (Array.isArray(cart)) {
      if (!safeAddress) {
        return res.status(400).json({ error: 'Address is required.' });
      }
      if (!cart.length) {
        return res.status(400).json({ error: 'Cart is empty.' });
      }

      const cartSummary = cart.map((entry) => {
        const options = [entry.color, entry.secondColor].filter(Boolean).join(' / ');
        return `- ${entry.name || entry.itemId} (Item #${entry.itemId}) x ${entry.quantity}${options ? ` | ${options}` : ''} @ $${Number(entry.price || 0).toFixed(2)}`;
      }).join('\n');

      const total = Number(body.total || 0);
      const subject = `New cart order from ${safeName}`;
      const adminText = [
        'A customer submitted a cart order.',
        '',
        `Customer name: ${safeName}`,
        `Customer email: ${safeEmail}`,
        `Phone: ${safePhone || 'Not provided'}`,
        `Address: ${safeAddress}`,
        `Notes: ${safeNotes || 'None'}`,
        '',
        'Items:',
        cartSummary,
        '',
        `Cart total: $${total.toFixed(2)}`
      ].join('\n');

      const resendResult = await resend.emails.send({ from, to, replyTo: safeEmail, subject, text: adminText });
      if (resendResult?.error || !resendResult?.data?.id) {
        return res.status(500).json({ error: resendResult?.error?.message || 'Unable to send cart order email.' });
      }

      const customerResult = await resend.emails.send({
        from,
        to: safeEmail,
        replyTo: to,
        subject: 'We received your Trueform 3D cart order',
        text: `Hi ${safeName},\n\nThanks for your order from Trueform 3D. We received it successfully.\n\nItems:\n${cartSummary}\n\nTotal: $${total.toFixed(2)}\n\nShipping / delivery address: ${safeAddress}\n\n— Trueform 3D`
      });

      return res.json({ ok: true, message: 'Cart order email accepted for delivery.', emailId: resendResult.data.id, confirmationEmailId: customerResult?.data?.id || null, email: { enabled: true, adminSent: true, customerSent: !!customerResult?.data?.id } });
    }

    const item = catalog.items.find((entry) => entry.id === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const allowedColors = new Set(['Black', 'White', 'Green', 'Orange', 'Yellow', 'Red', 'Hot Pink', 'Cobalt Blue', 'Translucent Blue', 'South Beach', 'Nebulae', 'Rosewood']);
    const noColorItems = new Set(['1017']);

    if (!safeAddress) {
      return res.status(400).json({ error: 'Address is required.' });
    }
    if (!Number.isFinite(loadedAtMs)) {
      return res.status(400).json({ error: 'Form session invalid. Please reopen the order form and try again.' });
    }
    const elapsedMs = Date.now() - loadedAtMs;
    if (elapsedMs < 1500) {
      return res.status(400).json({ error: 'Submission was too fast. Please review your order and try again.' });
    }
    if (elapsedMs > 1000 * 60 * 60) {
      return res.status(400).json({ error: 'This order form expired. Please reopen it and try again.' });
    }
    if (!Number.isInteger(quantityNumber) || quantityNumber < 1 || quantityNumber > 25) {
      return res.status(400).json({ error: 'Quantity must be a whole number between 1 and 25.' });
    }
    if (!noColorItems.has(item.id) && !allowedColors.has(safeColor)) {
      return res.status(400).json({ error: 'Please choose a valid color option.' });
    }
    if (['0909', '0911'].includes(item.id) && !allowedColors.has(safeSecondColor)) {
      return res.status(400).json({ error: 'Please choose a valid second color option.' });
    }

    const unitPrice = typeof item.price === 'number' ? item.price : null;
    const total = unitPrice !== null ? unitPrice * quantityNumber : null;
    const subject = `New order request: ${item.name} (${item.id})`;
    const adminText = [
      'A customer submitted an order request.',
      '',
      `Item: ${item.name}`,
      `Item ID: ${item.id}`,
      `Price: ${unitPrice !== null ? `$${unitPrice.toFixed(2)} each` : 'Not set'}`,
      `Quantity: ${quantityNumber}`,
      `${noColorItems.has(item.id) ? '' : `Color: ${safeColor || 'Not selected'}`}`,
      `${['0909', '0911'].includes(item.id) ? `Second color: ${safeSecondColor || 'Not selected'}` : ''}`,
      `Total: ${total !== null ? `$${total.toFixed(2)}` : 'Not set'}`,
      `Customer name: ${safeName}`,
      `Customer email: ${safeEmail}`,
      `Phone: ${safePhone || 'Not provided'}`,
      `Address: ${safeAddress}`,
      `Notes: ${safeNotes || 'None'}`
    ].filter(Boolean).join('\n');

    const resendResult = await resend.emails.send({ from, to, replyTo: safeEmail, subject, text: adminText });
    if (resendResult?.error || !resendResult?.data?.id) {
      return res.status(500).json({ error: resendResult?.error?.message || 'Unable to send order email.' });
    }

    const customerText = [
      `Hi ${safeName},`,
      '',
      'Thanks for your order request with Trueform 3D. We received it successfully and will follow up soon.',
      '',
      'Order summary',
      `- Item: ${item.name}`,
      `- Item ID: ${item.id}`,
      `- Quantity: ${quantityNumber}`,
      `${noColorItems.has(item.id) ? '' : `- Color: ${safeColor}`}`,
      `${['0909', '0911'].includes(item.id) ? `- Second color: ${safeSecondColor}` : ''}`,
      `- Total: ${total !== null ? `$${total.toFixed(2)}` : 'Pending'}`,
      '',
      `Shipping / delivery address: ${safeAddress}`,
      '',
      'If you included any notes or customization details, we have those too.',
      '',
      'Thank you for supporting Trueform 3D.',
      '',
      '— Trueform 3D'
    ].filter(Boolean).join('\n');

    const customerResult = await resend.emails.send({ from, to: safeEmail, replyTo: to, subject: 'We received your Trueform 3D order request', text: customerText });

    res.json({ ok: true, message: 'Order email accepted for delivery.', emailId: resendResult.data.id, confirmationEmailId: customerResult?.data?.id || null, email: { enabled: true, adminSent: true, customerSent: !!customerResult?.data?.id } });
  } catch (error) {
    console.error('Order processing failed:', error?.message || error);
    res.status(500).json({ error: 'Unable to process the order right now. Please try again shortly.' });
  }
});

app.listen(port, () => {
  console.log(`Tyler brochure app running at http://localhost:${port}`);
});
