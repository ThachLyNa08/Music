// src/api/payment.js
import api from './axios'

export const paymentApi = {
  getPlans: () => api.get('/payments/plans'),
  createTransaction: (plan_id) => api.post('/payments/sepay/create', { plan_id }),
  getTransactionStatus: (orderCode) => api.get(`/payments/${orderCode}/status`, { params: { t: Date.now() } }),
  getTransactionHistory: () => api.get('/payments/history', { params: { _t: Date.now() } }),
  getMyPremium: () => api.get('/payments/my-premium', { params: { _t: Date.now() } }),
  cancelTransaction: (orderCode) => api.patch(`/payments/${orderCode}/cancel`)
}
