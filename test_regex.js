// Test the regex patterns used in preprocessSQL to understand the stubbing issue
const testSQL = `CREATE TYPE "principal_type" AS ENUM (
  'user',
  'artists',
  'band',
  'org'
);

CREATE TABLE IF NOT EXISTS "principal" (
  "id" UUID DEFAULT gen_random_uuid(),
  "type" principal_type NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY("id")
);`;

// Test the CREATE TYPE regex
const createTypeRegex = /CREATE\s+TYPE\s+(?:["`]([^"`]+)["`]|([a-zA-Z0-9_]+))/gi;
const definedTypes = new Set();
let match;

console.log('=== CREATE TYPE Matches ===');
while ((match = createTypeRegex.exec(testSQL)) !== null) {
    const typeName = match[1] || match[2];
    console.log(`Found type: "${typeName}"`);
    definedTypes.add(typeName);
}

console.log('\n=== Defined Types Set ===');
console.log(Array.from(definedTypes));

// Test the column regex WITH restricted keywords filter
const columnRegex = /^\s*(?:["`]([^"`]+)["`]|([a-zA-Z0-9_]+))\s+([a-zA-Z0-9_]+)(?:\s+|$|,|\)|;)/gm;
const usedTypes = new Set();

const restrictedColNames = new Set([
    "CREATE",
    "ALTER",
    "DROP",
    "CONSTRAINT",
    "PRIMARY",
    "FOREIGN",
    "UNIQUE",
    "CHECK",
    "INDEX",
    "COMMENT",
]);

const builtins = new Set(["UUID", "TIMESTAMPTZ", "TEXT", "INTEGER", "BOOLEAN"]);

console.log('\n=== Column Type Matches (with filtering) ===');
while ((match = columnRegex.exec(testSQL)) !== null) {
    const colName = match[1] || match[2];
    const colType = match[3];

    if (restrictedColNames.has(colName.toUpperCase())) {
        console.log(`Column: "${colName}", Type: "${colType}" [SKIPPED - SQL keyword]`);
        continue;
    }

    console.log(`Column: "${colName}", Type: "${colType}" [ADDED to usedTypes]`);
    usedTypes.add(colType);
}

console.log('\n=== Used Types Set ===');
console.log(Array.from(usedTypes));

// Check for missing types (types that would need stubs)
const missingTypes = [];
console.log('\n=== Type Classification ===');
usedTypes.forEach((t) => {
    const isDefined = definedTypes.has(t) || definedTypes.has(`"${t}"`);
    const isBuiltin = builtins.has(t.toUpperCase());

    if (isDefined) {
        console.log(`Type "${t}": DEFINED (no stub needed)`);
    } else if (isBuiltin) {
        console.log(`Type "${t}": BUILTIN (no stub needed)`);
    } else {
        console.log(`Type "${t}": MISSING (would create stub) ❌`);
        missingTypes.push(t);
    }
});

console.log('\n=== RESULT ===');
if (missingTypes.length === 0) {
    console.log('✅ No stub enums would be created!');
} else {
    console.log(`❌ Would create ${missingTypes.length} stub enum(s): ${missingTypes.join(', ')}`);
}
