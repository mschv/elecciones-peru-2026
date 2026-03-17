interface Props {
  params: { slug: string }
}

export default function PartidoDetailPage({ params }: Props) {
  return (
    <main>
      <h1>Partido: {params.slug}</h1>
    </main>
  )
}
