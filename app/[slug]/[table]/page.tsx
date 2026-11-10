import { Suspense } from "react";
import { CustomerOrderView } from "@/components/CustomerOrderView";

interface PageProps {
  params: Promise<{
    slug: string;
    table: string;
  }>;
}

async function TableOrderContent({ params }: PageProps) {
  const { slug, table } = await params;
  return <CustomerOrderView restaurantSlug={slug} tableParam={table} />;
}

export default function TableOrderPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#fbfbfa]">
          <div className="flex flex-col items-center gap-3">
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-[#E87532] border-t-transparent" />
            <p className="text-xs font-semibold text-gray-500">Memuat Menu Restoran...</p>
          </div>
        </div>
      }
    >
      <TableOrderContent params={params} />
    </Suspense>
  );
}
