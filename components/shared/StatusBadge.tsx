type ProcesoValue = "en_curso" | "en_apelacion" | "archivado" | "anulado" | "sentencia_firme" | "sentencia_condenatoria" | "sentencia_absolutoria" | "sentencia_civil" | "pena_cumplida" | "prescrito";

interface Props {
  type: "proceso" | "education" | "incumbent" | "first_time" | "clean";
  value: string;
  count?: number;
}

interface BadgeStyle {
  bg: string;
  text: string;
  icon: string;
}

function resolveStyle(type: Props["type"], value: string): BadgeStyle {
  if (type === "proceso") {
    const v = value as ProcesoValue;
    if (v === "sentencia_firme" || v === "sentencia_condenatoria") return { bg: "bg-gray-800", text: "text-white", icon: "" };
    if (v === "sentencia_civil") return { bg: "bg-orange-600", text: "text-white", icon: "" };
    if (v === "pena_cumplida") return { bg: "bg-gray-500", text: "text-white", icon: "" };
    if (v === "sentencia_absolutoria") return { bg: "bg-green-600", text: "text-white", icon: "" };
    if (v === "en_curso") return { bg: "bg-red-600", text: "text-white", icon: "" };
    if (v === "en_apelacion") return { bg: "bg-amber-500", text: "text-white", icon: "" };
    if (v === "archivado") return { bg: "bg-blue-600", text: "text-white", icon: "" };
    if (v === "anulado") return { bg: "bg-blue-600", text: "text-white", icon: "" };
    if (v === "prescrito") return { bg: "bg-gray-400", text: "text-white", icon: "" };
  }
  if (type === "clean") return { bg: "bg-green-600", text: "text-white", icon: "" };
  if (type === "incumbent") return { bg: "bg-blue-600", text: "text-white", icon: "" };
  if (type === "first_time") return { bg: "bg-amber-500", text: "text-white", icon: "" };
  return { bg: "bg-gray-500", text: "text-white", icon: "" };
}

const valueLabels: Record<string, string> = {
  sentencia_firme: "Sentencia firme",
  sentencia_condenatoria: "Sentencia firme",
  sentencia_civil: "Sentencia civil",
  pena_cumplida: "Pena cumplida",
  sentencia_absolutoria: "Absuelto",
  en_curso: "En curso",
  en_apelacion: "En apelación",
  archivado: "Archivado",
  anulado: "Anulado",
  prescrito: "Prescrito",
  clean: "Sin procesos",
  incumbent: "Titular",
  first_time: "Primera vez",
};

export default function StatusBadge({ type, value, count }: Props) {
  const { bg, text, icon } = resolveStyle(type, value);
  const label = valueLabels[value] ?? value;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
      {count !== undefined && (
        <span className="ml-0.5 font-bold">({count})</span>
      )}
    </span>
  );
}
