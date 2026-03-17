interface Props {
  source_url: string;
  last_scraped_at: string;
}

export default function DataSourceNote({ source_url, last_scraped_at }: Props) {
  const date = new Date(last_scraped_at).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="text-[11px] text-gray-400 text-right leading-relaxed">
      <div>
        Datos obtenidos del{" "}
        <a
          href={source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-600 transition-colors"
        >
          JNE
        </a>
      </div>
      <div>Actualizado {date}</div>
    </div>
  );
}
