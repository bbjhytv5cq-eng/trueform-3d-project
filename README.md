# Trueform 3D Desktop Copy

This folder is a standalone local copy of the Trueform 3D app.

## What it does

- serves the storefront locally
- loads product data from `catalog.json`
- serves media from `items/`
- saves submitted orders into `orders/`
- emails order details to `tylercgady@gmail.com`
- customer confirmation emails are currently disabled

## Run locally

```bash
cd /Users/tylergady/Desktop/trueform-3d-project
npm install
npm start
```

Then open:

- `http://localhost:8000`

## Email setup

The app is currently set to send one email on order submission:

1. **Admin notification** → sent to `tylercgady@gmail.com`

Customer confirmation emails are currently disabled.

To enable sending, create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Then fill in:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `ORDER_NOTIFY_TO`

## Important files

- `index.html` — page structure
- `styles.css` — styling
- `app.js` — browser behavior/cart flow
- `server.js` — local server + order saving + email sending
- `catalog.json` — product catalog
- `items/` — product images/videos
- `orders/` — saved order JSON files

## Portability

This folder is intended to be portable to another computer.

On another machine:
1. copy the folder over
2. install Node.js
3. run `npm install`
4. create `.env`
5. run `npm start`

## Current email behavior in code

In `server.js`, order submission currently:
- saves the order locally
- sends an order email to `tylercgady@gmail.com`
- does not send a customer confirmation email

If emails are not sending, the usual cause is missing or incorrect SMTP settings in `.env`.

Current sender configured locally:
- `jacobgady@gmail.com`

Current notification recipient:
- `tylercgady@gmail.com`
