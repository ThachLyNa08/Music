// src/api/payment.js
import api from './axios'

export const paymentApi = {
  getPlans: () => api.get('/payments/plans'),
  createTransaction: (plan_id) => api.post('/payments/sepay/create', { plan_id }),
  getTransactionStatus: (orderCode) => api.get(`/payments/${orderCode}/status`),
  getTransactionHistory: () => api.get('/payments/history')
}
