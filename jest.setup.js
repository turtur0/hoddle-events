import '@testing-library/jest-dom'
import dotenv from 'dotenv'
import path from 'path'

// Load .env.local for tests
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Also try .env as fallback
dotenv.config({ path: path.resolve(process.cwd(), '.env') })