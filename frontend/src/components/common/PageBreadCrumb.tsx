import Link from "next/link";
import React from "react";

interface BreadcrumbItem {
  title: string;
  route?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  const multipleItems = items.length > 1;

  const breadcrumbs = multipleItems
    ? items
    : [{ title: "Home", route: "/" }, ...items];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
        {items[items.length - 1].title}
      </h2>
      <nav>
        <ol className="flex items-center gap-1.5">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <li key={index} className="flex items-center gap-1.5">
                {isLast || !item.route ? (
                  <span className="text-sm text-gray-800 dark:text-white/90">
                    {item.title}
                  </span>
                ) : (
                  <Link
                    href={item.route}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                  >
                    {item.title}
                    <svg
                      className="stroke-current"
                      width="17"
                      height="16"
                      viewBox="0 0 17 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                        stroke=""
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;