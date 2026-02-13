'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ServantPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/servant/my-orders');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
    </div>
  );
}
