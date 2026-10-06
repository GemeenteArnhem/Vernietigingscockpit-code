import type { ComponentProps } from "react";

import PageHeader from "./PageHeader";

// De kopbalk boven een pagina (titel, icoon, eventueel breadcrumbs). Gedeeld door AppShell en
// pagina's met een eigen kop (bijv. 'Taken - nieuw'), zodat ze er precies hetzelfde uitzien.
export default function PageHeaderBar(props: ComponentProps<typeof PageHeader>) {
  return (
    <div className="shrink-0 border-b border-gray-200 bg-white">
      <div className="flex h-[69px] items-center px-5">
        <PageHeader {...props} />
      </div>
    </div>
  );
}
