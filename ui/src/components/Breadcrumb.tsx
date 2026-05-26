type Item = {
  label: string;
  onClick?: () => void;
};

type Props = {
  items: Item[];
};

export default function Breadcrumb({ items }: Props) {
  return (
    <nav className="flex items-center text-sm mb-2 mt-2">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center">
            {/* item */}
            {!isLast ? (
              <span
                onClick={item.onClick}
                className="text-blue-600 hover:underline cursor-pointer font-medium"
              >
                {item.label}
              </span>
            ) : (
              <span className="text-gray-900 font-medium">
                {item.label}
              </span>
            )}

            {/* separator */}
            {!isLast && (
              <span className="mx-2 text-gray-400 text-xs">
                &gt;
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}