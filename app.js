const featuredItemsContainer = document.getElementById('featured-items');
const clickerItemsContainer = document.getElementById('clicker-items');
const fidgetItemsContainer = document.getElementById('fidget-items');
const dialog = document.getElementById('order-dialog');
const form = document.getElementById('order-form');
const title = document.getElementById('dialog-title');
const description = document.getElementById('dialog-description');
const itemIdInput = document.getElementById('item-id');
const orderEntryView = document.getElementById('order-entry-view');
const orderSuccessView = document.getElementById('order-success-view');
const successMessage = document.getElementById('success-message');
const successSummary = document.getElementById('success-summary');
const secondColorGroup = document.getElementById('second-color-group');
const orderSubmitButton = document.getElementById('order-submit-button');
const customOrderDialog = document.getElementById('custom-order-dialog');
const customOrderForm = document.getElementById('custom-order-form');
const customOrderEntryView = document.getElementById('custom-order-entry-view');
const customOrderSuccessView = document.getElementById('custom-order-success-view');
const customOrderSuccessMessage = document.getElementById('custom-order-success-message');
const orderOnlyFieldIds = [
  'customer-name-label',
  'customer-email-label',
  'customer-phone-label',
  'customer-address-label',
  'notes-label'
];

const cartDialog = document.getElementById('cart-dialog');
const cartOverlay = document.getElementById('cart-overlay');
const cartForm = document.getElementById('cart-form');
const cartItemsContainer = document.getElementById('cart-items');
const cartEmptyState = document.getElementById('cart-empty-state');
const cartTotalEl = document.getElementById('cart-total');
const cartSummaryEl = document.getElementById('cart-summary');
const cartSuccessView = document.getElementById('cart-success-view');
const cartEntryView = document.getElementById('cart-entry-view');
const cartSuccessMessage = document.getElementById('cart-success-message');
const cartSuccessSummary = document.getElementById('cart-success-summary');
const openCartButton = document.getElementById('open-cart-button');

const clickerIds = new Set(['0913', '0916', '0918', '0932', '0936', '0940', '0941', '0942', '1001']);
const cart = [];

let catalog;
let orderMode = 'order';

document.getElementById('cancel-button').addEventListener('click', () => dialog.close());
document.getElementById('done-button').addEventListener('click', () => dialog.close());
document.getElementById('open-cart-button').addEventListener('click', openCart);
document.getElementById('open-custom-order-button')?.addEventListener('click', openCustomOrder);
document.getElementById('cancel-custom-order-button')?.addEventListener('click', () => customOrderDialog.close());
document.getElementById('done-custom-order-button')?.addEventListener('click', () => customOrderDialog.close());
document.getElementById('close-cart-button').addEventListener('click', closeCart);
document.getElementById('cart-done-button').addEventListener('click', closeCart);
cartOverlay?.addEventListener('click', closeCart);

loadCatalog();

async function loadCatalog() {
  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const data = await response.json();
    catalog = data;

    const taglineEl = document.getElementById('tagline');
    if (taglineEl) taglineEl.textContent = data.tagline || '';

    renderFeaturedItems(data.items);

    for (const item of data.items) {
      renderItem(item);
    }

    renderCart();
  } catch (error) {
    console.error('Failed to load catalog:', error);
  }
}

function renderFeaturedItems(items) {
  if (!featuredItemsContainer) return;

  featuredItemsContainer.innerHTML = '';
  const featured = items.filter((item) => !item.placeholder).slice(0, 4);
  for (const item of featured) {
    const card = createItemCard(item);
    featuredItemsContainer.appendChild(card);
  }
}

function renderItem(item) {
  const card = createItemCard(item);
  getContainerForItem(item.id)?.appendChild(card);
}

function createItemCard(item) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.itemId = item.id;

  const formattedPrice = typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : '';
  const descriptionMarkup = item.description ? `<p>${escapeHtml(item.description)}</p>` : '';

  const badges = [];
  if (item.video) badges.push('Video');
  if (item.placeholder) badges.push('Placeholder');
  if (['0909', '0911'].includes(item.id)) badges.push('2 Colors');
  if (['1012', '1013'].includes(item.id)) badges.push('Seasonal');
  if (['1001', '1011', '1012', '1013'].includes(item.id)) badges.push('New');

  const badgeMarkup = badges.length
    ? `<div class="badge-row">${badges.map((badge) => `<span class="card-badge">${badge}</span>`).join('')}</div>`
    : '';

  const mediaMarkup = buildMediaMarkup(item);
  const colorOptionsMarkup = item.noColor
    ? ''
    : `
      <div class="color-options">
        <div class="color-options-label">Colors available</div>
        <div class="swatch-row" aria-label="Available colors">
          <span class="swatch swatch-black" title="Black"></span>
          <span class="swatch swatch-white" title="White"></span>
          <span class="swatch swatch-green" title="Green"></span>
          <span class="swatch swatch-orange" title="Orange"></span>
          <span class="swatch swatch-red" title="Red"></span>
          <span class="swatch-more" title="More colors available">+7 more</span>
        </div>
      </div>
    `;

  card.innerHTML = `
    ${mediaMarkup}
    ${badgeMarkup}
    <div class="item-meta-row">
      <div class="item-meta">Item #${escapeHtml(item.id)}</div>
      <div class="price-badge">${formattedPrice}</div>
    </div>
    <h3>${escapeHtml(item.name)}</h3>
    ${descriptionMarkup}
    ${colorOptionsMarkup}
    <div class="card-action-stack">
      <button type="button" class="secondary add-to-cart-button">Add to Cart</button>
      <button type="button" class="order-now-button">Order now</button>
    </div>
  `;

  const preview = card.querySelector('[data-fallback-media]');
  if (preview) {
    preview.addEventListener('error', () => {
      preview.replaceWith(createFallbackImage(item.name));
    });
  }

  card.querySelector('.add-to-cart-button').addEventListener('click', () => openOrder(item, 'cart'));
  card.querySelector('.order-now-button').addEventListener('click', () => openOrder(item));
  return card;
}

function buildMediaMarkup(item) {
  if (item.video && !item.placeholder) {
    return `<video class="thumb thumb-contain" src="${item.video}" autoplay muted loop playsinline preload="metadata" data-fallback-media></video>`;
  }

  return `<img class="thumb thumb-contain" src="${item.image}" alt="${escapeHtml(item.name)}" data-fallback-media />`;
}

function createFallbackImage(name) {
  const img = document.createElement('img');
  img.className = 'thumb thumb-contain';
  img.src = './items/placeholder.svg';
  img.alt = `${name} placeholder`;
  return img;
}

function getContainerForItem(itemId) {
  if (clickerIds.has(itemId)) return clickerItemsContainer;
  return fidgetItemsContainer;
}

function addToCart(item, options = {}) {
  const quantity = Math.max(1, Number(options.quantity) || 1);
  const color = item.noColor ? '' : (options.color || 'Black');
  const secondColor = ['0909', '0911'].includes(item.id) ? (options.secondColor || 'Black') : '';

  const existing = cart.find((entry) => (
    entry.item.id === item.id &&
    (entry.color || '') === color &&
    (entry.secondColor || '') === secondColor
  ));

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ item, quantity, color, secondColor });
  }

  renderCart();
  openCart();
}

function renderCart() {
  cartItemsContainer.innerHTML = '';

  const itemCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);
  if (openCartButton) {
    openCartButton.textContent = itemCount > 0 ? `Cart (${itemCount})` : 'Cart';
  }


  if (cart.length === 0) {
    cartEmptyState.hidden = false;
    cartItemsContainer.hidden = true;
    if (cartSummaryEl) cartSummaryEl.textContent = 'Your cart is empty.';
    cartTotalEl.textContent = '$0.00';
    return;
  }

  cartEmptyState.hidden = true;
  cartItemsContainer.hidden = false;

  for (const entry of cart) {
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    const price = Number(entry.item.price || 0);
    const lineTotal = price * entry.quantity;

    row.innerHTML = `
      <div>
        <div class="cart-item-name">${escapeHtml(entry.item.name)}</div>
        <div class="cart-item-meta">Item #${escapeHtml(entry.item.id)} • $${price.toFixed(2)} each</div>
        ${entry.color ? `<div class="cart-item-meta">Color: ${escapeHtml(entry.color)}</div>` : ''}
        ${entry.secondColor ? `<div class="cart-item-meta">Second color: ${escapeHtml(entry.secondColor)}</div>` : ''}
      </div>
      <div class="cart-item-controls">
        <button type="button" class="secondary cart-minus">−</button>
        <span>${entry.quantity}</span>
        <button type="button" class="secondary cart-plus">+</button>
        <strong>$${lineTotal.toFixed(2)}</strong>
        <button type="button" class="secondary cart-remove">Remove</button>
      </div>
    `;

    row.querySelector('.cart-minus').addEventListener('click', () => changeCartQuantity(entry, -1));
    row.querySelector('.cart-plus').addEventListener('click', () => changeCartQuantity(entry, 1));
    row.querySelector('.cart-remove').addEventListener('click', () => removeFromCart(entry));

    cartItemsContainer.appendChild(row);
  }

  const total = getCartTotal();
  cartTotalEl.textContent = `$${total.toFixed(2)}`;
  if (cartSummaryEl) cartSummaryEl.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'} in cart • $${total.toFixed(2)}`;
}

function changeCartQuantity(targetEntry, delta) {
  const entry = cart.find((item) => item === targetEntry);
  if (!entry) return;
  entry.quantity += delta;
  if (entry.quantity <= 0) {
    removeFromCart(targetEntry);
    return;
  }
  renderCart();
}

function removeFromCart(targetEntry) {
  const index = cart.findIndex((entry) => entry === targetEntry);
  if (index >= 0) {
    cart.splice(index, 1);
    renderCart();
  }
}

function getCartTotal() {
  return cart.reduce((sum, entry) => sum + Number(entry.item.price || 0) * entry.quantity, 0);
}

function openCart() {
  cartEntryView.hidden = false;
  cartSuccessView.hidden = true;
  renderCart();

  try {
    if (dialog.open) dialog.close();
  } catch (error) {
    console.warn('Unable to close order dialog before opening cart:', error);
  }

  if (cartOverlay) cartOverlay.hidden = false;
  cartDialog.hidden = false;
}

function closeCart() {
  if (cartOverlay) cartOverlay.hidden = true;
  cartDialog.hidden = true;
}

window.__openCart = openCart;
window.__closeCart = closeCart;

function openCustomOrder() {
  customOrderEntryView.hidden = false;
  customOrderSuccessView.hidden = true;
  customOrderSuccessMessage.textContent = 'Thank you for submitting your request! We look forward to working with you on this project! We will email you shortly to finalize your request!';
  customOrderForm.reset();
  customOrderDialog.showModal();
}

function openOrder(item, mode = 'order') {
  orderMode = mode;
  title.textContent = `${mode === 'cart' ? 'Add' : 'Order'} ${item.name}`;
  orderSubmitButton.textContent = mode === 'cart' ? 'Add to Cart' : 'Order Now';
  const formattedPrice = typeof item.price === 'number' ? ` — $${item.price.toFixed(2)}` : '';
  description.textContent = `Item #${item.id}${formattedPrice}${item.description ? ` — ${item.description}` : ''}`;
  itemIdInput.value = item.id;
  document.getElementById('form-loaded-at').value = String(Date.now());
  secondColorGroup.hidden = !['0909', '0911'].includes(item.id);
  document.querySelector('.color-picker').hidden = !!item.noColor;
  orderEntryView.hidden = false;
  orderSuccessView.hidden = true;
  successMessage.textContent = '';
  successSummary.innerHTML = '';
  form.reset();
  document.getElementById('quantity').value = '1';

  for (const field of [
    'customer-name',
    'customer-email',
    'customer-address',
    'customer-phone',
    'notes',
    'website'
  ]) {
    const el = document.getElementById(field);
    if (!el) continue;
    if (mode === 'cart') {
      el.dataset.wasRequired = el.required ? 'true' : 'false';
      el.required = false;
    } else {
      el.required = el.dataset.wasRequired === 'true';
    }
  }

  for (const fieldId of orderOnlyFieldIds) {
    const field = document.getElementById(fieldId);
    if (field) field.hidden = mode === 'cart';
  }

  dialog.showModal();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    itemId: itemIdInput.value,
    customerName: document.getElementById('customer-name').value,
    customerEmail: document.getElementById('customer-email').value,
    phone: document.getElementById('customer-phone').value,
    address: document.getElementById('customer-address').value,
    quantity: document.getElementById('quantity').value,
    color: catalog.items.find((entry) => entry.id === itemIdInput.value)?.noColor
      ? ''
      : (document.querySelector('input[name="color"]:checked')?.value || 'Black'),
    secondColor: ['0909', '0911'].includes(itemIdInput.value)
      ? (document.querySelector('input[name="second-color"]:checked')?.value || 'Black')
      : '',
    website: document.getElementById('website').value,
    formLoadedAt: document.getElementById('form-loaded-at').value,
    notes: document.getElementById('notes').value
  };

  const selectedItem = catalog.items.find((entry) => entry.id === payload.itemId);

  if (orderMode === 'cart') {
    dialog.close();
    addToCart(selectedItem, {
      quantity: payload.quantity,
      color: payload.color,
      secondColor: payload.secondColor
    });
    form.reset();
    orderMode = 'order';
    orderSubmitButton.textContent = 'Order Now';
    for (const fieldId of orderOnlyFieldIds) {
      const field = document.getElementById(fieldId);
      if (field) field.hidden = false;
    }
    return;
  }

  const response = await fetch('/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    alert(result.error || 'Something went wrong.');
    return;
  }

  const unitPrice = typeof selectedItem?.price === 'number' ? selectedItem.price : null;
  const total = unitPrice !== null ? unitPrice * Number(payload.quantity) : null;

  successMessage.textContent = `Order saved locally as ${result.savedTo}.`;
  const secondColorMarkup = payload.secondColor ? `<div><strong>Second color:</strong> ${escapeHtml(payload.secondColor)}</div>` : '';
  const colorMarkup = payload.color ? `<div><strong>Color:</strong> ${escapeHtml(payload.color)}</div>` : '';
  successSummary.innerHTML = `
    <div><strong>Item:</strong> ${escapeHtml(selectedItem?.name || payload.itemId)}</div>
    <div><strong>Quantity:</strong> ${escapeHtml(String(payload.quantity))}</div>
    ${colorMarkup}
    ${secondColorMarkup}
    <div><strong>Total:</strong> ${total !== null ? `$${total.toFixed(2)}` : 'Pending'}</div>
    <div><strong>Reply email:</strong> ${escapeHtml(payload.customerEmail)}</div>
    <div><strong>Address:</strong> ${escapeHtml(payload.address)}</div>
    <div><strong>Local order id:</strong> ${escapeHtml(result.orderId || '')}</div>
  `;

  orderEntryView.hidden = true;
  orderSuccessView.hidden = false;
  form.reset();
  orderMode = 'order';
  orderSubmitButton.textContent = 'Order Now';
  for (const fieldId of orderOnlyFieldIds) {
    const field = document.getElementById(fieldId);
    if (field) field.hidden = false;
  }
});
cartForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (cart.length === 0) {
    alert('Your cart is empty.');
    return;
  }

  const payload = {
    cart: cart.map((entry) => ({
      itemId: entry.item.id,
      name: entry.item.name,
      quantity: entry.quantity,
      price: entry.item.price,
      color: entry.color || '',
      secondColor: entry.secondColor || '',
      lineTotal: Number(entry.item.price || 0) * entry.quantity
    })),
    customerName: document.getElementById('cart-customer-name').value,
    customerEmail: document.getElementById('cart-customer-email').value,
    phone: document.getElementById('cart-customer-phone').value,
    address: document.getElementById('cart-customer-address').value,
    notes: document.getElementById('cart-notes').value,
    total: getCartTotal(),
    kind: 'cart-checkout'
  };

  try {
    const response = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    const total = getCartTotal();
    const itemSummary = cart.map((entry) => {
      const options = [entry.color, entry.secondColor].filter(Boolean).join(' / ');
      return `${escapeHtml(entry.item.name)} × ${entry.quantity}${options ? ` (${escapeHtml(options)})` : ''}`;
    }).join(', ');

    const emailStatus = result.email?.enabled
      ? (result.email?.adminSent
        ? 'Order notification email sent successfully.'
        : 'Order saved, but notification email did not send.')
      : 'Order saved locally. Email sending is not configured yet.';

    cartSuccessMessage.textContent = `${emailStatus} Saved locally as ${result.savedTo}.`;
    cartSuccessSummary.innerHTML = `
      <div><strong>Items:</strong> ${itemSummary}</div>
      <div><strong>Total:</strong> $${total.toFixed(2)}</div>
      <div><strong>Reply email:</strong> ${escapeHtml(payload.customerEmail)}</div>
      <div><strong>Address:</strong> ${escapeHtml(payload.address)}</div>
      <div><strong>Local order id:</strong> ${escapeHtml(result.orderId || '')}</div>
    `;

    cartEntryView.hidden = true;
    cartSuccessView.hidden = false;
    cart.length = 0;
    renderCart();
    cartForm.reset();
  } catch (error) {
    console.error('Cart checkout failed:', error);
    alert('Checkout failed. Please try again.');
  }
});

customOrderForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    kind: 'custom-order',
    customerName: document.getElementById('custom-customer-name').value,
    customerEmail: document.getElementById('custom-customer-email').value,
    phone: document.getElementById('custom-customer-phone').value,
    contactPreference: document.getElementById('custom-contact-preference').value,
    size: document.getElementById('custom-size').value,
    quantity: document.getElementById('custom-quantity').value,
    budget: document.getElementById('custom-budget').value,
    description: document.getElementById('custom-request-description').value,
    address: 'Custom order inquiry'
  };

  try {
    const response = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    customOrderSuccessMessage.textContent = 'Thank you for submitting your request! We look forward to working with you on this project! We will email you shortly to finalize your request!';
    customOrderEntryView.hidden = true;
    customOrderSuccessView.hidden = false;
    customOrderForm.reset();
  } catch (error) {
    console.error('Custom order failed:', error);
    alert('Custom order request failed. Please try again.');
  }
});

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
