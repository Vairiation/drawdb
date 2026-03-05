import { useDiagram, useSelect, useSettings } from "../hooks";
import { ObjectType } from "../data/constants";

export default function BottomBar() {
    const { tables } = useDiagram();
    const { selectedElement } = useSelect();
    const { settings } = useSettings();

    const selectedTable = tables.find((t) => t.id === selectedElement.id);

    if (
        !selectedTable ||
        selectedElement.element !== ObjectType.TABLE
    )
        return null;

    return (
        <div
            className={`absolute bottom-0 w-full flex items-center justify-between px-4 py-1 border-t select-none pointer-events-none z-10 ${settings.mode === "light"
                ? "bg-zinc-100 border-zinc-300 text-zinc-600"
                : "bg-zinc-800 border-zinc-700 text-zinc-300"
                }`}
        >
            <div className="flex gap-4 text-xs font-mono">
                <div className="font-bold">{selectedTable.name}</div>
                <div>x: {Math.round(selectedTable.x)}</div>
                <div>y: {Math.round(selectedTable.y)}</div>
            </div>
        </div>
    );
}
