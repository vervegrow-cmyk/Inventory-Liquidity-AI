import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RecoveryCartItem, RecoveryOrder, RecoveryMethod, RecoveryStatus } from '../types/recovery';

interface RecoveryState {
  cart: RecoveryCartItem[];
  orders: RecoveryOrder[];
  addToCart: (item: Omit<RecoveryCartItem, 'id' | 'addedAt'>) => string;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  createOrder: (
    item: RecoveryCartItem,
    method: RecoveryMethod,
    address?: string,
    scheduledTime?: string
  ) => RecoveryOrder;
  batchCreateOrders: (
    items: RecoveryCartItem[],
    method: RecoveryMethod,
    address?: string,
    scheduledTime?: string
  ) => RecoveryOrder[];
  updateOrderStatus: (id: string, status: RecoveryStatus, extra?: Partial<RecoveryOrder>) => void;
  removeOrder: (id: string) => void;
}

function genId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

export const useRecoveryStore = create<RecoveryState>()(
  persist(
    (set) => ({
      cart: [],
      orders: [],

      addToCart: (item) => {
        const id = genId();
        set(s => ({ cart: [...s.cart, { ...item, id, addedAt: now() }] }));
        return id;
      },

      removeFromCart: (id) => {
        set(s => ({ cart: s.cart.filter(c => c.id !== id) }));
      },

      clearCart: () => set({ cart: [] }),

      createOrder: (item, method, address, scheduledTime) => {
        const order: RecoveryOrder = {
          id: genId(),
          productName: item.productName,
          productCategory: item.productCategory,
          productBrand: item.productBrand,
          thumbnail: item.thumbnail,
          estimatedPrice: item.estimatedPrice,
          resalePrice: item.resalePrice,
          quickSalePrice: item.quickSalePrice,
          confidence: item.confidence,
          reason: item.reason,
          method,
          status: 'pending',
          address,
          scheduledTime,
          createdAt: now(),
          updatedAt: now(),
        };
        set(s => ({
          orders: [order, ...s.orders],
          cart: s.cart.filter(c => c.id !== item.id),
        }));
        return order;
      },

      batchCreateOrders: (items, method, address, scheduledTime) => {
        const newOrders: RecoveryOrder[] = items.map(item => ({
          id: genId(),
          productName: item.productName,
          productCategory: item.productCategory,
          productBrand: item.productBrand,
          thumbnail: item.thumbnail,
          estimatedPrice: item.estimatedPrice,
          resalePrice: item.resalePrice,
          quickSalePrice: item.quickSalePrice,
          confidence: item.confidence,
          reason: item.reason,
          method,
          status: 'pending' as RecoveryStatus,
          address,
          scheduledTime,
          createdAt: now(),
          updatedAt: now(),
        }));
        const createdIds = new Set(items.map(i => i.id));
        set(s => ({
          orders: [...newOrders, ...s.orders],
          cart: s.cart.filter(c => !createdIds.has(c.id)),
        }));
        return newOrders;
      },

      updateOrderStatus: (id, status, extra = {}) => {
        set(s => ({
          orders: s.orders.map(o =>
            o.id === id ? { ...o, ...extra, status, updatedAt: now() } : o
          ),
        }));
      },

      removeOrder: (id) => {
        set(s => ({ orders: s.orders.filter(o => o.id !== id) }));
      },
    }),
    { name: 'recovery-store-v1' }
  )
);
