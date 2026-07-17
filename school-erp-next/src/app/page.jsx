'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [ready, user, router]);

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <span className="loading-spinner" style={{ borderTopColor: '#6c63ff', borderColor: 'rgba(108,99,255,0.2)' }} />
    </div>
  );
}
