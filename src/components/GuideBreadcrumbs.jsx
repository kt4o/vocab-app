export function GuideBreadcrumbs({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <nav className="guideBreadcrumbs" aria-label="Breadcrumb">
      <ol className="guideBreadcrumbList">
        {items.map((item, index) => {
          const key = `${item.name}-${index}`;
          const isLast = index === items.length - 1;
          return (
            <li key={key} className="guideBreadcrumbItem">
              {item.href && !isLast ? (
                <a href={item.href} className="guideBreadcrumbLink">
                  {item.name}
                </a>
              ) : (
                <span className="guideBreadcrumbCurrent" aria-current={isLast ? "page" : undefined}>
                  {item.name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

