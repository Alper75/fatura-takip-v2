import React from 'react';
import { Badge } from '@/components/ui/badge';

interface StokBadgeProps {
  miktar: number;
  minimumStok: number;
}

/**
 * A badge component that visually indicates the stock level status.
 * 
 * - Critical: miktar <= minimumStok * 0.5 (Red)
 * - Low: miktar <= minimumStok (Yellow)
 * - Sufficient: miktar > minimumStok (Green)
 */
export const StokBadge: React.FC<StokBadgeProps> = ({ miktar, minimumStok }) => {
  if (miktar <= minimumStok * 0.5) {
    return (
      <Badge variant="destructive" className="font-semibold px-2 py-0.5">
        Kritik Stok ({miktar})
      </Badge>
    );
  }

  if (miktar <= minimumStok) {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 font-semibold px-2 py-0.5">
        Düşük Stok ({miktar})
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 font-semibold px-2 py-0.5">
      Yeterli ({miktar})
    </Badge>
  );
};
