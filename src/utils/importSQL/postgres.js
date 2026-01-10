import { nanoid } from "nanoid";
import { Cardinality, Constraint, DB } from "../../data/constants";
import { dbToTypes } from "../../data/datatypes";
import { buildSQLFromAST } from "./shared";

const affinity = {
  [DB.POSTGRES]: new Proxy(
    { INT: "INTEGER" },
    { get: (target, prop) => (prop in target ? target[prop] : "BLOB") },
  ),
  [DB.GENERIC]: new Proxy(
    {
      INTEGER: "INT",
      MEDIUMINT: "INTEGER",
      BIT: "BOOLEAN",
      "CHARACTER VARYING": "VARCHAR",
    },
    { get: (target, prop) => (prop in target ? target[prop] : "BLOB") },
  ),
};

export function fromPostgres(ast, diagramDb = DB.GENERIC) {
  const tables = [];
  const relationships = [];
  const types = [];
  const enums = [];

  const pendingRelationships = [];

  const parseSingleStatement = (e) => {
    if (e.type === "create") {
      if (e.keyword === "table") {
        const table = {};
        table.name = e.table[0].table;
        table.comment = "";
        table.color = "#175e7a";
        table.fields = [];
        table.indices = [];
        table.id = nanoid();
        e.create_definitions.forEach((d) => {
          const field = {};
          if (d.resource === "column") {
            field.id = nanoid();
            field.name = d.column.column.expr.value;

            let type = types.find((t) =>
              new RegExp(`^(${t.name}|"${t.name}")$`).test(
                d.definition.dataType,
              ),
            )?.name;
            type ??= enums.find((t) =>
              new RegExp(`^(${t.name}|"${t.name}")$`).test(
                d.definition.dataType,
              ),
            )?.name;

            type ??=
              dbToTypes[diagramDb][d.definition.dataType.toUpperCase()].type;
            type ??= affinity[diagramDb][d.definition.dataType.toUpperCase()];

            field.type = type;

            if (d.definition.expr && d.definition.expr.type === "expr_list") {
              field.values = d.definition.expr.value.map((v) => v.value);
            }
            field.comment = d.comment ? d.comment.value.value : "";
            field.unique = false;
            if (d.unique) field.unique = true;
            field.increment = false;
            if (d.auto_increment) field.increment = true;
            field.notNull = false;
            if (d.nullable) field.notNull = true;
            field.primary = false;
            if (d.primary_key) field.primary = true;
            field.default = "";
            if (d.default_val) {
              let defaultValue = "";
              if (d.default_val.value.type === "function") {
                defaultValue = d.default_val.value.name.name[0].value;
                if (d.default_val.value.args) {
                  defaultValue +=
                    "(" +
                    d.default_val.value.args.value
                      .map((v) => {
                        if (
                          v.type === "single_quote_string" ||
                          v.type === "double_quote_string"
                        )
                          return "'" + v.value + "'";
                        return v.value;
                      })
                      .join(", ") +
                    ")";
                }
              } else if (d.default_val.value.type === "null") {
                defaultValue = "NULL";
              } else if (d.default_val.value.type === "cast") {
                defaultValue = d.default_val.value.expr.value;
              } else if (d.default_val.value.type === "array") {
                defaultValue = `ARRAY[${d.default_val.value.expr_list.value
                  .map((v) => v.value ?? v.expr.value)
                  .join(", ")}]`;
              } else {
                defaultValue = expressionToString(d.default_val.value);
              }
              field.default = defaultValue;
            }
            if (d.definition["length"]) {
              if (d.definition.scale) {
                field.size = d.definition["length"] + "," + d.definition.scale;
              } else {
                field.size = d.definition["length"];
              }
            }
            field.check = "";
            if (d.check) {
              field.check = buildSQLFromAST(d.check.definition[0], DB.POSTGRES);
            }

            table.fields.push(field);

            // Handle inline foreign key
            if (d.reference_definition) {
              pendingRelationships.push({
                startTableName: table.name,
                startFieldName: field.name,
                endTableName: d.reference_definition.table[0].table,
                endFieldName: d.reference_definition.definition[0].column.expr.value,
                onUpdate: d.reference_definition.on_action.find(c => c.type === 'on update'),
                onDelete: d.reference_definition.on_action.find(c => c.type === 'on delete')
              });
            }

          } else if (d.resource === "constraint") {
            if (d.constraint_type === "primary key") {
              d.definition.forEach((c) => {
                table.fields.forEach((f) => {
                  if (f.name === c.column.expr.value && !f.primary) {
                    f.primary = true;
                  }
                });
              });
            } else if (d.constraint_type.toLowerCase() === "foreign key") {
              pendingRelationships.push({
                startTableName: table.name,
                startFieldName: d.definition[0].column.expr.value,
                endTableName: d.reference_definition.table[0].table,
                endFieldName: d.reference_definition.definition[0].column.expr.value,
                onUpdate: d.reference_definition.on_action.find(c => c.type === 'on update'),
                onDelete: d.reference_definition.on_action.find(c => c.type === 'on delete')
              });
            }
          }
        });
        tables.push(table);
      } else if (e.keyword === "index") {
        const index = {
          name: e.index,
          unique: e.index_type === "unique",
          fields: e.index_columns.map((f) => f.column.expr.value),
        };

        const table = tables.find((t) => t.name === e.table.table);

        if (table) {
          table.indices.push(index);
          table.indices.forEach((i, j) => {
            i.id = j;
          });
        }
      } else if (e.keyword === "type") {
        if (e.resource === "enum") {
          const newEnum = {
            id: nanoid(),
            name: e.name.name,
            values: e.create_definitions.value.map((x) => x.value),
          };
          enums.push(newEnum);
        } else if (Array.isArray(e.create_definitions)) {
          const type = {
            id: nanoid(),
            name: e.name.name,
            fields: [],
          };
          e.create_definitions.forEach((d) => {
            const field = {};
            if (d.resource === "column") {
              field.id = nanoid();
              field.name = d.column.column.expr.value;

              let type = d.definition.dataType;
              if (!dbToTypes[diagramDb][type]) {
                type = affinity[diagramDb][type];
              }
              field.type = type;
            }
            if (d.definition["length"]) {
              if (d.definition.scale) {
                field.size = d.definition["length"] + "," + d.definition.scale;
              } else {
                field.size = d.definition["length"];
              }
            }

            type.fields.push(field);
          });
          types.push(type);
        }
      }
    } else if (e.type === "alter") {
      if (Array.isArray(e.expr)) {
        e.expr.forEach((expr) => {
          if (
            expr.action === "add" &&
            expr.create_definitions.constraint_type.toLowerCase() ===
            "foreign key"
          ) {
            pendingRelationships.push({
              startTableName: e.table[0].table,
              startFieldName: expr.create_definitions.definition[0].column.expr.value,
              endTableName: expr.create_definitions.reference_definition.table[0].table,
              endFieldName: expr.create_definitions.reference_definition.definition[0].column.expr.value,
              onUpdate: expr.create_definitions.reference_definition.on_action.find(c => c.type === 'on update'),
              onDelete: expr.create_definitions.reference_definition.on_action.find(c => c.type === 'on delete')
            });
          }
        });
      }
    } else if (e.type === "comment") {
      if (e.target.type === "table") {
        const table = tables.find((t) => t.name === e.target?.name?.table);
        if (table) {
          table.comment = e.expr.expr.value;
        }
      } else if (e.target.type === "column") {
        const table = tables.find((t) => t.name === e.target?.name?.table);
        if (table) {
          const field = table.fields.find(
            (f) => f.name === e.target?.name?.column?.expr?.value,
          );
          if (field) {
            field.comment = e.expr.expr.value;
          }
        }
      }
    }
  };

  if (Array.isArray(ast)) {
    ast.forEach((e) => parseSingleStatement(e));
  } else {
    parseSingleStatement(ast);
  }

  // Resolve pending relationships
  pendingRelationships.forEach(r => {
    const startTable = tables.find((t) => t.name === r.startTableName);
    const endTable = tables.find((t) => t.name === r.endTableName);

    if (!startTable || !endTable) return;

    const startField = startTable.fields.find((f) => f.name === r.startFieldName);
    const endField = endTable.fields.find((f) => f.name === r.endFieldName);

    if (!startField || !endField) return;

    const relationship = {};
    relationship.name = `fk_${r.startTableName}_${r.startFieldName}_${r.endTableName}`;
    relationship.startTableId = startTable.id;
    relationship.startFieldId = startField.id;
    relationship.endTableId = endTable.id;
    relationship.endFieldId = endField.id;
    relationship.id = nanoid();

    let updateConstraint = Constraint.NONE;
    if (r.onUpdate) {
      updateConstraint = r.onUpdate.value.value;
      updateConstraint = updateConstraint[0].toUpperCase() + updateConstraint.substring(1);
    }
    relationship.updateConstraint = updateConstraint;

    let deleteConstraint = Constraint.NONE;
    if (r.onDelete) {
      deleteConstraint = r.onDelete.value.value;
      deleteConstraint = deleteConstraint[0].toUpperCase() + deleteConstraint.substring(1);
    }
    relationship.deleteConstraint = deleteConstraint;

    if (startField.unique) {
      relationship.cardinality = Cardinality.ONE_TO_ONE;
    } else {
      relationship.cardinality = Cardinality.MANY_TO_ONE;
    }

    relationships.push(relationship);
  });

  return { tables, relationships, types, enums };
}

function expressionToString(expr) {
  if (!expr) return "";
  if (expr.type === "binary_expr") {
    return `${expressionToString(expr.left)} ${expr.operator} ${expressionToString(expr.right)}`;
  }
  if (expr.type === "function") {
    const args = expr.args?.value
      ? expr.args.value.map((v) => expressionToString(v)).join(", ")
      : "";
    return `${expr.name.name[0].value}(${args})`;
  }
  if (expr.type === "column_ref") {
    return expr.column.expr.value;
  }
  if (expr.type === "single_quote_string" || expr.type === "string") {
    return `'${expr.value}'`;
  }
  if (expr.value !== undefined) {
    return expr.value.toString();
  }
  return "";
}
