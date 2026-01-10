// Test preprocessSQL with actual Calendar Database content
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the actual SQL file
const sqlFile = fs.readFileSync(
    path.join(__dirname, 'testSQL/Calendar Database Design_2026-01-08T02_21_49.570Z.sql'),
    'utf-8'
);

// The UPDATED restrictedColNames from Modal.jsx
const restrictedColNames = new Set([
    "CREATE", "ALTER", "DROP", "CONSTRAINT", "PRIMARY", "FOREIGN",
    "UNIQUE", "CHECK", "INDEX", "COMMENT", "ON", "UPDATE", "DELETE",
    "INSERT", "SELECT", "FROM", "WHERE", "COLUMN", "TABLE", "TYPE",
    "ENUM", "when", "case", "then", "else", "end", "if", "exists",
]);

// Reproduce the preprocessSQL function from Modal.jsx
function preprocessSQL(sql) {
    let processedSQL = sql;

    processedSQL = processedSQL.replace(/\bTIMETZ\b/gi, "TIME WITH TIME ZONE");
    processedSQL = processedSQL.replace(/\bARRAY\b(?!\s*\[)/gi, "TEXT[]");
    processedSQL = processedSQL.replace(
        /(USER-DEFINED)(.*?DEFAULT\s+'[^']+'::)("?[a-zA-Z0-9_]+"?)(\[\])?/g,
        (match, p1, p2, p3) => `${p3}${p2}${p3}`,
    );
    processedSQL = processedSQL.replace(/::character varying(\[\])?/gi, "");
    processedSQL = processedSQL.replace(/::"?[a-zA-Z0-9_]+"?(\[\])?/g, "");
    processedSQL = processedSQL.replace(/USER-DEFINED/g, "TEXT");

    const definedTypes = new Set();
    const createTypeRegex = /CREATE\s+TYPE\s+(?:["`]([^"`]+)["`]|([a-zA-Z0-9_]+))/gi;
    let match;
    while ((match = createTypeRegex.exec(processedSQL)) !== null) {
        definedTypes.add(match[1] || match[2]);
    }

    console.log('=== Defined Types ===');
    console.log(Array.from(definedTypes).sort());

    const builtins = new Set([
        "TIMETZ", "TIMESTAMPTZ", "UUID", "JSONB", "BIGSERIAL", "SERIAL",
        "SMALLSERIAL", "TSVECTOR", "TSQUERY", "XML", "MONEY", "BYTEA",
        "INET", "CIDR", "MACADDR", "MACADDR8", "BIT", "VARBIT", "BOX",
        "CIRCLE", "LINE", "LSEG", "PATH", "POINT", "POLYGON", "CHARACTER",
        "VARYING", "TEXT", "TABLE", "CONSTRAINT", "PRIMARY", "FOREIGN",
        "KEY", "REFERENCES", "UNIQUE", "CHECK", "WITH", "WITHOUT", "ZONE",
        "ARRAY", "INTEGER", "BOOLEAN", "NUMERIC", "REAL", "DOUBLE", "PRECISION",
        "SMALLINT", "BIGINT", "DECIMAL", "VARCHAR", "CHAR", "DATE", "TIMESTAMP",
        "TIME", "INTERVAL", "PRECISION"
    ]);

    const usedTypes = new Set();
    const columnRegex = /^\s*(?:["`]([^"`]+)["`]|([a-zA-Z0-9_]+))\s+([a-zA-Z0-9_]+)(?:\s+|$|,|\)|;)/gm;

    while ((match = columnRegex.exec(processedSQL)) !== null) {
        const colName = match[1] || match[2];
        if (restrictedColNames.has(colName.toUpperCase()) || restrictedColNames.has(colName)) {
            continue;
        }
        usedTypes.add(match[3]);
    }

    console.log('\n=== Used Types (after filtering) ===');
    console.log(Array.from(usedTypes).sort());

    const missingTypes = [];
    usedTypes.forEach((t) => {
        if (definedTypes.has(t) || definedTypes.has(`"${t}"`)) return;

        const upper = t.toUpperCase();
        if (builtins.has(upper)) return;
        if (["VARCHAR", "INT", "SERIAL"].includes(upper)) return;

        missingTypes.push(t);
    });

    console.log('\n=== Missing Types (will create stubs) ===');
    if (missingTypes.length === 0) {
        console.log('✅ NONE! No false stubs will be created.');
    } else {
        console.log(missingTypes.sort());
        console.log('\n=== Stubs that will be prepended ===');
        missingTypes.forEach(t => console.log(`CREATE TYPE "${t}" AS ENUM ('stub');`));
    }

    return processedSQL;
}

preprocessSQL(sqlFile);
