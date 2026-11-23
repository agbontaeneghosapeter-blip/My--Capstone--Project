export function el(tag, props = {}, children) {
  const node = document.createElement(tag);
  const items = children === undefined
    ? []
    : (Array.isArray(children) ? children : [children]);

  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'className') {
      node.className = value;
    } else if (name === 'text') {
      node.textContent = String(value);
    } else if (name.startsWith('on') && typeof value === 'function') {
      node.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (name === 'dataset' && typeof value === 'object') {
      for (const [key, dataValue] of Object.entries(value)) {
        node.dataset[key] = String(dataValue);
      }
    } else if (name in node) {
      node[name] = value;
    } else {
      node.setAttribute(name, String(value));
    }
  }

  for (const child of items) {
    if (child === undefined || child === null || child === false) continue;
    node.appendChild(typeof child === 'string' || typeof child === 'number'
      ? document.createTextNode(String(child))
      : child);
  }
  return node;
}

export function formatPriceCents(priceCents) {
  const safePrice = Number.isSafeInteger(priceCents) ? priceCents : 0;
  const naira = safePrice / 100;
  return `₦${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: safePrice % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(naira)}`;
}
