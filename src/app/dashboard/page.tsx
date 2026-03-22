'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth-store';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user, initialized, fetchUser } = useAuth();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!initialized && !authChecked) {
      setAuthChecked(true);
      fetchUser();
    }
  }, [initialized, authChecked, fetchUser]);

  useEffect(() => {
    if (initialized && !user) {
      router.push('/auth/login');
    } else if (initialized && user) {
      if (user.role === 'TUTOR') {
        router.push('/tutor');
      } else {
        router.push('/student');
      }
    }
  }, [user, initialized, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto mb-4" />
        <p className="text-gray-600">Загрузка...</p>
      </div>
    </div>
  );
}
