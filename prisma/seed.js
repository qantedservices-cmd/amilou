require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const surahsData = [
  { number: 1, nameAr: "الفاتحة", nameFr: "L'Ouverture", nameEn: "The Opening", totalVerses: 7, revelationOrder: 5, revelationType: "Meccan" },
  { number: 2, nameAr: "البقرة", nameFr: "La Vache", nameEn: "The Cow", totalVerses: 286, revelationOrder: 87, revelationType: "Medinan" },
  { number: 3, nameAr: "آل عمران", nameFr: "La Famille d'Imran", nameEn: "Family of Imran", totalVerses: 200, revelationOrder: 89, revelationType: "Medinan" },
  { number: 4, nameAr: "النساء", nameFr: "Les Femmes", nameEn: "The Women", totalVerses: 176, revelationOrder: 92, revelationType: "Medinan" },
  { number: 5, nameAr: "المائدة", nameFr: "La Table Servie", nameEn: "The Table Spread", totalVerses: 120, revelationOrder: 112, revelationType: "Medinan" },
  { number: 6, nameAr: "الأنعام", nameFr: "Les Bestiaux", nameEn: "The Cattle", totalVerses: 165, revelationOrder: 55, revelationType: "Meccan" },
  { number: 7, nameAr: "الأعراف", nameFr: "Les Murailles", nameEn: "The Heights", totalVerses: 206, revelationOrder: 39, revelationType: "Meccan" },
  { number: 8, nameAr: "الأنفال", nameFr: "Le Butin", nameEn: "The Spoils of War", totalVerses: 75, revelationOrder: 88, revelationType: "Medinan" },
  { number: 9, nameAr: "التوبة", nameFr: "Le Repentir", nameEn: "The Repentance", totalVerses: 129, revelationOrder: 113, revelationType: "Medinan" },
  { number: 10, nameAr: "يونس", nameFr: "Jonas", nameEn: "Jonah", totalVerses: 109, revelationOrder: 51, revelationType: "Meccan" },
  { number: 11, nameAr: "هود", nameFr: "Houd", nameEn: "Hud", totalVerses: 123, revelationOrder: 52, revelationType: "Meccan" },
  { number: 12, nameAr: "يوسف", nameFr: "Joseph", nameEn: "Joseph", totalVerses: 111, revelationOrder: 53, revelationType: "Meccan" },
  { number: 13, nameAr: "الرعد", nameFr: "Le Tonnerre", nameEn: "The Thunder", totalVerses: 43, revelationOrder: 96, revelationType: "Medinan" },
  { number: 14, nameAr: "إبراهيم", nameFr: "Abraham", nameEn: "Abraham", totalVerses: 52, revelationOrder: 72, revelationType: "Meccan" },
  { number: 15, nameAr: "الحجر", nameFr: "Al-Hijr", nameEn: "The Rocky Tract", totalVerses: 99, revelationOrder: 54, revelationType: "Meccan" },
  { number: 16, nameAr: "النحل", nameFr: "Les Abeilles", nameEn: "The Bee", totalVerses: 128, revelationOrder: 70, revelationType: "Meccan" },
  { number: 17, nameAr: "الإسراء", nameFr: "Le Voyage Nocturne", nameEn: "The Night Journey", totalVerses: 111, revelationOrder: 50, revelationType: "Meccan" },
  { number: 18, nameAr: "الكهف", nameFr: "La Caverne", nameEn: "The Cave", totalVerses: 110, revelationOrder: 69, revelationType: "Meccan" },
  { number: 19, nameAr: "مريم", nameFr: "Marie", nameEn: "Mary", totalVerses: 98, revelationOrder: 44, revelationType: "Meccan" },
  { number: 20, nameAr: "طه", nameFr: "Ta-Ha", nameEn: "Ta-Ha", totalVerses: 135, revelationOrder: 45, revelationType: "Meccan" },
  { number: 21, nameAr: "الأنبياء", nameFr: "Les Prophètes", nameEn: "The Prophets", totalVerses: 112, revelationOrder: 73, revelationType: "Meccan" },
  { number: 22, nameAr: "الحج", nameFr: "Le Pèlerinage", nameEn: "The Pilgrimage", totalVerses: 78, revelationOrder: 103, revelationType: "Medinan" },
  { number: 23, nameAr: "المؤمنون", nameFr: "Les Croyants", nameEn: "The Believers", totalVerses: 118, revelationOrder: 74, revelationType: "Meccan" },
  { number: 24, nameAr: "النور", nameFr: "La Lumière", nameEn: "The Light", totalVerses: 64, revelationOrder: 102, revelationType: "Medinan" },
  { number: 25, nameAr: "الفرقان", nameFr: "Le Discernement", nameEn: "The Criterion", totalVerses: 77, revelationOrder: 42, revelationType: "Meccan" },
  { number: 26, nameAr: "الشعراء", nameFr: "Les Poètes", nameEn: "The Poets", totalVerses: 227, revelationOrder: 47, revelationType: "Meccan" },
  { number: 27, nameAr: "النمل", nameFr: "Les Fourmis", nameEn: "The Ant", totalVerses: 93, revelationOrder: 48, revelationType: "Meccan" },
  { number: 28, nameAr: "القصص", nameFr: "Le Récit", nameEn: "The Stories", totalVerses: 88, revelationOrder: 49, revelationType: "Meccan" },
  { number: 29, nameAr: "العنكبوت", nameFr: "L'Araignée", nameEn: "The Spider", totalVerses: 69, revelationOrder: 85, revelationType: "Meccan" },
  { number: 30, nameAr: "الروم", nameFr: "Les Romains", nameEn: "The Romans", totalVerses: 60, revelationOrder: 84, revelationType: "Meccan" },
  { number: 31, nameAr: "لقمان", nameFr: "Louqman", nameEn: "Luqman", totalVerses: 34, revelationOrder: 57, revelationType: "Meccan" },
  { number: 32, nameAr: "السجدة", nameFr: "La Prosternation", nameEn: "The Prostration", totalVerses: 30, revelationOrder: 75, revelationType: "Meccan" },
  { number: 33, nameAr: "الأحزاب", nameFr: "Les Coalisés", nameEn: "The Combined Forces", totalVerses: 73, revelationOrder: 90, revelationType: "Medinan" },
  { number: 34, nameAr: "سبأ", nameFr: "Saba", nameEn: "Sheba", totalVerses: 54, revelationOrder: 58, revelationType: "Meccan" },
  { number: 35, nameAr: "فاطر", nameFr: "Le Créateur", nameEn: "Originator", totalVerses: 45, revelationOrder: 43, revelationType: "Meccan" },
  { number: 36, nameAr: "يس", nameFr: "Ya-Sin", nameEn: "Ya-Sin", totalVerses: 83, revelationOrder: 41, revelationType: "Meccan" },
  { number: 37, nameAr: "الصافات", nameFr: "Les Rangés", nameEn: "Those Who Set The Ranks", totalVerses: 182, revelationOrder: 56, revelationType: "Meccan" },
  { number: 38, nameAr: "ص", nameFr: "Sad", nameEn: "Sad", totalVerses: 88, revelationOrder: 38, revelationType: "Meccan" },
  { number: 39, nameAr: "الزمر", nameFr: "Les Groupes", nameEn: "The Troops", totalVerses: 75, revelationOrder: 59, revelationType: "Meccan" },
  { number: 40, nameAr: "غافر", nameFr: "Le Pardonneur", nameEn: "The Forgiver", totalVerses: 85, revelationOrder: 60, revelationType: "Meccan" },
  { number: 41, nameAr: "فصلت", nameFr: "Les Versets Détaillés", nameEn: "Explained in Detail", totalVerses: 54, revelationOrder: 61, revelationType: "Meccan" },
  { number: 42, nameAr: "الشورى", nameFr: "La Consultation", nameEn: "The Consultation", totalVerses: 53, revelationOrder: 62, revelationType: "Meccan" },
  { number: 43, nameAr: "الزخرف", nameFr: "L'Ornement", nameEn: "The Ornaments of Gold", totalVerses: 89, revelationOrder: 63, revelationType: "Meccan" },
  { number: 44, nameAr: "الدخان", nameFr: "La Fumée", nameEn: "The Smoke", totalVerses: 59, revelationOrder: 64, revelationType: "Meccan" },
  { number: 45, nameAr: "الجاثية", nameFr: "L'Agenouillée", nameEn: "The Crouching", totalVerses: 37, revelationOrder: 65, revelationType: "Meccan" },
  { number: 46, nameAr: "الأحقاف", nameFr: "Al-Ahqaf", nameEn: "The Wind-Curved Sandhills", totalVerses: 35, revelationOrder: 66, revelationType: "Meccan" },
  { number: 47, nameAr: "محمد", nameFr: "Muhammad", nameEn: "Muhammad", totalVerses: 38, revelationOrder: 95, revelationType: "Medinan" },
  { number: 48, nameAr: "الفتح", nameFr: "La Victoire Éclatante", nameEn: "The Victory", totalVerses: 29, revelationOrder: 111, revelationType: "Medinan" },
  { number: 49, nameAr: "الحجرات", nameFr: "Les Appartements", nameEn: "The Rooms", totalVerses: 18, revelationOrder: 106, revelationType: "Medinan" },
  { number: 50, nameAr: "ق", nameFr: "Qaf", nameEn: "Qaf", totalVerses: 45, revelationOrder: 34, revelationType: "Meccan" },
  { number: 51, nameAr: "الذاريات", nameFr: "Qui Éparpillent", nameEn: "The Winnowing Winds", totalVerses: 60, revelationOrder: 67, revelationType: "Meccan" },
  { number: 52, nameAr: "الطور", nameFr: "Le Mont", nameEn: "The Mount", totalVerses: 49, revelationOrder: 76, revelationType: "Meccan" },
  { number: 53, nameAr: "النجم", nameFr: "L'Étoile", nameEn: "The Star", totalVerses: 62, revelationOrder: 23, revelationType: "Meccan" },
  { number: 54, nameAr: "القمر", nameFr: "La Lune", nameEn: "The Moon", totalVerses: 55, revelationOrder: 37, revelationType: "Meccan" },
  { number: 55, nameAr: "الرحمن", nameFr: "Le Tout Miséricordieux", nameEn: "The Beneficent", totalVerses: 78, revelationOrder: 97, revelationType: "Medinan" },
  { number: 56, nameAr: "الواقعة", nameFr: "L'Événement", nameEn: "The Inevitable", totalVerses: 96, revelationOrder: 46, revelationType: "Meccan" },
  { number: 57, nameAr: "الحديد", nameFr: "Le Fer", nameEn: "The Iron", totalVerses: 29, revelationOrder: 94, revelationType: "Medinan" },
  { number: 58, nameAr: "المجادلة", nameFr: "La Discussion", nameEn: "The Pleading Woman", totalVerses: 22, revelationOrder: 105, revelationType: "Medinan" },
  { number: 59, nameAr: "الحشر", nameFr: "L'Exode", nameEn: "The Exile", totalVerses: 24, revelationOrder: 101, revelationType: "Medinan" },
  { number: 60, nameAr: "الممتحنة", nameFr: "L'Éprouvée", nameEn: "She That Is To Be Examined", totalVerses: 13, revelationOrder: 91, revelationType: "Medinan" },
  { number: 61, nameAr: "الصف", nameFr: "Le Rang", nameEn: "The Ranks", totalVerses: 14, revelationOrder: 109, revelationType: "Medinan" },
  { number: 62, nameAr: "الجمعة", nameFr: "Le Vendredi", nameEn: "The Congregation", totalVerses: 11, revelationOrder: 110, revelationType: "Medinan" },
  { number: 63, nameAr: "المنافقون", nameFr: "Les Hypocrites", nameEn: "The Hypocrites", totalVerses: 11, revelationOrder: 104, revelationType: "Medinan" },
  { number: 64, nameAr: "التغابن", nameFr: "La Grande Perte", nameEn: "The Mutual Disillusion", totalVerses: 18, revelationOrder: 108, revelationType: "Medinan" },
  { number: 65, nameAr: "الطلاق", nameFr: "Le Divorce", nameEn: "The Divorce", totalVerses: 12, revelationOrder: 99, revelationType: "Medinan" },
  { number: 66, nameAr: "التحريم", nameFr: "L'Interdiction", nameEn: "The Prohibition", totalVerses: 12, revelationOrder: 107, revelationType: "Medinan" },
  { number: 67, nameAr: "الملك", nameFr: "La Royauté", nameEn: "The Sovereignty", totalVerses: 30, revelationOrder: 77, revelationType: "Meccan" },
  { number: 68, nameAr: "القلم", nameFr: "La Plume", nameEn: "The Pen", totalVerses: 52, revelationOrder: 2, revelationType: "Meccan" },
  { number: 69, nameAr: "الحاقة", nameFr: "Celle Qui Montre la Vérité", nameEn: "The Reality", totalVerses: 52, revelationOrder: 78, revelationType: "Meccan" },
  { number: 70, nameAr: "المعارج", nameFr: "Les Voies d'Ascension", nameEn: "The Ascending Stairways", totalVerses: 44, revelationOrder: 79, revelationType: "Meccan" },
  { number: 71, nameAr: "نوح", nameFr: "Noé", nameEn: "Noah", totalVerses: 28, revelationOrder: 71, revelationType: "Meccan" },
  { number: 72, nameAr: "الجن", nameFr: "Les Djinns", nameEn: "The Jinn", totalVerses: 28, revelationOrder: 40, revelationType: "Meccan" },
  { number: 73, nameAr: "المزمل", nameFr: "L'Enveloppé", nameEn: "The Enshrouded One", totalVerses: 20, revelationOrder: 3, revelationType: "Meccan" },
  { number: 74, nameAr: "المدثر", nameFr: "Le Revêtu d'un Manteau", nameEn: "The Cloaked One", totalVerses: 56, revelationOrder: 4, revelationType: "Meccan" },
  { number: 75, nameAr: "القيامة", nameFr: "La Résurrection", nameEn: "The Resurrection", totalVerses: 40, revelationOrder: 31, revelationType: "Meccan" },
  { number: 76, nameAr: "الإنسان", nameFr: "L'Homme", nameEn: "The Man", totalVerses: 31, revelationOrder: 98, revelationType: "Medinan" },
  { number: 77, nameAr: "المرسلات", nameFr: "Les Envoyés", nameEn: "The Emissaries", totalVerses: 50, revelationOrder: 33, revelationType: "Meccan" },
  { number: 78, nameAr: "النبأ", nameFr: "La Nouvelle", nameEn: "The Tidings", totalVerses: 40, revelationOrder: 80, revelationType: "Meccan" },
  { number: 79, nameAr: "النازعات", nameFr: "Les Anges Qui Arrachent", nameEn: "Those Who Drag Forth", totalVerses: 46, revelationOrder: 81, revelationType: "Meccan" },
  { number: 80, nameAr: "عبس", nameFr: "Il S'est Renfrogné", nameEn: "He Frowned", totalVerses: 42, revelationOrder: 24, revelationType: "Meccan" },
  { number: 81, nameAr: "التكوير", nameFr: "L'Obscurcissement", nameEn: "The Overthrowing", totalVerses: 29, revelationOrder: 7, revelationType: "Meccan" },
  { number: 82, nameAr: "الانفطار", nameFr: "La Rupture", nameEn: "The Cleaving", totalVerses: 19, revelationOrder: 82, revelationType: "Meccan" },
  { number: 83, nameAr: "المطففين", nameFr: "Les Fraudeurs", nameEn: "The Defrauding", totalVerses: 36, revelationOrder: 86, revelationType: "Meccan" },
  { number: 84, nameAr: "الانشقاق", nameFr: "La Déchirure", nameEn: "The Sundering", totalVerses: 25, revelationOrder: 83, revelationType: "Meccan" },
  { number: 85, nameAr: "البروج", nameFr: "Les Constellations", nameEn: "The Mansions of the Stars", totalVerses: 22, revelationOrder: 27, revelationType: "Meccan" },
  { number: 86, nameAr: "الطارق", nameFr: "L'Astre Nocturne", nameEn: "The Morning Star", totalVerses: 17, revelationOrder: 36, revelationType: "Meccan" },
  { number: 87, nameAr: "الأعلى", nameFr: "Le Très-Haut", nameEn: "The Most High", totalVerses: 19, revelationOrder: 8, revelationType: "Meccan" },
  { number: 88, nameAr: "الغاشية", nameFr: "L'Enveloppante", nameEn: "The Overwhelming", totalVerses: 26, revelationOrder: 68, revelationType: "Meccan" },
  { number: 89, nameAr: "الفجر", nameFr: "L'Aube", nameEn: "The Dawn", totalVerses: 30, revelationOrder: 10, revelationType: "Meccan" },
  { number: 90, nameAr: "البلد", nameFr: "La Cité", nameEn: "The City", totalVerses: 20, revelationOrder: 35, revelationType: "Meccan" },
  { number: 91, nameAr: "الشمس", nameFr: "Le Soleil", nameEn: "The Sun", totalVerses: 15, revelationOrder: 26, revelationType: "Meccan" },
  { number: 92, nameAr: "الليل", nameFr: "La Nuit", nameEn: "The Night", totalVerses: 21, revelationOrder: 9, revelationType: "Meccan" },
  { number: 93, nameAr: "الضحى", nameFr: "Le Jour Montant", nameEn: "The Morning Hours", totalVerses: 11, revelationOrder: 11, revelationType: "Meccan" },
  { number: 94, nameAr: "الشرح", nameFr: "L'Ouverture", nameEn: "The Relief", totalVerses: 8, revelationOrder: 12, revelationType: "Meccan" },
  { number: 95, nameAr: "التين", nameFr: "Le Figuier", nameEn: "The Fig", totalVerses: 8, revelationOrder: 28, revelationType: "Meccan" },
  { number: 96, nameAr: "العلق", nameFr: "L'Adhérence", nameEn: "The Clot", totalVerses: 19, revelationOrder: 1, revelationType: "Meccan" },
  { number: 97, nameAr: "القدر", nameFr: "La Destinée", nameEn: "The Power", totalVerses: 5, revelationOrder: 25, revelationType: "Meccan" },
  { number: 98, nameAr: "البينة", nameFr: "La Preuve", nameEn: "The Clear Proof", totalVerses: 8, revelationOrder: 100, revelationType: "Medinan" },
  { number: 99, nameAr: "الزلزلة", nameFr: "La Secousse", nameEn: "The Earthquake", totalVerses: 8, revelationOrder: 93, revelationType: "Medinan" },
  { number: 100, nameAr: "العاديات", nameFr: "Les Coursiers", nameEn: "The Courser", totalVerses: 11, revelationOrder: 14, revelationType: "Meccan" },
  { number: 101, nameAr: "القارعة", nameFr: "Le Fracas", nameEn: "The Calamity", totalVerses: 11, revelationOrder: 30, revelationType: "Meccan" },
  { number: 102, nameAr: "التكاثر", nameFr: "La Course aux Richesses", nameEn: "The Rivalry in World Increase", totalVerses: 8, revelationOrder: 16, revelationType: "Meccan" },
  { number: 103, nameAr: "العصر", nameFr: "Le Temps", nameEn: "The Declining Day", totalVerses: 3, revelationOrder: 13, revelationType: "Meccan" },
  { number: 104, nameAr: "الهمزة", nameFr: "Les Calomniateurs", nameEn: "The Traducer", totalVerses: 9, revelationOrder: 32, revelationType: "Meccan" },
  { number: 105, nameAr: "الفيل", nameFr: "L'Éléphant", nameEn: "The Elephant", totalVerses: 5, revelationOrder: 19, revelationType: "Meccan" },
  { number: 106, nameAr: "قريش", nameFr: "Qoraïch", nameEn: "Quraysh", totalVerses: 4, revelationOrder: 29, revelationType: "Meccan" },
  { number: 107, nameAr: "الماعون", nameFr: "L'Ustensile", nameEn: "The Small Kindnesses", totalVerses: 7, revelationOrder: 17, revelationType: "Meccan" },
  { number: 108, nameAr: "الكوثر", nameFr: "L'Abondance", nameEn: "The Abundance", totalVerses: 3, revelationOrder: 15, revelationType: "Meccan" },
  { number: 109, nameAr: "الكافرون", nameFr: "Les Infidèles", nameEn: "The Disbelievers", totalVerses: 6, revelationOrder: 18, revelationType: "Meccan" },
  { number: 110, nameAr: "النصر", nameFr: "Le Secours", nameEn: "The Divine Support", totalVerses: 3, revelationOrder: 114, revelationType: "Medinan" },
  { number: 111, nameAr: "المسد", nameFr: "Les Fibres", nameEn: "The Palm Fiber", totalVerses: 5, revelationOrder: 6, revelationType: "Meccan" },
  { number: 112, nameAr: "الإخلاص", nameFr: "Le Monothéisme Pur", nameEn: "The Sincerity", totalVerses: 4, revelationOrder: 22, revelationType: "Meccan" },
  { number: 113, nameAr: "الفلق", nameFr: "L'Aube Naissante", nameEn: "The Daybreak", totalVerses: 5, revelationOrder: 20, revelationType: "Meccan" },
  { number: 114, nameAr: "الناس", nameFr: "Les Hommes", nameEn: "Mankind", totalVerses: 6, revelationOrder: 21, revelationType: "Meccan" },
]

const programsData = [
  { code: "MEMORIZATION", nameAr: "حفظ", nameFr: "Mémorisation", nameEn: "Memorization", description: "Apprentissage par cœur de nouveaux versets" },
  { code: "CONSOLIDATION", nameAr: "تثبيت", nameFr: "Consolidation", nameEn: "Consolidation", description: "Renforcement des versets récemment mémorisés" },
  { code: "REVISION", nameAr: "مراجعة", nameFr: "Révision", nameEn: "Revision", description: "Révision des versets anciennement mémorisés" },
  { code: "READING", nameAr: "قراءة", nameFr: "Lecture", nameEn: "Reading", description: "Lecture du Coran avec tajwid" },
  { code: "TAFSIR", nameAr: "تفسير", nameFr: "Lecture Tafsir", nameEn: "Tafsir Reading", description: "Lecture et étude du tafsir" },
]

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
    // Password: Admin123!
    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash('Admin123!', 12)
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
