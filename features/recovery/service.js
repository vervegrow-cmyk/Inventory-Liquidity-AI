// In-memory store for dev server (resets on restart)
const orders = [];

export function createOrder(data) {
  const order = {
    id: crypto.randomUUID(),
    ...data,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orders.push(order);
  return order;
}

export function batchCreateOrders(items, method, address, scheduledTime) {
  return items.map(item => createOrder({ ...item, method, address, scheduledTime }));
}

export function listOrders(status) {
  if (status && status !== 'all') return orders.filter(o => o.status === status);
  return [...orders].reverse();
}

export function updateStatus(id, status, extra = {}) {
  const order = orders.find(o => o.id === id);
  if (!order) return null;
  Object.assign(order, { ...extra, status, updatedAt: new Date().toISOString() });
  return order;
}
