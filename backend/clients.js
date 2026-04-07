require('dotenv').config()
const { Pool } = require('pg')
const Anthropic = require('@anthropic-ai/sdk')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

module.exports = { pool, anthropic }
