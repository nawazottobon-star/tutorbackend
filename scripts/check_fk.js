// Check foreign key constraints on the registrations table
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const fkResult = await prisma.$queryRawUnsafe(`
  SELECT
    kcu.column_name,
    ccu.table_name   AS foreign_table,
    ccu.column_name  AS foreign_column,
    rc.delete_rule
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = rc.unique_constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'registrations'
`);

console.log('\n=== FOREIGN KEYS on registrations table ===');
if (fkResult.length === 0) {
    console.log('  None — no foreign key constraints found');
} else {
    fkResult.forEach(r => console.log(`  ${r.column_name} → ${r.foreign_table}.${r.foreign_column} (on delete: ${r.delete_rule})`));
}

// Also check assessment_questions FK constraints
const fkResult2 = await prisma.$queryRawUnsafe(`
  SELECT
    kcu.column_name,
    ccu.table_name   AS foreign_table,
    ccu.column_name  AS foreign_column
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = rc.unique_constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'assessment_questions'
`);

console.log('\n=== FOREIGN KEYS on assessment_questions table ===');
if (fkResult2.length === 0) {
    console.log('  None — no foreign key constraints found');
} else {
    fkResult2.forEach(r => console.log(`  ${r.column_name} → ${r.foreign_table}.${r.foreign_column}`));
}

await prisma.$disconnect();
