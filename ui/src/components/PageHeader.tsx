type BreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
};

export default function PageHeader({ title, breadcrumbs }: Props) {
  return (
    <div className="flex items-center justify-between">

      {/* LINKS: title + breadcrumbs in één lijn */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">
          {title}
        </h1>

        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="text-sm text-gray-400">
            {breadcrumbs.map((bc, i) => (
              <span key={i}>
                {bc.href ? (
                  <a href={bc.href} className="hover:underline">{bc.label}</a>
                ) : (
                  bc.label
                )}
                {i < breadcrumbs.length - 1 && " / "}
              </span>
            ))}
          </nav>
        )}
      </div>

    </div>
  );
}
