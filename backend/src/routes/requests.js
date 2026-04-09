const express = require('express')
const { query, queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const { BORROW_LIMITS, getActiveBorrowCount, promoteIfEligible } = require('../services/trust')

const router = express.Router()

const REQUEST_JOIN = `
  SELECT
    br.*,
    i.title AS item_title, i.category AS item_category,i.listing_type,
    i.is_paid, i.price_per_day, i.images AS item_images,
    borrower.name AS borrower_name, borrower.avatar AS borrower_avatar, borrower.color AS borrower_color,
    owner.name AS owner_name
  FROM borrow_requests br
  JOIN items   i        ON br.item_id    = i.id
  JOIN users   borrower ON br.borrower_id= borrower.id
  JOIN users   owner    ON br.owner_id   = owner.id
`

// GET /api/requests/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const reqs = await query(
      REQUEST_JOIN + ' WHERE (br.borrower_id=$1 OR br.owner_id=$1) ORDER BY br.requested_at DESC',
      [req.userId]
    )
    res.json({ requests: reqs })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// POST /api/requests  — create a borrow request
router.post('/', requireAuth, async (req, res) => {
  try {
    const { itemId, requestedDays, message } = req.body
    const borrower = await queryOne('SELECT * FROM users WHERE id=$1', [req.userId])
    const item     = await queryOne('SELECT * FROM items WHERE id=$1', [itemId])

    if (!item)                        return res.status(404).json({ error: 'Item not found.' })
    if (!borrower.is_verified)        return res.status(403).json({ error: 'Verify your account first.' })
    if (item.status !== 'available')  return res.status(409).json({ error: 'Item is not available.' })
    if (item.owner_id === req.userId) return res.status(400).json({ error: 'Cannot borrow your own item.' })
    if (item.college_id !== req.collegeId) return res.status(403).json({ error: 'Item belongs to another college.' })

    const days  = Math.min(parseInt(requestedDays), item.max_borrow_days)
    const limit = BORROW_LIMITS[borrower.trust_tier] || 1
    const active= await getActiveBorrowCount(req.userId)
    if (active >= limit)
      return res.status(429).json({ error: `Borrow limit reached (${limit} for ${borrower.trust_tier} tier).` })

    const total  = item.is_paid ? parseFloat(item.price_per_day) * days : 0
    // Paid items start as payment_pending; free items start as pending
    const status = 'pending'

    const req_ = await queryOne(`
      INSERT INTO borrow_requests(item_id,borrower_id,owner_id,requested_days,message,status,total_amount)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [itemId, req.userId, item.owner_id, days, message||'', status, total])

    res.status(201).json({ request: req_, totalAmount: total, isPaid: item.is_paid })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to send request.' }) }
})

// PATCH /api/requests/:id/confirm-payment  — borrower marks payment as sent
router.patch('/:id/confirm-payment', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])

    if (!r) return res.status(404).json({ error: 'Not found.' })

    // 🔥 ONLY selected borrower can confirm payment
    if (r.status !== 'selected') {
      return res.status(409).json({ error: 'Not in selected state.' })
    }

    await query(
      "UPDATE borrow_requests SET payment_confirmed=TRUE WHERE id=$1",
      [r.id]
    )

    res.json({ success: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})
// PATCH /api/requests/:id/finalize  — owner confirms payment & gives item
router.patch('/:id/finalize', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])

    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })

    // 🔥 must be selected + payment done
    if (r.status !== 'selected' || !r.payment_confirmed) {
      return res.status(409).json({ error: 'Payment not confirmed yet.' })
    }

    const dueAt = new Date(Date.now() + r.requested_days * 864e5)

    // 1️⃣ mark this request active
    await query(
      "UPDATE borrow_requests SET status='active', due_at=$1 WHERE id=$2",
      [dueAt, r.id]
    )

    // 2️⃣ mark item borrowed
    await query(
      "UPDATE items SET status='borrowed' WHERE id=$1",
      [item.id]
    )

    // 3️⃣ 🔥 decline ALL other requests
    await query(
      `UPDATE borrow_requests 
       SET status='declined' 
       WHERE item_id=$1 AND id<>$2 AND status IN ('pending','selected')`,
      [item.id, r.id]
    )

    res.json({ success: true, dueAt })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

router.patch('/:id/approve', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])

    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })

    // 🔥 ONLY allow from pending
    if (r.status !== 'pending') {
      return res.status(409).json({ error: 'Request not in pending state.' })
    }

    // 🔥 STEP 1: mark as selected
    await query(
      "UPDATE borrow_requests SET status='selected', approved_at=NOW() WHERE id=$1",
      [r.id]
    )

    return res.json({ success: true, stage: 'selected' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})
// PATCH /api/requests/:id/decline
router.patch('/:id/decline', requireAuth, async (req, res) => {
  try {
    const r    = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])
    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    await query("UPDATE borrow_requests SET status='declined' WHERE id=$1", [r.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/return  — owner confirms return
router.patch('/:id/return', requireAuth, async (req, res) => {
  try {
    const r    = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])
    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (!['active','overdue'].includes(r.status)) return res.status(409).json({ error: 'Item not currently borrowed.' })

    const onTime = new Date() <= new Date(r.due_at)
    await query("UPDATE borrow_requests SET status='returned',returned_at=NOW() WHERE id=$1", [r.id])
    await query("UPDATE items SET status='closed', is_deleted=TRUE WHERE id=$1", [item.id])
    if (onTime) {
      await query('UPDATE users SET return_count=return_count+1 WHERE id=$1', [r.borrower_id])
      await promoteIfEligible(r.borrower_id)
    }
    res.json({ success: true, onTime })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

module.exports = router
