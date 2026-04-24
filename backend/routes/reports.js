// Health trend (last 30 days)
router.get('/health-trend', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DATE(created_at) as date, ROUND(AVG(health)) as avg_health
      FROM seo_metrics
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `);
    res.json({
      dates: result.rows.map(r => r.date),
      values: result.rows.map(r => Number(r.avg_health))
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch health trend.' });
  }
});

// Keyword trend (last 30 days)
router.get('/keyword-trend', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d::date as date, COUNT(k.id) as keyword_count
      FROM generate_series(NOW() - INTERVAL '29 days', NOW(), '1 day') d
      LEFT JOIN keywords k ON DATE(k.created_at) = d::date
      GROUP BY d
      ORDER BY d
    `);
    res.json({
      dates: result.rows.map(r => r.date),
      values: result.rows.map(r => Number(r.keyword_count))
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch keyword trend.' });
  }
});

// Backlink trend (last 30 days)
router.get('/backlink-trend', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d::date as date, COUNT(b.id) as backlink_count
      FROM generate_series(NOW() - INTERVAL '29 days', NOW(), '1 day') d
      LEFT JOIN backlinks b ON DATE(b.created_at) = d::date
      GROUP BY d
      ORDER BY d
    `);
    res.json({
      dates: result.rows.map(r => r.date),
      values: result.rows.map(r => Number(r.backlink_count))
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch backlink trend.' });
  }
});
const express = require('express');
const { pool } = require('../clients');
const router = express.Router();

// GET /api/reports/summary
router.get('/summary', async (req, res) => {
  try {
    const [projects, keywords, backlinks, avgHealth, recent] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM sites'),
      pool.query('SELECT COUNT(*) FROM keywords'),
      pool.query('SELECT COUNT(*) FROM backlinks'),
      pool.query('SELECT AVG(health) FROM seo_metrics'),
      pool.query(`SELECT s.name, a.created_at, a.type, a.severity, a.message FROM alerts a JOIN sites s ON a.site_id = s.id ORDER BY a.created_at DESC LIMIT 10`)
    ]);
    res.json({
      projects: Number(projects.rows[0].count),
      keywords: Number(keywords.rows[0].count),
      backlinks: Number(backlinks.rows[0].count),
      avgHealth: avgHealth.rows[0].avg ? Math.round(Number(avgHealth.rows[0].avg)) : 0,
      recent: recent.rows
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch report summary.' });
  }
});

module.exports = router;
