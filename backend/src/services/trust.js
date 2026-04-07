const { query, queryOne } = require('../db/pool')

const BORROW_LIMITS = { newcomer:1, regular:3, trusted:5, rep:8 }

function computeTier(returnCount) {
  if (returnCount >= 25) return 'rep'
  if (returnCount >= 10) return 'trusted'
  if (returnCount >= 3)  return 'regular'
  return 'newcomer'
}

async function getActiveBorrowCount(borrowerId) {
  const r = await queryOne(
    "SELECT COUNT(*) as n FROM borrow_requests WHERE borrower_id=$1 AND status IN ('pending','payment_pending','active')",
    [borrowerId]
  )
  return parseInt(r?.n || '0')
}

async function promoteIfEligible(userId) {
  const u = await queryOne('SELECT return_count, trust_tier FROM users WHERE id=$1', [userId])
  if (!u) return null
  const tier = computeTier(u.return_count)
  if (tier !== u.trust_tier) await query('UPDATE users SET trust_tier=$1 WHERE id=$2', [tier, userId])
  return tier
}

module.exports = { BORROW_LIMITS, computeTier, getActiveBorrowCount, promoteIfEligible }
