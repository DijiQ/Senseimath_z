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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import {
  BookOpen, Users, Calendar as CalendarIcon, Bell, FileText, LogOut, Plus, Search,
  ChevronLeft, ChevronRight, Clock, User, X, Check, AlertCircle, Upload, Download,
  Trash2, Copy, MoreHorizontal, Settings, Menu
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, parseISO, setHours, setMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';

interface Student {
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
  students: { student: Student }[];
  files: { id: string; originalName: string; size: number }[];
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

export default function TutorPage() {
  const { user, isLoading, hasCheckedAuth, fetchUser, logout } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('schedule');
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: string; student: Student }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Form states
  const [showNewLesson, setShowNewLesson] = useState(false);
  const [showFindStudent, setShowFindStudent] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<Student | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonDate, setLessonDate] = useState<Date>();
  const [lessonTime, setLessonTime] = useState('10:00');
  const [lessonDuration, setLessonDuration] = useState(60);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Проверка авторизации только один раз
  useEffect(() => {
    if (!hasCheckedAuth && !authChecked) {
      setAuthChecked(true);
      fetchUser();
    }
  }, [hasCheckedAuth, authChecked, fetchUser]);

  // Редирект если не авторизован или не репетитор
  useEffect(() => {
    if (hasCheckedAuth && !user) {
      router.push('/auth/login');
    } else if (hasCheckedAuth && user?.role !== 'TUTOR') {
      router.push('/dashboard');
    }
  }, [user, hasCheckedAuth, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    const weekEndStr = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
    
    const [lessonsRes, studentsRes, requestsRes, notifRes] = await Promise.all([
      fetch(`/api/lessons?weekStart=${weekStartStr}&weekEnd=${weekEndStr}`),
      fetch('/api/students'),
      fetch('/api/invitations'),
      fetch('/api/notifications')
    ]);
    
    if (lessonsRes.ok) {
      const data = await lessonsRes.json();
      setLessons(data.lessons);
    }
    
    if (studentsRes.ok) {
      const data = await studentsRes.json();
      setStudents(data.students || []);
    }
    
    if (requestsRes.ok) {
      const data = await requestsRes.json();
      setPendingRequests(data.requests || []);
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

  const handleSearchStudent = async () => {
    if (!searchEmail) return;
    
    const res = await fetch(`/api/students?email=${encodeURIComponent(searchEmail)}`);
    if (res.ok) {
      const data = await res.json();
      setSearchResult(data.student);
    } else {
      setSearchResult(null);
      toast.error('Ученик не найден');
    }
  };

  const handleInviteStudent = async (studentId: string) => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId })
    });
    
    if (res.ok) {
      toast.success('Приглашение отправлено');
      setSearchResult(null);
      setSearchEmail('');
      setShowFindStudent(false);
    } else {
      const data = await res.json();
      toast.error(data.error || 'Ошибка отправки');
    }
  };

  const handleCreateLesson = async () => {
    if (!lessonTitle || !lessonDate || selectedStudents.length === 0) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    
    const [hours, minutes] = lessonTime.split(':').map(Number);
    const lessonDateTime = setMinutes(setHours(lessonDate, hours), minutes);
    
    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: lessonTitle,
        description: lessonDescription,
        date: lessonDateTime.toISOString(),
        duration: lessonDuration,
        studentIds: selectedStudents
      })
    });
    
    if (res.ok) {
      toast.success('Урок создан');
      setShowNewLesson(false);
      setLessonTitle('');
      setLessonDescription('');
      setSelectedStudents([]);
      fetchData();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Ошибка создания');
    }
  };

  const handleDuplicateWeek = async () => {
    const res = await fetch('/api/lessons/duplicate-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekStart: format(currentWeekStart, 'yyyy-MM-dd')
      })
    });
    
    if (res.ok) {
      toast.success('Расписание продублировано на следующую неделю');
      fetchData();
    } else {
      toast.error('Ошибка дублирования');
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

  const handleAcceptRequest = async (requestId: string) => {
    const res = await fetch(`/api/invitations/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' })
    });
    
    if (res.ok) {
      toast.success('Ученик добавлен');
      fetchData();
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    const res = await fetch(`/api/invitations/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' })
    });
    
    if (res.ok) {
      toast.success('Заявка отклонена');
      fetchData();
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
            variant={activeTab === 'students' ? 'default' : 'ghost'}
            className={`w-full justify-start ${activeTab === 'students' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <Users className="w-5 h-5 mr-3" />
            {sidebarOpen && 'Ученики'}
            {pendingRequests.length > 0 && sidebarOpen && (
              <Badge className="ml-auto bg-orange-500">{pendingRequests.length}</Badge>
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
              <AvatarFallback className="bg-emerald-500 text-white">
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
                          className={`p-4 cursor-pointer hover:bg-gray-50 ${!notif.read ? 'bg-emerald-50' : ''}`}
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
                <h1 className="text-2xl font-bold">Расписание</h1>
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDuplicateWeek}>
                  <Copy className="w-4 h-4 mr-2" />
                  Дублировать на следующую неделю
                </Button>
                <Dialog open={showNewLesson} onOpenChange={setShowNewLesson}>
                  <DialogTrigger asChild>
                    <Button className="bg-emerald-500 hover:bg-emerald-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Новый урок
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Создать урок</DialogTitle>
                      <DialogDescription>
                        Запланируйте новый урок с учениками
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Название урока *</Label>
                        <Input
                          value={lessonTitle}
                          onChange={e => setLessonTitle(e.target.value)}
                          placeholder="Тема урока"
                        />
                      </div>
                      <div>
                        <Label>Описание</Label>
                        <Textarea
                          value={lessonDescription}
                          onChange={e => setLessonDescription(e.target.value)}
                          placeholder="Дополнительная информация"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Дата *</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start">
                                <CalendarIcon className="w-4 h-4 mr-2" />
                                {lessonDate ? format(lessonDate, 'dd.MM.yyyy') : 'Выберите дату'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent>
                              <Calendar
                                mode="single"
                                selected={lessonDate}
                                onSelect={setLessonDate}
                                disabled={date => date < new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Время *</Label>
                          <Input
                            type="time"
                            value={lessonTime}
                            onChange={e => setLessonTime(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Длительность (мин)</Label>
                        <Select value={lessonDuration.toString()} onValueChange={v => setLessonDuration(Number(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 минут</SelectItem>
                            <SelectItem value="45">45 минут</SelectItem>
                            <SelectItem value="60">1 час</SelectItem>
                            <SelectItem value="90">1.5 часа</SelectItem>
                            <SelectItem value="120">2 часа</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Ученики *</Label>
                        <ScrollArea className="h-32 border rounded-md p-2">
                          {students.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                              Нет учеников. Добавьте учеников во вкладке "Ученики"
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {students.map(student => (
                                <label
                                  key={student.id}
                                  className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedStudents.includes(student.id)}
                                    onChange={e => {
                                      if (e.target.checked) {
                                        setSelectedStudents([...selectedStudents, student.id]);
                                      } else {
                                        setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                                  />
                                  <span>{student.name || student.username}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                      <Button className="w-full bg-emerald-500 hover:bg-emerald-600" onClick={handleCreateLesson}>
                        Создать урок
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Week Grid */}
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-7 gap-2 min-h-full">
                {weekDays.map(day => {
                  const dayLessons = getLessonsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={`rounded-lg border ${isToday ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className={`p-3 border-b ${isToday ? 'bg-emerald-500 text-white' : 'bg-gray-50'}`}>
                        <p className="font-medium">{format(day, 'EEEE', { locale: ru })}</p>
                        <p className="text-sm opacity-80">{format(day, 'd MMMM', { locale: ru })}</p>
                      </div>
                      <ScrollArea className="h-[calc(100vh-280px)]">
                        <div className="p-2 space-y-2">
                          {dayLessons.map(lesson => (
                            <Link
                              key={lesson.id}
                              href={`/lesson/${lesson.id}`}
                              className="block p-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:shadow-md transition-shadow"
                            >
                              <p className="font-medium truncate">{lesson.title}</p>
                              <div className="flex items-center gap-1 text-sm opacity-90 mt-1">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(lesson.date), 'HH:mm')} ({lesson.duration} мин)
                              </div>
                              <div className="flex items-center gap-1 text-sm opacity-90">
                                <Users className="w-3 h-3" />
                                {lesson.students.length} ученик(ов)
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
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="h-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Мои ученики</h1>
              <Dialog open={showFindStudent} onOpenChange={setShowFindStudent}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-500 hover:bg-emerald-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить ученика
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Найти ученика</DialogTitle>
                    <DialogDescription>
                      Введите email ученика, чтобы отправить ему приглашение
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={searchEmail}
                        onChange={e => setSearchEmail(e.target.value)}
                      />
                      <Button onClick={handleSearchStudent}>Найти</Button>
                    </div>
                    {searchResult && (
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={searchResult.avatar || undefined} />
                                <AvatarFallback>
                                  {searchResult.name?.[0] || searchResult.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{searchResult.name || searchResult.username}</p>
                                <p className="text-sm text-gray-500">{searchResult.email}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="bg-emerald-500 hover:bg-emerald-600"
                              onClick={() => handleInviteStudent(searchResult.id)}
                            >
                              Пригласить
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Tabs defaultValue="students">
              <TabsList>
                <TabsTrigger value="students">
                  Ученики ({students.length})
                </TabsTrigger>
                <TabsTrigger value="requests">
                  Заявки ({pendingRequests.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="students" className="mt-4">
                {students.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">У вас пока нет учеников</p>
                      <p className="text-sm text-gray-400 mt-2">Добавьте учеников, чтобы начать работу</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {students.map(student => (
                      <Card key={student.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={student.avatar || undefined} />
                              <AvatarFallback className="bg-emerald-500 text-white text-lg">
                                {student.name?.[0] || student.username[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{student.name || student.username}</p>
                              <p className="text-sm text-gray-500 truncate">{student.email}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="requests" className="mt-4">
                {pendingRequests.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Нет ожидающих заявок</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map(request => (
                      <Card key={request.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={request.student.avatar || undefined} />
                                <AvatarFallback>
                                  {request.student.name?.[0] || request.student.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{request.student.name || request.student.username}</p>
                                <p className="text-sm text-gray-500">{request.student.email}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeclineRequest(request.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-500 hover:bg-emerald-600"
                                onClick={() => handleAcceptRequest(request.id)}
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
            <h1 className="text-2xl font-bold mb-6">Все уроки</h1>
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
                          <Clock className="w-4 h-4" />
                          {lesson.duration} минут
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <Users className="w-4 h-4" />
                          {lesson.students.map(s => s.student.name || s.student.username).join(', ')}
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
