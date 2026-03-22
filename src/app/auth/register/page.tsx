'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Loader2, User, GraduationCap } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'TUTOR' | 'STUDENT'>('STUDENT');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, user, isLoading: authLoading, fetchUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setIsLoading(true);

    const result = await register(email, username, password, name, role);
    
    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Ошибка регистрации');
    }
    
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Senseimath
            </span>
          </Link>
        </div>

        {/* Register Card */}
        <Card className="border-emerald-100 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-gray-800">Регистрация</CardTitle>
            <CardDescription>
              Создайте аккаунт для начала работы
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                  {error}
                </div>
              )}
              
              {/* Role Selection */}
              <div className="space-y-2">
                <Label>Я:</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('TUTOR')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      role === 'TUTOR'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <User className="w-6 h-6 mx-auto mb-2" />
                    <span className="font-medium">Репетитор</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('STUDENT')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      role === 'STUDENT'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <GraduationCap className="w-6 h-6 mx-auto mb-2" />
                    <span className="font-medium">Ученик</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Имя (опционально)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Иван Иванов"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Имя пользователя</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="ivan_ivanov"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Минимум 6 символов"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Регистрация...
                  </>
                ) : (
                  'Зарегистрироваться'
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center text-sm text-gray-600">
              Уже есть аккаунт?{' '}
              <Link href="/auth/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
                Войти
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
