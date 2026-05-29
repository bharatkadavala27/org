import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../lib/db.js';
import User from '../models/User.js';
import Scheme from '../models/Scheme.js';
import FormTemplate from '../models/FormTemplate.js';

// Samuh Lagna couple form v1 — fields from the real registration card.
const SAMUH_LAGNA_FIELDS = [
  { key: 'patrikaNo', label: 'પત્રિકા નંબર (Patrika No)', type: 'text', required: true, order: 1 },
  { key: 'side', label: 'પક્ષ (Side)', type: 'select', required: true, validation: { options: ['groom', 'bride'] }, order: 2 },
  { key: 'photo', label: 'ફોટો (Photo)', type: 'file', required: false, order: 3 },
  { key: 'fullName', label: 'પૂરું નામ (Full Name)', type: 'text', required: true, order: 4 },
  { key: 'fatherName', label: 'પિતાનું નામ (Father Name)', type: 'text', required: true, order: 5 },
  { key: 'dateOfBirth', label: 'જન્મ તારીખ (Date of Birth)', type: 'date', required: true, order: 6 },
  { key: 'age', label: 'ઉંમર (Age)', type: 'number', required: true, validation: { min: 18 }, order: 7 },
  { key: 'fullAddress', label: 'સરનામું (Full Address)', type: 'text', required: true, order: 8 },
  { key: 'village', label: 'ગામ (Village)', type: 'text', required: true, order: 9 },
  { key: 'taluka', label: 'તાલુકો (Taluka)', type: 'text', required: false, order: 10 },
  { key: 'jilla', label: 'જિલ્લો (Jilla)', type: 'text', required: false, order: 11 },
  { key: 'mobile', label: 'મોબાઈલ (Mobile)', type: 'text', required: false, order: 12 },
  { key: 'education', label: 'અભ્યાસ (Education)', type: 'text', required: false, order: 13 },
  { key: 'witnessName', label: 'સાક્ષીનું નામ (Witness Name)', type: 'text', required: false, order: 14 },
  { key: 'witnessMobile', label: 'સાક્ષી મોબાઈલ (Witness Mobile)', type: 'text', required: false, order: 15 },
];

async function run() {
  await connectDB(process.env.MONGODB_URI);

  // 1) Admin user
  const login = process.env.SEED_ADMIN_LOGIN;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'Trust Admin';
  if (!login || !password) {
    throw new Error('SEED_ADMIN_LOGIN and SEED_ADMIN_PASSWORD must be set in .env');
  }
  let admin = await User.findOne({ phone: login });
  if (admin) {
    console.log(`• Admin already exists: ${login}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    admin = await User.create({ name, phone: login, passwordHash, role: 'admin', status: 'active' });
    console.log(`✓ Created admin: ${login}`);
  }

  // 2) Schemes
  const schemes = [
    { name: 'સમૂહ લગ્ન (Samuh Lagna)', type: 'samuh_lagna' },
    { name: 'કુંવરબાઈનું મામેરું (Mameru)', type: 'mameru' },
  ];
  const created = {};
  for (const s of schemes) {
    let scheme = await Scheme.findOne({ type: s.type });
    if (!scheme) {
      scheme = await Scheme.create({ ...s, active: true });
      console.log(`✓ Created scheme: ${s.name}`);
    } else {
      console.log(`• Scheme exists: ${s.name}`);
    }
    created[s.type] = scheme;
  }

  // 3) Samuh Lagna FormTemplate v1
  const sl = created['samuh_lagna'];
  const existingTpl = await FormTemplate.findOne({ schemeId: sl._id, version: 1 });
  if (!existingTpl) {
    await FormTemplate.create({ schemeId: sl._id, version: 1, fields: SAMUH_LAGNA_FIELDS, active: true });
    console.log('✓ Created Samuh Lagna FormTemplate v1');
  } else {
    console.log('• Samuh Lagna FormTemplate v1 exists');
  }

  console.log('\nSeed complete.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
