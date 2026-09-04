"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SwapPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/trade');
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <p className="text-gray-400 font-medium">Redirecting to Pro Trade...</p>
    </div>
  );
}
