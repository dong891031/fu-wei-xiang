const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const storage = new Map();
const context = vm.createContext({
  document: { getElementById: () => null, querySelectorAll: () => [] },
  confirm: () => true,
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  },
  console
});
vm.runInContext(script, context);

test('combo quantity includes different seasoning choices', () => {
  const result = vm.runInContext(`calculateOrder([
    { id: 'wing', name: '三節翅', price: 25, qty: 2, isCombo: true, comboQty: 5, comboPrice: 100 },
    { id: 'wing', name: '三節翅', price: 25, qty: 3, isCombo: true, comboQty: 5, comboPrice: 100 },
    { id: 'drum', name: '小棒腿', price: 15, qty: 6, isCombo: true, comboQty: 7, comboPrice: 100 }
  ])`, context);
  assert.equal(result.total, 190);
  assert.equal(result.discounts.length, 1);
  assert.equal(result.discounts[0].amount, 25);
});

test('multiple sets and leftover items use the correct total', () => {
  const result = vm.runInContext(`calculateOrder([
    { id: 'drum', name: '小棒腿', price: 15, qty: 8, isCombo: true, comboQty: 7, comboPrice: 100 },
    { id: 'drum', name: '小棒腿', price: 15, qty: 7, isCombo: true, comboQty: 7, comboPrice: 100 }
  ])`, context);
  assert.equal(result.total, 215);
  assert.equal(result.discounts[0].amount, 10);
});

test('reordering refreshes the current menu price', () => {
  storage.set('fws_order_history', JSON.stringify([{
    cart: [{ id: 'wing', size: null, qty: 5, price: 1, optRaw: ['胡椒'], _key: 'old' }]
  }]));
  vm.runInContext('loadHistoryOrder(0)', context);
  const result = vm.runInContext('({ price: cart[0].price, total: calculateOrder(cart).total })', context);
  assert.equal(result.price, 25);
  assert.equal(result.total, 100);
});

test('cart keys ignore the order of seasoning selections', () => {
  const equal = vm.runInContext(`cartItemKey('wing', null, ['胡椒', '梅粉']) ===
    cartItemKey('wing', null, ['梅粉', '胡椒'])`, context);
  assert.equal(equal, true);
});

test('all referenced menu photos exist', () => {
  const photos = vm.runInContext('Object.values(PHOTOS)', context);
  for (const photo of photos) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', photo)));
  }
});

test('deleting one history entry preserves other entries and the cart', () => {
  storage.set('fws_order_history', JSON.stringify([
    { timestamp: '2026-09-29T12:00:00Z', cart: [] },
    { timestamp: '2026-09-28T12:00:00Z', cart: [] }
  ]));
  const previousCart = vm.runInContext('cart', context);
  vm.runInContext('removeHistoryOrder(0)', context);
  const history = JSON.parse(storage.get('fws_order_history'));
  assert.equal(history.length, 1);
  assert.equal(history[0].timestamp, '2026-09-28T12:00:00Z');
  assert.equal(vm.runInContext('cart', context), previousCart);
});

test('history view shows delete and clear controls when entries exist', () => {
  storage.set('fws_order_history', JSON.stringify([{
    timestamp: '2026-09-29T12:00:00Z', total: 100,
    cart: [{ name: '三節翅', nameEn: 'Wings', qty: 5, size: null }]
  }]));
  const elements = new Map([
    ['history-list', { innerHTML: '' }],
    ['history-clear-btn', { style: {} }],
    ['history-note', { style: {} }]
  ]);
  context.document.getElementById = id => elements.get(id) || null;
  vm.runInContext('renderHistory()', context);
  assert.match(elements.get('history-list').innerHTML, /removeHistoryOrder\(0\)/);
  assert.equal(elements.get('history-clear-btn').style.display, 'block');
  assert.equal(elements.get('history-note').style.display, 'block');
  context.document.getElementById = () => null;
});

test('cancelled delete keeps history; clearing removes only history', () => {
  context.confirm = () => false;
  vm.runInContext('removeHistoryOrder(0)', context);
  assert.equal(JSON.parse(storage.get('fws_order_history')).length, 1);
  context.confirm = () => true;
  storage.set('fws_customer_info', JSON.stringify({ pickup: '15' }));
  vm.runInContext('clearOrderHistory()', context);
  assert.equal(storage.has('fws_order_history'), false);
  assert.equal(storage.has('fws_customer_info'), true);
});

test('reordering an unavailable product never clears the current cart', () => {
  storage.set('fws_order_history', JSON.stringify([{
    cart: [{ id: 'discontinued', qty: 1, optRaw: [] }]
  }]));
  const previousCart = vm.runInContext('cart', context);
  vm.runInContext('loadHistoryOrder(0)', context);
  assert.equal(vm.runInContext('cart', context), previousCart);
});

test('reorder asks before replacing a nonempty cart', () => {
  storage.set('fws_order_history', JSON.stringify([{
    cart: [{ id: 'wing', size: null, qty: 5, optRaw: ['胡椒'] }]
  }]));
  context.confirm = () => false;
  const previousCart = vm.runInContext('cart', context);
  vm.runInContext('loadHistoryOrder(0)', context);
  assert.equal(vm.runInContext('cart', context), previousCart);
  context.confirm = () => true;
});
