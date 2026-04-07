const express = require('express')
const multer  = require('multer')
const { query, queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only.')),
})

// GET /api/lostfound  — college-isolated
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query
    const conds  = ['lf.college_id=$1']
    const params = [req.collegeId]
    if (status) { params.push(status); conds.push(`lf.status=$${params.length}`) }

    const items = await query(`
      SELECT lf.*, u.name AS poster_name, u.avatar AS poster_avatar, u.color AS poster_color
      FROM lost_found lf JOIN users u ON lf.poster_id=u.id
      WHERE ${conds.join(' AND ')}
      ORDER BY lf.created_at DESC
    `, params)
    res.json({ items })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// POST /api/lostfound
router.post('/', requireAuth, upload.array('images', 3), async (req, res) => {
  try {
    const { title, description, lostBy, location } = req.body
    if (!title || !description || !lostBy) return res.status(400).json({ error: 'title, description, lostBy required.' })

    const images = (req.files || []).map(f =>
      `data:${f.mimetype};base64,${f.buffer.toString('base64')}`
    )
    const item = await queryOne(`
      INSERT INTO lost_found(college_id,poster_id,title,description,lost_by,location,images)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [req.collegeId, req.userId, title.trim(), description.trim(), lostBy, (location||'').trim(), images])

    res.status(201).json({ item })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to post.' }) }
})

// POST /api/lostfound/:id/claim  — someone claims it
router.post('/:id/claim', requireAuth, async (req, res) => {
  try {
    const lf = await queryOne('SELECT * FROM lost_found WHERE id=$1', [req.params.id])
    if (!lf) return res.status(404).json({ error: 'Not found.' })
    if (lf.status !== 'open') return res.status(409).json({ error: 'This item is no longer open for claims.' })
    if (lf.poster_id === req.userId) return res.status(400).json({ error: 'You posted this item.' })

    const existing = await queryOne(
      "SELECT id FROM lf_claims WHERE lf_id=$1 AND claimer_id=$2 AND status='pending'",
      [lf.id, req.userId]
    )
    if (existing) return res.status(409).json({ error: 'You already claimed this.' })

    const claim = await queryOne(
      'INSERT INTO lf_claims(lf_id,claimer_id,message) VALUES($1,$2,$3) RETURNING *',
      [lf.id, req.userId, req.body.message || '']
    )
    res.status(201).json({ claim })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// GET /api/lostfound/:id/claims  — poster sees who claimed
router.get('/:id/claims', requireAuth, async (req, res) => {
  try {
    const lf = await queryOne('SELECT * FROM lost_found WHERE id=$1', [req.params.id])
    if (!lf) return res.status(404).json({ error: 'Not found.' })
    if (lf.poster_id !== req.userId) return res.status(403).json({ error: 'Only the poster can see claims.' })

    const claims = await query(`
      SELECT lfc.*, u.name AS claimer_name, u.avatar AS claimer_avatar, u.color AS claimer_color
      FROM lf_claims lfc JOIN users u ON lfc.claimer_id=u.id
      WHERE lfc.lf_id=$1 ORDER BY lfc.created_at DESC
    `, [lf.id])
    res.json({ claims })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/lostfound/claims/:claimId/accept
router.patch('/claims/:claimId/accept', requireAuth, async (req, res) => {
  try {
    const claim = await queryOne('SELECT * FROM lf_claims WHERE id=$1', [req.params.claimId])
    if (!claim) return res.status(404).json({ error: 'Claim not found.' })

    const lf = await queryOne('SELECT * FROM lost_found WHERE id=$1', [claim.lf_id])
    if (lf.poster_id !== req.userId) return res.status(403).json({ error: 'Not your post.' })

    await query("UPDATE lf_claims SET status='accepted' WHERE id=$1", [claim.id])
    await query("UPDATE lf_claims SET status='rejected' WHERE lf_id=$1 AND id!=$2", [lf.id, claim.id])
    await query("UPDATE lost_found SET status='claimed' WHERE id=$1", [lf.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

module.exports = router
