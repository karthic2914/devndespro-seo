require('dotenv').config()
const { Pool } = require('pg')
const Anthropic = require('@anthropic-ai/sdk')
const OpenAI = require('openai')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

module.exports = { pool, anthropic, openai }
