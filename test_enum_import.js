// Simple test to check AST parsing of enum types
import fs from 'fs';
import { Parser } from 'node-sql-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the test SQL file
const sqlFile = fs.readFileSync(
    path.join(__dirname, 'testSQL/Calendar Database Design_2026-01-08T02_21_49.570Z.sql'),
    'utf-8'
);

// Preprocess SQL like Modal.jsx does
function preprocessSQL(sql) {
    let processedSQL = sql;
    processedSQL = processedSQL.replace(/\bTIMETZ\b/gi, "TIME WITH TIME ZONE");
    processedSQL = processedSQL.replace(/\bARRAY\b(?!\s*\[)/gi, "TEXT[]");
    return processedSQL;
}

const processedSQL = preprocessSQL(sqlFile);

// Parse the SQL
const parser = new Parser();
let ast;
try {
    ast = parser.astify(processedSQL, { database: 'postgresql' });
    console.log('✓ SQL parsed successfully');
    console.log('Number of statements:', Array.isArray(ast) ? ast.length : 1);

    // Check for CREATE TYPE statements
    const createTypeStatements = (Array.isArray(ast) ? ast : [ast]).filter(
        stmt => stmt.type === 'create' && stmt.keyword === 'type'
    );

    console.log('\n=== CREATE TYPE Statements ===');
    console.log('Found:', createTypeStatements.length);

    createTypeStatements.forEach((stmt, i) => {
        console.log(`\n${i + 1}. Type: ${stmt.name?.name}`);
        console.log('   Resource:', stmt.resource);
        if (stmt.resource === 'enum') {
            console.log('   Values:', stmt.create_definitions?.value?.map(v => v.value));
        } else if (Array.isArray(stmt.create_definitions)) {
            console.log('   Fields:', stmt.create_definitions.length);
        }
    });

} catch (e) {
    console.error('✗ Failed to parse SQL:', e.message);
    if (e.location) {
        console.error(`   at line ${e.location.start.line}, column ${e.location.start.column}`);
    }
    process.exit(1);
}
