'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  BookOpen, Users, Calendar as CalendarIcon, Bell, FileText, LogOut,
  ChevronLeft, ChevronRight, Clock, User, X, Check, AlertCircle,
  Download, Menu, ExternalLink
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';

interface Tutor {
  id: string;
  name: string | null;
  email: string;
  username: string;
  avatar: string | null;
}

interface StudentInfo {
  id: string;
  name: string | null;
  email: string;
  username: string;
  avatar: string | null;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  date: string;
  duration: number;
  tutor: {
    id: string;
    name: string | null;
    email: string;
    username: string;
    avatar: string | null;
  };
  students: { student: StudentInfo }[];
  files: { id: string; originalName: string; size: number; mimeType: string }[];
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data: string | null;
}

interface Invitation {
  id: string;
  tutor: Tutor;
}

export default function StudentPage() {
  const { user, isLoading, fetchUser, logout } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('schedule');
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (!isLoading && user?.role !== 'STUDENT') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    const weekEndStr = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
    
    const [lessonsRes, tutorsRes, invitationsRes, notifRes] = await Promise.all([
      fetch(`/api/lessons?weekStart=${weekStartStr}&weekEnd=${weekEndStr}`),
      fetch('/api/students'),
      fetch('/api/invitations'),
      fetch('/api/notifications')
    ]);
    
    if (lessonsRes.ok) {
      const data = await lessonsRes.json();
      setLessons(data.lessons);
    }
    
    if (tutorsRes.ok) {
      const data = await tutorsRes.json();
      setTutors(data.tutors || []);
    }
    
    if (invitationsRes.ok) {
      const data = await invitationsRes.json();
      setPendingInvitations(data.requests || []);
    }
    
    if (notifRes.ok) {
      const data = await notifRes.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    }
  }, [user, currentWeekStart]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handlePrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const handleToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const handleAcceptInvitation = async (requestId: string) => {
    const res = await fetch(`/api/invitations/${requestId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' })
    });
    
    if (res.ok) {
      toast.success('Приглашение принято');
      fetchData();
    } else {
      toast.error('Ошибка');
    }
  };

  const handleDeclineInvitation = async (requestId: string) => {
    const res = await fetch(`/api/invitations/${requestId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' })
    });
    
    if (res.ok) {
      toast.success('Приглашение отклонено');
      fetchData();
    } else {
      toast.error('Ошибка');
    }
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId })
    });
    fetchData();
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true })
    });
    fetchData();
  };

  const handleDownloadFile = async (fileId: string, filename: string) => {
    const res = await fetch(`/api/files/${fileId}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      toast.error('Ошибка скачивания файла');
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  
  const getLessonsForDay = (day: Date) => {
    return lessons.filter(lesson => isSameDay(parseISO(lesson.date), day));
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-emerald-100 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-emerald-100">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Senseimath
                </span>
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Button
            variant={activeTab === 'schedule' ? 'default' : 'ghost'}
            className={`w-full justify-start ${activeTab === 'schedule' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <CalendarIcon className="w-5 h-5 mr-3" />
            {sidebarOpen && 'Расписание'}
          </Button>
          
          <Button
            variant={activeTab === 'tutors' ? 'default' : 'ghost'}
            className={`w-full justify-start ${activeTab === 'tutors' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
            onClick={() => setActiveTab('tutors')}
          >
            <Users className="w-5 h-5 mr-3" />
            {sidebarOpen && 'Репетиторы'}
            {pendingInvitations.length > 0 && sidebarOpen && (
              <Badge className="ml-auto bg-orange-500">{pendingInvitations.length}</Badge>
            )}
          </Button>
          
          <Button
            variant={activeTab === 'lessons' ? 'default' : 'ghost'}
            className={`w-full justify-start ${activeTab === 'lessons' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
            onClick={() => setActiveTab('lessons')}
          >
            <BookOpen className="w-5 h-5 mr-3" />
            {sidebarOpen && 'Уроки'}
          </Button>
        </nav>
        
        <div className="p-4 border-t border-emerald-100">
          <div className="flex items-center gap-3 mb-4">
            <Avatar>
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback className="bg-teal-500 text-white">
                {user.name?.[0] || user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.name || user.username}</p>
                <p className="text-sm text-gray-500 truncate">{user.email}</p>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Popover open={showNotifications} onOpenChange={setShowNotifications}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-semibold">Уведомления</h3>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                      Прочитать все
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-80">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Нет уведомлений
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map(notif => (
                        <div
                          key={notif.id}
                          className={`p-4 cursor-pointer hover:bg-gray-50 ${!notif.read ? 'bg-teal-50' : ''}`}
                          onClick={() => handleMarkNotificationRead(notif.id)}
                        >
                          <p className="font-medium text-sm">{notif.title}</p>
                          <p className="text-sm text-gray-600">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(notif.createdAt), 'dd.MM.yyyy HH:mm')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="h-full flex flex-col p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold">Моё расписание</h1>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button variant="outline" onClick={handleToday}>Сегодня</Button>
                  <Button variant="outline" size="icon" onClick={handleNextWeek}>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
                <span className="text-lg text-gray-600">
                  {format(currentWeekStart, 'd MMMM', { locale: ru })} - {format(addDays(currentWeekStart, 6), 'd MMMM yyyy', { locale: ru })}
                </span>
              </div>
            </div>

            {tutors.length === 0 ? (
              <Card className="flex-1">
                <CardContent className="p-8 text-center flex flex-col items-center justify-center h-full">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-xl text-gray-500 mb-2">У вас пока нет репетиторов</p>
                  <p className="text-sm text-gray-400">Дождитесь приглашения от репетитора или перейдите во вкладку "Репетиторы"</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-7 gap-2 min-h-full">
                  {weekDays.map(day => {
                    const dayLessons = getLessonsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={`rounded-lg border ${isToday ? 'border-teal-500 bg-teal-50/50' : 'border-gray-200 bg-white'}`}
                      >
                        <div className={`p-3 border-b ${isToday ? 'bg-teal-500 text-white' : 'bg-gray-50'}`}>
                          <p className="font-medium">{format(day, 'EEEE', { locale: ru })}</p>
                          <p className="text-sm opacity-80">{format(day, 'd MMMM', { locale: ru })}</p>
                        </div>
                        <ScrollArea className="h-[calc(100vh-280px)]">
                          <div className="p-2 space-y-2">
                            {dayLessons.map(lesson => (
                              <Link
                                key={lesson.id}
                                href={`/lesson/${lesson.id}`}
                                className="block p-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:shadow-md transition-shadow"
                              >
                                <p className="font-medium truncate">{lesson.title}</p>
                                <div className="flex items-center gap-1 text-sm opacity-90 mt-1">
                                  <Clock className="w-3 h-3" />
                                  {format(parseISO(lesson.date), 'HH:mm')} ({lesson.duration} мин)
                                </div>
                                <div className="flex items-center gap-1 text-sm opacity-90">
                                  <User className="w-3 h-3" />
                                  {lesson.tutor.name || lesson.tutor.username}
                                </div>
                              </Link>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tutors Tab */}
        {activeTab === 'tutors' && (
          <div className="h-full p-6">
            <h1 className="text-2xl font-bold mb-6">Мои репетиторы</h1>

            <Tabs defaultValue="tutors">
              <TabsList>
                <TabsTrigger value="tutors">
                  Репетиторы ({tutors.length})
                </TabsTrigger>
                <TabsTrigger value="invitations">
                  Приглашения ({pendingInvitations.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="tutors" className="mt-4">
                {tutors.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">У вас пока нет репетиторов</p>
                      <p className="text-sm text-gray-400 mt-2">Дождитесь приглашения от репетитора</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tutors.map(tutor => (
                      <Card key={tutor.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={tutor.avatar || undefined} />
                              <AvatarFallback className="bg-teal-500 text-white text-lg">
                                {tutor.name?.[0] || tutor.username[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{tutor.name || tutor.username}</p>
                              <p className="text-sm text-gray-500 truncate">{tutor.email}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="invitations" className="mt-4">
                {pendingInvitations.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Нет ожидающих приглашений</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {pendingInvitations.map(invitation => (
                      <Card key={invitation.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={invitation.tutor.avatar || undefined} />
                                <AvatarFallback>
                                  {invitation.tutor.name?.[0] || invitation.tutor.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{invitation.tutor.name || invitation.tutor.username}</p>
                                <p className="text-sm text-gray-500">{invitation.tutor.email}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeclineInvitation(invitation.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                className="bg-teal-500 hover:bg-teal-600"
                                onClick={() => handleAcceptInvitation(invitation.id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Lessons Tab */}
        {activeTab === 'lessons' && (
          <div className="h-full p-6">
            <h1 className="text-2xl font-bold mb-6">Мои уроки</h1>
            {lessons.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">У вас пока нет запланированных уроков</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lessons.map(lesson => (
                  <Link key={lesson.id} href={`/lesson/${lesson.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardHeader>
                        <CardTitle className="text-lg">{lesson.title}</CardTitle>
                        <CardDescription>
                          {format(parseISO(lesson.date), 'd MMMM yyyy, HH:mm', { locale: ru })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <User className="w-4 h-4" />
                          {lesson.tutor.name || lesson.tutor.username}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <Clock className="w-4 h-4" />
                          {lesson.duration} минут
                        </div>
                        {lesson.files.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <FileText className="w-4 h-4" />
                            {lesson.files.length} файл(ов)
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
