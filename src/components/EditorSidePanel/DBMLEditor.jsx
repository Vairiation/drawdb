import { useEffect, useState } from "react";
import { useDiagram, useEnums, useLayout } from "../../hooks";
import { toDBML } from "../../utils/exportAs/dbml";
import { Button, Tooltip } from "@douyinfe/semi-ui";
import {
  IconTemplate,
  IconEdit,
  IconSave,
  IconClose,
} from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";
import CodeEditor from "../CodeEditor";
import { updateDiagramFromDBML } from "../../utils/updateDiagram";

export default function DBMLEditor() {
  const { tables: currentTables, relationships, setTables, setRelationships } = useDiagram();
  const diagram = useDiagram();
  const { enums, setEnums } = useEnums();
  const [value, setValue] = useState(() => toDBML({ ...diagram, enums }));
  const [isEditing, setIsEditing] = useState(false);
  const { setLayout } = useLayout();
  const { t } = useTranslation();

  const toggleDBMLEditor = () => {
    setLayout((prev) => ({ ...prev, dbmlEditor: !prev.dbmlEditor }));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    updateDiagramFromDBML(
      value,
      { tables: currentTables, relationships, enums },
      setTables,
      setRelationships,
      setEnums
    );
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(toDBML({ tables: currentTables, enums, relationships }));
    setIsEditing(false);
  };

  useEffect(() => {
    if (!isEditing) {
      setValue(toDBML({ tables: currentTables, enums, relationships }));
    }
  }, [currentTables, enums, relationships, isEditing]);

  return (
    <CodeEditor
      showCopyButton
      value={value}
      language="dbml"
      onChange={setValue}
      height="100%"
      options={{
        readOnly: !isEditing,
        minimap: { enabled: false },
      }}
      extraControls={
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Tooltip content={t("save")}>
                <Button
                  icon={<IconSave />}
                  onClick={handleSave}
                  theme="solid"
                  type="primary"
                />
              </Tooltip>
              <Tooltip content={t("cancel")}>
                <Button
                  icon={<IconClose />}
                  onClick={handleCancel}
                  theme="solid"
                  type="danger"
                />
              </Tooltip>
            </>
          ) : (
            <Tooltip content={t("edit")}>
              <Button icon={<IconEdit />} onClick={handleEdit} />
            </Tooltip>
          )}
          <Tooltip content={t("tab_view")}>
            <Button icon={<IconTemplate />} onClick={toggleDBMLEditor} />
          </Tooltip>
        </div>
      }
    />
  );
}
