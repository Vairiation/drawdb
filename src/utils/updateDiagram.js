import { fromDBML } from "./importFrom/dbml";
import { Toast } from "@douyinfe/semi-ui";

export function updateDiagramFromDBML(
    dbmlString,
    currentDiagram,
    setTables,
    setRelationships,
    setEnums
) {
    try {
        const parsedDiagram = fromDBML(dbmlString, { skipLayout: true });

        // 1. Merge Tables
        const mergedTables = parsedDiagram.tables.map((parsedTable) => {
            const existingTable = currentDiagram.tables.find(
                (t) => t.name === parsedTable.name
            );

            if (existingTable) {
                // Preserve position, color, and ID from existing table
                return {
                    ...parsedTable,
                    id: existingTable.id,
                    x: existingTable.x,
                    y: existingTable.y,
                    color: existingTable.color,
                };
            } else {
                // New table
                return {
                    ...parsedTable,
                    x: 0,
                    y: 0,
                };
            }
        });

        // 2. Re-map Relationships
        const idMap = new Map();
        // Map Parsed Table ID -> Final Table ID
        parsedDiagram.tables.forEach((parsedTable) => {
            const merged = mergedTables.find((t) => t.name === parsedTable.name);
            if (merged) {
                idMap.set(parsedTable.id, merged.id);
            }
        });

        const finalTables = mergedTables.map((table) => {
            const existingTable = currentDiagram.tables.find(
                (t) => t.id === table.id
            );

            if (existingTable) {
                // Match fields to preserve IDs
                const mergedFields = table.fields.map((parsedField) => {
                    const existingField = existingTable.fields.find(
                        (f) => f.name === parsedField.name
                    );
                    if (existingField) {
                        return { ...parsedField, id: existingField.id };
                    }
                    return parsedField;
                });
                return { ...table, fields: mergedFields };
            }
            return table;
        });

        // Re-build field map for relationship fixup
        const fieldIdMap = new Map();
        parsedDiagram.tables.forEach((parsedTable) => {
            const finalTable = finalTables.find((t) => t.name === parsedTable.name);
            if (finalTable) {
                parsedTable.fields.forEach((parsedField) => {
                    const finalField = finalTable.fields.find(f => f.name === parsedField.name);
                    if (finalField) {
                        fieldIdMap.set(parsedField.id, finalField.id);
                    }
                });
            }
        });

        const finalRelationships = parsedDiagram.relationships.map((rel) => {
            return {
                ...rel,
                startTableId: idMap.get(rel.startTableId) || rel.startTableId,
                endTableId: idMap.get(rel.endTableId) || rel.endTableId,
                startFieldId: fieldIdMap.get(rel.startFieldId) || rel.startFieldId,
                endFieldId: fieldIdMap.get(rel.endFieldId) || rel.endFieldId,
            };
        });

        setTables(finalTables);
        setRelationships(finalRelationships);
        setEnums(parsedDiagram.enums);
        Toast.success("Diagram updated from DBML");
    } catch (error) {
        console.error("Error updating diagram from DBML:", error);
        console.error("Error updating diagram from DBML:", error);
        let errorMessage = error.message || "Unknown error";

        if (error.diags && error.diags.length > 0) {
            errorMessage = error.diags.map(d => `${d.message} (Line ${d.location.start.line})`).join('\n');
        } else if (typeof error === 'object') {
            try {
                errorMessage = JSON.stringify(error);
            } catch (e) {
                errorMessage = error.toString();
            }
        }

        if (errorMessage.includes("Can not find Table")) {
            errorMessage += "\n\nTip: Did you rename a table? Make sure to update the table name in the 'Ref' (Relationship) definitions too.";
        }

        Toast.error(`Failed to parse DBML: ${errorMessage}`);
    }
}
