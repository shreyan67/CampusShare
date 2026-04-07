const express  = require('express')
const multer   = require('multer')
const { query, queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const router  = express.Router()

// multer: store images in memory as buffer, convert to base64
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024, files: 4 },   // 2MB per file, max 4 files
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files allowed.'))
  },
})

// GET /api/items/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const cid = req.collegeId
    const [avail]   = await query("SELECT COUNT(*) n FROM items WHERE college_id=$1 AND status='available'", [cid])
    const [total]   = await query('SELECT COUNT(*) n FROM items WHERE college_id=$1', [cid])
    const [students]= await query('SELECT COUNT(*) n FROM users WHERE college_id=$1 AND is_verified=TRUE', [cid])
    const [borrows] = await query("SELECT COUNT(*) n FROM borrow_requests br JOIN items i ON br.item_id=i.id WHERE i.college_id=$1 AND br.status='returned'", [cid])
    const [pending] = await query("SELECT COUNT(*) n FROM borrow_requests br JOIN items i ON br.item_id=i.id WHERE i.college_id=$1 AND br.status='pending'", [cid])
    res.json({
      available: +avail.n, total: +total.n,
      students: +students.n, borrows: +borrows.n, pending: +pending.n,
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, status, search, listingType } = req.query

    const conds  = ['i.college_id=$1', "i.is_deleted = FALSE"]
    const params = [req.collegeId]
   

    // ✅ listing type filter (IMPORTANT)
    if (listingType) {
      params.push(listingType)
      conds.push(`i.listing_type=$${params.length}`)
    }

    if (category && category !== 'all') {
      params.push(category)
      conds.push(`i.category=$${params.length}`)
    }

  if (status && status !== 'closed') {
  params.push(status)
  conds.push(`i.status=$${params.length}`)
}

    if (search) {
      params.push(`%${search}%`)
      conds.push(`(i.title ILIKE $${params.length} OR i.category ILIKE $${params.length})`)
    }

    const items = await query(`
      SELECT i.*,
             u.name AS owner_name, u.trust_tier AS owner_tier,
             u.avatar AS owner_avatar, u.color AS owner_color
      FROM items i 
      JOIN users u ON i.owner_id=u.id
      WHERE ${conds.join(' AND ')}
      ORDER BY i.created_at DESC 
      LIMIT 100
    `, params)

    res.json({ items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load items.' })
  }
})

// POST /api/items  (with optional image upload)
router.post('/', requireAuth, upload.array('photos', 3), async (req, res) => {
  try {
    const { title, category, conditionNotes, maxBorrowDays, isPaid, pricePerDay } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' })

    const validCats = ['Books','Lab Equipment','Electronics','Notes & Guides','Accessories','Other']
    if (!validCats.includes(category)) return res.status(400).json({ error: 'Invalid category.' })

    // Check user is verified
    const u = await queryOne('SELECT id, is_verified FROM users WHERE id=$1', [req.userId])
    if (!u?.is_verified) return res.status(403).json({ error: 'Verify your account first.' })

    // Convert uploaded images to base64
    const images = (req.files || []).map(f =>
      `data:${f.mimetype};base64,${f.buffer.toString('base64')}`
    )

    const paid  = isPaid === 'true' || isPaid === true
    const price = paid ? parseFloat(pricePerDay || 0) : 0

    const item = await queryOne(`
      INSERT INTO items(
  college_id,owner_id,title,category,
  condition_notes,max_borrow_days,
  is_paid,price_per_day,images,listing_type
)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [
  req.collegeId,
  req.userId,
  title.trim(),
  category,
  (conditionNotes||'').trim(),
  +maxBorrowDays||7,
  paid,
  price,
  images,
  req.body.listingType || 'borrow' // ✅ IMPORTANT
])

    res.status(201).json({ item })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to list item.' }) }
})

// DELETE /api/items/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [req.params.id])
    if (!item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (item.status === 'borrowed') return res.status(409).json({ error: 'Cannot delete while borrowed.' })
    await query('DELETE FROM items WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

module.exports = router
