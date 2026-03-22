'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useAuth } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, Calendar, Palette, Bell, FileText } from 'lucide-react';

export default function Home() {
  const { user, isLoading, fetchUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const features = [
    {
      icon: Calendar,
      title: 'Умное расписание',
      description: 'Планируйте уроки с удобным календарём. Дублируйте расписание на следующие недели одним кликом.'
    },
    {
      icon: Users,
      title: 'Управление учениками',
      description: 'Отправляйте приглашения ученикам и ведите список своих подопечных.'
    },
    {
      icon: Palette,
      title: 'Интерактивная доска',
      description: 'Рисуйте, пишите и объясняйте материал на виртуальной доске в реальном времени.'
    },
    {
      icon: Bell,
      title: 'Уведомления',
      description: 'Будьте в курсе новых уроков, файлов и приглашений.'
    },
    {
      icon: FileText,
      title: 'Файлообмен',
      description: 'Загружайте материалы к урокам: PDF, изображения и документы.'
    },
    {
      icon: BookOpen,
      title: 'Групповые уроки',
      description: 'Добавляйте нескольких учеников на один урок для групповых занятий.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b border-emerald-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Senseimath
            </span>
          </Link>
          <div className="flex gap-3">
            <Link href="/auth/login">
              <Button variant="ghost" className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50">
                Войти
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white">
                Регистрация
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent leading-tight">
            Платформа для репетиторов и учеников
          </h1>
          <p className="text-xl text-gray-600 mb-10">
            Организуйте обучение эффективно: расписание, интерактивная доска, файлы и уведомления — всё в одном месте.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-8 h-14 text-lg">
                Начать бесплатно
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-8 h-14 text-lg">
                Уже есть аккаунт?
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
          Всё для эффективного обучения
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 bg-white rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-800">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Готовы начать?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Присоединяйтесь к тысячам репетиторов и учеников
          </p>
          <Link href="/auth/register">
            <Button size="lg" className="bg-white text-emerald-600 hover:bg-gray-100 px-8 h-14 text-lg">
              Создать аккаунт
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-emerald-100 bg-white/80">
        <div className="container mx-auto px-4 py-8 text-center text-gray-500">
          <p>© 2024 Senseimath. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}
