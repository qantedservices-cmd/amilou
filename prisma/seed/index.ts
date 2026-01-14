import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'
import { surahsData, programsData } from './surahs'

// Setup SQLite adapter for Prisma 7
// Database is in project root, not prisma folder
const dbPath = path.resolve(__dirname, '../../dev.db')
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // Seed Surahs
  console.log('📖 Seeding Surahs...')
  for (const surah of surahsData) {
    await prisma.surah.upsert({
      where: { number: surah.number },
      update: surah,
      create: surah,
    })
  }
  console.log(`✅ ${surahsData.length} Surahs seeded`)

  // Seed Programs
  console.log('📚 Seeding Programs...')
  for (const program of programsData) {
    await prisma.program.upsert({
      where: { code: program.code },
      update: program,
      create: program,
    })
  }
  console.log(`✅ ${programsData.length} Programs seeded`)

  // Create admin user if not exists
  console.log('👤 Checking admin user...')
  const adminEmail = 'admin@amilou.com'
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (!existingAdmin) {
    // Password: Admin123! (hashed with bcrypt)
    const hashedPassword = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qGmXhp8a/DQWWC'
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Administrateur',
        password: hashedPassword,
        role: 'ADMIN',
      },
    })
    console.log('✅ Admin user created (admin@amilou.com / Admin123!)')
  } else {
    console.log('ℹ️  Admin user already exists')
  }

  console.log('')
  console.log('🎉 Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
