const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const nodemailer = require('nodemailer');

const root = __dirname;
const ordersDir = path.join(root, 'orders');
const catalogPath = path.join(root, 'catalog.json');
const envPath = path.join(root, '.env');
const port = Number(process.env.PORT || 8000);

loadEnvFile(envPath);
fs.mkdirSync(ordersDir, { recursive: true });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8'
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/catalog') {
    return sendFile(res, catalogPath);
  }

  if (req.method === 'POST' && url.pathname === '/api/order') {
    try {
      const body = await readJsonBody(req);
      const validation = validateOrder(body);
      if (!validation.ok) {
        return sendJson(res, 400, { error: validation.error });
      }

      const timestamp = new Date().toISOString();
      const orderId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const record = {
        orderId,
        savedAt: timestamp,
        source: 'local-recovered-app',
        ...body
      };

      fs.writeFileSync(path.join(ordersDir, `${orderId}.json`), JSON.stringify(record, null, 2));

      const emailResult = await sendOrderEmails(record);

      return sendJson(res, 200, {
        ok: true,
        orderId,
        message: 'Order saved locally.',
        savedTo: `orders/${orderId}.json`,
        email: emailResult
      });
    } catch (error) {
      console.error('Order save failed:', error);
      return sendJson(res, 500, { error: 'Failed to save order locally.' });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/orders') {
    const files = fs.readdirSync(ordersDir).filter((name) => name.endsWith('.json')).sort().reverse();
    const orders = files.map((file) => JSON.parse(fs.readFileSync(path.join(ordersDir, file), 'utf8')));
    return sendJson(res, 200, { count: orders.length, orders });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(root, requestedPath.replace(/^\/+/, ''));

  if (!filePath.startsWith(root)) {
    return sendJson(res, 403, { error: 'Forbidden.' });
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sendFile(res, filePath, req.method === 'HEAD');
  }

  return sendJson(res, 404, { error: 'Not found.' });
}).listen(port, () => {
  console.log(`Trueform 3D recovered app running at http://localhost:${port}`);
});

function sendFile(res, filePath, headOnly = false) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  if (headOnly) {
    return res.end();
  }
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload, null, 2));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function validateOrder(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid payload.' };

  const customerName = String(body.customerName || body.name || '').trim();
  const customerEmail = String(body.customerEmail || body.email || '').trim();
  const address = String(body.address || body.customerAddress || '').trim();

  if (!customerName) return { ok: false, error: 'Customer name is required.' };
  if (!customerEmail) return { ok: false, error: 'Customer email is required.' };
  if (!address) return { ok: false, error: 'Address is required.' };

  if (Array.isArray(body.cart)) {
    if (body.cart.length === 0) return { ok: false, error: 'Cart is empty.' };
    for (const entry of body.cart) {
      if (!String(entry.itemId || '').trim()) return { ok: false, error: 'Each cart item needs an item id.' };
      const quantity = Number(entry.quantity);
      if (!Number.isFinite(quantity) || quantity < 1) {
        return { ok: false, error: 'Each cart item quantity must be at least 1.' };
      }
    }
    return { ok: true };
  }

  if (!String(body.itemId || '').trim()) return { ok: false, error: 'Item is required.' };
  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) return { ok: false, error: 'Quantity must be at least 1.' };
  return { ok: true };
}

async function sendOrderEmails(order) {
  const transporter = createMailer();
  if (!transporter) {
    return {
      enabled: false,
      reason: 'SMTP not configured'
    };
  }

  const adminTo = process.env.ORDER_NOTIFY_TO || 'tylercgady@gmail.com';
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const customerEmail = String(order.customerEmail || order.email || '').trim();
  const customerName = String(order.customerName || order.name || 'Customer').trim();

  const summaryText = formatOrderSummaryText(order);
  const adminSubject = Array.isArray(order.cart)
    ? `New Trueform 3D cart order #${order.orderId}`
    : `New Trueform 3D order #${order.orderId}`;
  const customerSubject = `Your Trueform 3D order confirmation (#${order.orderId})`;

  const result = {
    enabled: true,
    adminSent: false,
    customerSent: false,
    customerConfirmationEnabled: false
  };

  await transporter.sendMail({
    from,
    to: adminTo,
    replyTo: customerEmail || undefined,
    subject: adminSubject,
    text: `A new Trueform 3D order was submitted.\n\n${summaryText}`
  });
  result.adminSent = true;

  return result;
}

function createMailer() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user, pass }
  });
}

function formatOrderSummaryText(order) {
  const lines = [
    `Order ID: ${order.orderId}`,
    `Saved At: ${order.savedAt}`,
    `Customer Name: ${order.customerName || order.name || ''}`,
    `Customer Email: ${order.customerEmail || order.email || ''}`,
    `Phone: ${order.phone || ''}`,
    `Address: ${order.address || order.customerAddress || ''}`,
    `Notes: ${order.notes || ''}`
  ];

  if (Array.isArray(order.cart)) {
    lines.push('', 'Items:');
    for (const entry of order.cart) {
      const options = [entry.color, entry.secondColor].filter(Boolean).join(' / ');
      lines.push(
        `- ${entry.name || entry.itemId} (Item #${entry.itemId}) x ${entry.quantity} @ $${Number(entry.price || 0).toFixed(2)}${options ? ` | ${options}` : ''}`
      );
    }
    lines.push(``, `Cart Total: $${Number(order.total || 0).toFixed(2)}`);
  } else {
    const options = [order.color, order.secondColor].filter(Boolean).join(' / ');
    lines.push(
      '',
      `Item: ${order.itemId}`,
      `Quantity: ${order.quantity}`,
      `Colors: ${options || 'N/A'}`
    );
  }

  return lines.join('\n');
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
