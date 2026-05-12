import { connectDB, sequelize } from './config/database.js';
import { Eleve } from './models/index.js';

async function check() {
  await connectDB();
  const count = await Eleve.count();
  console.log(`Nombre d'élèves total: ${count}`);
  const eleves = await Eleve.findAll({ limit: 5 });
  console.log('Exemples d\'élèves:', JSON.stringify(eleves, null, 2));
  process.exit(0);
}

check();
