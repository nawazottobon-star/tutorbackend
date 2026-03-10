// Check course_offerings constraints and program_type enum values
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. FK constraints on course_offerings itself
const fk = await prisma.$queryRawUnsafe(`
  SELECT kcu.column_name, ccu.table_name AS foreign_table, rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.unique_constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'course_offerings'
`);
console.log('\n=== FOREIGN KEYS on course_offerings ===');
fk.length === 0
    ? console.log('  None')
    : fk.forEach(r => console.log(`  ${r.column_name} → ${r.foreign_table} (on delete: ${r.delete_rule})`));

// 2. What values does the program_type enum support?
const enumVals = await prisma.$queryRawUnsafe(`
  SELECT e.enumlabel AS value
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname IN (
    SELECT udt_name FROM information_schema.columns
    WHERE table_name = 'course_offerings' AND column_name = 'program_type'
  )
  ORDER BY e.enumsortorder
`);
console.log('\n=== program_type ENUM values ===');
enumVals.forEach(r => console.log(`  - ${r.value}`));

// 3. Is course_id nullable?
const cols = await prisma.$queryRawUnsafe(`
  SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'course_offerings' AND column_name = 'course_id'
`);
console.log('\n=== course_id column ===');
cols.forEach(r => console.log(`  nullable: ${r.is_nullable}, default: ${r.column_default}`));

// 4. Sample existing rows to understand usage
const sample = await prisma.$queryRawUnsafe(`SELECT * FROM course_offerings LIMIT 3`);
console.log('\n=== Sample rows in course_offerings ===');
console.log(JSON.stringify(sample, null, 2));

await prisma.$disconnect();
