"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Restaurant } from "@/lib/types";
import { KitchenDisplayView } from "@/components/KitchenDisplayView";

function KitchenContent() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => {
    async function loadRestaurant() {
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (data) {
        setRestaurant(data);
      }
    }

    loadRestaurant();
  }, []);

  const restaurantId = restaurant?.id || "9435081d-0f91-4ae5-97aa-30df127d569d";
  const restaurantName = restaurant?.name || "Burjobae";

  return (
    <div className="min-h-screen bg-[#121316]">
      <KitchenDisplayView
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        isStandalone={true}
      />
    </div>
  );
}

export default function KitchenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#121316] flex items-center justify-center text-white">
          <div className="flex flex-col items-center gap-3">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
            <p className="text-xs text-gray-400">Memuat Layar Dapur (KDS)...</p>
          </div>
        </div>
      }
    >
      <KitchenContent />
    </Suspense>
  );
}
