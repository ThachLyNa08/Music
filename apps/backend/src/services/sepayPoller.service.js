const { reconcilePendingSepayPayments } = require('./payment.service');

let pollerInterval = null;
let isReconciling = false;

function startSepayPendingPoller(io) {
  if (process.env.SEPAY_ENABLE_PENDING_POLLER !== 'true') {
    console.log('[SEPAY_POLLER] Sepay pending poller disabled. Set SEPAY_ENABLE_PENDING_POLLER=true to enable.');
    return;
  }

  if (!process.env.SEPAY_API_TOKEN) {
    console.warn('[SEPAY_POLLER] SEPAY_API_TOKEN is missing. Poller disabled.');
    return;
  }

  const intervalMs = parseInt(process.env.SEPAY_PENDING_POLLER_INTERVAL_MS || '15000', 10);
  console.log(`[SEPAY_POLLER] Sepay pending poller started (interval: ${intervalMs}ms).`);

  pollerInterval = setInterval(async () => {
    if (isReconciling) return;
    isReconciling = true;

    try {
      const result = await reconcilePendingSepayPayments({
        hours: process.env.SEPAY_FALLBACK_LOOKBACK_HOURS ? Number(process.env.SEPAY_FALLBACK_LOOKBACK_HOURS) : 24,
        includeClosed: false,
        io
      });

      if (result && result.results && result.results.some(r => r.result === 'paid' || r.result === 'recovered')) {
        console.log(`[SEPAY_POLLER] Reconciled: ${JSON.stringify(result.results.filter(r => r.result === 'paid' || r.result === 'recovered'))}`);
      }
    } catch (error) {
      console.error('[SEPAY_POLLER_ERROR]', error.message);
    } finally {
      isReconciling = false;
    }
  }, intervalMs);
}

function stopSepayPendingPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log('[SEPAY_POLLER] Sepay pending poller stopped.');
  }
}

module.exports = {
  startSepayPendingPoller,
  stopSepayPendingPoller
};
