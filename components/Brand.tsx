type BrandProps = { linked?: boolean };

function Mark() {
  return <span className="logo" aria-hidden="true">
    <svg viewBox="0 0 48 48" role="presentation">
      <circle cx="24" cy="24" r="13.5" />
      <path d="M10.5 24h27M24 10.5c5 4.2 7.5 8.7 7.5 13.5S29 33.3 24 37.5c-5-4.2-7.5-8.7-7.5-13.5S19 14.7 24 10.5Z" />
      <path d="M13.7 16.5h20.6M13.7 31.5h20.6" />
    </svg>
  </span>;
}

export default function Brand({ linked = false }: BrandProps) {
  const contents = <><Mark /><span className="brandWords"><strong>GeoStats</strong><small>Geography, with strategy</small></span></>;
  return linked
    ? <a href="/daily" className="brand brandLink" aria-label="GeoStats home">{contents}</a>
    : <div className="brand">{contents}</div>;
}
