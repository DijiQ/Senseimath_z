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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import {
  BookOpen, Users, Calendar as CalendarIcon, Bell, FileText, LogOut, Plus, Search,
  ChevronLeft, ChevronRight, Clock, User, X, Check, AlertCircle,
  Trash2, Copy, Menu, StickyNote, Edit, ExternalLink, UserPlus
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
  isManual?: boolean;
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

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    name: string | null;
    username: string;
  };
}

export default function TutorPage() {
  const { user, isLoading, initialized, fetchUser, logout } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('schedule');
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: string; student: Student }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Form states
  const [showNewLesson, setShowNewLesson] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<Student | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [manualName, setManualName] = useState('');
  const [addMode, setAddMode] = useState<'search' | 'manual'>('manual');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonDate, setLessonDate] = useState<Date>();
  const [lessonTime, setLessonTime] = useState('10:00');
  const [lessonDuration, setLessonDuration] = useState(60);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  
  // Note form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStudentId, setNoteStudentId] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    if (!initialized && !authChecked) {
      setAuthChecked(true);
      fetchUser();
    }
  }, [initialized, authChecked, fetchUser]);

  useEffect(() => {
    if (initialized && !user) {
      router.push('/auth/login');
    } else if (initialized && user?.role !== 'TUTOR') {
      router.push('/dashboard');
    }
  }, [user, initialized, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    const weekEndStr = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
    
    try {
      const [lessonsRes, studentsRes, requestsRes, notifRes, notesRes] = await Promise.all([
        fetch(`/api/lessons?weekStart=${weekStartStr}&weekEnd=${weekEndStr}`),
        fetch('/api/students'),
        fetch('/api/invitations'),
        fetch('/api/notifications'),
        fetch('/api/notes')
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
      
      if (notesRes.ok) {
        const data = await notesRes.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Fetch data error:', error);
    }
  }, [user, currentWeekStart]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handlePrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const handleToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const handleSearchStudent = async () => {
    if (!searchEmail.trim()) return;
    
    setSearching(true);
    setSearchNotFound(false);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/students?email=${encodeURIComponent(searchEmail.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResult(data.student);
        setSearchNotFound(false);
      } else {
        setSearchResult(null);
        setSearchNotFound(true);
      }
    } catch (error) {
      setSearchResult(null);
      setSearchNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const handleInviteStudent = async (studentId: string) => {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.created ? 'Ученик создан и добавлен' : 'Приглашение отправлено');
        setSearchResult(null);
        setSearchEmail('');
        setManualName('');
        setSearchNotFound(false);
        setShowAddStudent(false);
        fetchData();
      } else {
        toast.error(data.error || 'Ошибка');
      }
    } catch (error) {
      console.error('Invite student error:', error);
      toast.error('Ошибка соединения');
    }
  };

  const handleCreateManualStudent = async (email?: string) => {
    const nameToUse = manualName.trim();
    if (!nameToUse) {
      toast.error('Введите имя ученика');
      return;
    }
    
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: nameToUse,
          studentEmail: email || undefined,
          createManual: true 
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Ученик создан');
        setManualName('');
        setSearchEmail('');
        setSearchResult(null);
        setSearchNotFound(false);
        setShowAddStudent(false);
        fetchData();
      } else {
        toast.error(data.error || 'Ошибка создания');
      }
    } catch (error) {
      console.error('Create manual student error:', error);
      toast.error('Ошибка соединения');
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('Удалить ученика из списка?')) return;
    
    try {
      const res = await fetch(`/api/students?studentId=${studentId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        toast.success('Ученик удалён');
        fetchData();
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Ошибка соединения');
    }
  };

  const handleCreateLesson = async () => {
    if (!lessonTitle || !lessonDate || selectedStudents.length === 0) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    
    const [hours, minutes] = lessonTime.split(':').map(Number);
    const lessonDateTime = setMinutes(setHours(lessonDate, hours), minutes);
    
    try {
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
    } catch (error) {
      toast.error('Ошибка соединения');
    }
  };

  const handleDuplicateWeek = async () => {
    if (!confirm('Дублировать расписание на следующую неделю?')) return;
    
    try {
      const res = await fetch('/api/lessons/duplicate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: format(currentWeekStart, 'yyyy-MM-dd')
        })
      });
      
      if (res.ok) {
        toast.success('Расписание продублировано');
        fetchData();
      } else {
        toast.error('Ошибка дублирования');
      }
    } catch (error) {
      toast.error('Ошибка соединения');
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

  const handleCreateNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim() || !noteStudentId) {
      toast.error('Заполните все поля');
      return;
    }
    
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: noteStudentId,
          title: noteTitle,
          content: noteContent
        })
      });
      
      if (res.ok) {
        toast.success('Заметка создана');
        setShowNewNote(false);
        setNoteTitle('');
        setNoteContent('');
        setNoteStudentId('');
        fetchData();
      } else {
        toast.error('Ошибка создания');
      }
    } catch (error) {
      toast.error('Ошибка соединения');
    }
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !noteTitle.trim() || !noteContent.trim()) {
      toast.error('Заполните все поля');
      return;
    }
    
    try {
      const res = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: editingNote.id,
          title: noteTitle,
          content: noteContent
        })
      });
      
      if (res.ok) {
        toast.success('Заметка обновлена');
        setEditingNote(null);
        setNoteTitle('');
        setNoteContent('');
        fetchData();
      } else {
        toast.error('Ошибка обновления');
      }
    } catch (error) {
      toast.error('Ошибка соединения');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Удалить заметку?')) return;
    
    try {
      const res = await fetch(`/api/notes?noteId=${noteId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        toast.success('Заметка удалена');
        fetchData();
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const openEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteStudentId(note.student.id);
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

          <Button
            variant={activeTab === 'notes' ? 'default' : 'ghost'}
            className={`w-full justify-start ${activeTab === 'notes' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <StickyNote className="w-5 h-5 mr-3" />
            {sidebarOpen && 'Заметки'}
            {notes.length > 0 && sidebarOpen && (
              <Badge className="ml-auto bg-emerald-600">{notes.length}</Badge>
            )}
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
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
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
                <span className="text-lg text-gray-600 hidden sm:inline">
                  {format(currentWeekStart, 'd MMMM', { locale: ru })} - {format(addDays(currentWeekStart, 6), 'd MMMM yyyy', { locale: ru })}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDuplicateWeek}>
                  <Copy className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Дублировать неделю</span>
                  <Copy className="w-4 h-4 sm:hidden" />
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
                                {lessonDate ? format(lessonDate, 'dd.MM.yyyy') : 'Выберите'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent>
                              <Calendar
                                mode="single"
                                selected={lessonDate}
                                onSelect={setLessonDate}
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
                        <Label>Длительность</Label>
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
                        <Label>Ученики * ({students.length})</Label>
                        <ScrollArea className="h-32 border rounded-md p-2">
                          {students.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                              Нет учеников. Добавьте во вкладке "Ученики"
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
                                  {student.isManual && <Badge variant="outline" className="text-xs">ручной</Badge>}
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
              {students.length === 0 ? (
                <Card className="h-full flex items-center justify-center">
                  <CardContent className="text-center p-8">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-xl text-gray-500 mb-2">Добавьте учеников</p>
                    <p className="text-sm text-gray-400 mb-4">Чтобы создавать уроки, нужны ученики</p>
                    <Button onClick={() => setActiveTab('students')} className="bg-emerald-500 hover:bg-emerald-600">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Добавить ученика
                    </Button>
                  </CardContent>
                </Card>
              ) : (
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
                          <p className="font-medium text-sm">{format(day, 'EEEE', { locale: ru })}</p>
                          <p className="text-xs opacity-80">{format(day, 'd MMM', { locale: ru })}</p>
                        </div>
                        <ScrollArea className="h-[calc(100vh-300px)]">
                          <div className="p-1 space-y-1">
                            {dayLessons.map(lesson => (
                              <Link
                                key={lesson.id}
                                href={`/lesson/${lesson.id}`}
                                className="block p-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:shadow-md transition-shadow"
                              >
                                <p className="font-medium text-sm truncate">{lesson.title}</p>
                                <div className="flex items-center gap-1 text-xs opacity-90">
                                  <Clock className="w-3 h-3" />
                                  {format(parseISO(lesson.date), 'HH:mm')}
                                </div>
                                <div className="flex items-center gap-1 text-xs opacity-90">
                                  <Users className="w-3 h-3" />
                                  {lesson.students.length}
                                </div>
                              </Link>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="h-full p-6 overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Ученики</h1>
              <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-500 hover:bg-emerald-600">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Добавить ученика
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Добавить ученика</DialogTitle>
                    <DialogDescription>
                      Найдите ученика по email или создайте новую карточку
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Поиск по email</Label>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={searchEmail}
                          onChange={e => {
                            setSearchEmail(e.target.value);
                            setSearchNotFound(false);
                            setSearchResult(null);
                          }}
                          onKeyDown={e => e.key === 'Enter' && handleSearchStudent()}
                        />
                        <Button onClick={handleSearchStudent} disabled={searching || !searchEmail.trim()}>
                          {searching ? '...' : 'Найти'}
                        </Button>
                      </div>
                    </div>
                    
                    {searchResult && (
                      <Card className="border-emerald-200 bg-emerald-50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
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
                              Добавить
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {searchNotFound && (
                      <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="w-5 h-5 text-orange-500" />
                            <p className="font-medium text-orange-700">Ученик не найден</p>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            Ученик с email <strong>{searchEmail}</strong> не зарегистрирован.
                            Вы можете создать карточку для этого ученика:
                          </p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Имя ученика"
                              value={manualName}
                              onChange={e => setManualName(e.target.value)}
                              className="flex-1"
                            />
                            <Button 
                              onClick={() => handleCreateManualStudent(searchEmail)}
                              disabled={!manualName.trim()}
                              className="bg-emerald-500 hover:bg-emerald-600"
                            >
                              Создать
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-500">или создайте новую карточку</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Создать карточку ученика</Label>
                      <p className="text-xs text-gray-500 mb-2">
                        Для учеников без аккаунта в системе
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Имя ученика"
                          value={manualName}
                          onChange={e => setManualName(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={() => handleCreateManualStudent()}
                          disabled={!manualName.trim()}
                          className="bg-emerald-500 hover:bg-emerald-600"
                        >
                          Создать
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Tabs defaultValue="students">
              <TabsList>
                <TabsTrigger value="students">
                  Мои ученики ({students.length})
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
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {students.map(student => (
                      <Card key={student.id} className="group">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-12 h-12">
                              <AvatarFallback className="bg-emerald-500 text-white text-lg">
                                {student.name?.[0] || student.username[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{student.name || student.username}</p>
                                {student.isManual && (
                                  <Badge variant="outline" className="text-xs">ручной</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 truncate">{student.email}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleRemoveStudent(student.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
          <div className="h-full p-6 overflow-auto">
            <h1 className="text-2xl font-bold mb-6">Уроки</h1>
            {lessons.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Нет запланированных уроков</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lessons.map(lesson => (
                  <Link key={lesson.id} href={`/lesson/${lesson.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardHeader>
                        <CardTitle className="text-lg">{lesson.title}</CardTitle>
                        <CardDescription>
                          {format(parseISO(lesson.date), 'd MMMM, HH:mm', { locale: ru })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <Clock className="w-4 h-4" />
                          {lesson.duration} мин
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

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="h-full p-6 overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Заметки</h1>
              <Dialog open={showNewNote} onOpenChange={setShowNewNote}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-500 hover:bg-emerald-600" disabled={students.length === 0}>
                    <Plus className="w-4 h-4 mr-2" />
                    Новая заметка
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Новая заметка</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Ученик</Label>
                      <Select value={noteStudentId} onValueChange={setNoteStudentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите ученика" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name || s.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Заголовок</Label>
                      <Input
                        value={noteTitle}
                        onChange={e => setNoteTitle(e.target.value)}
                        placeholder="Тема заметки"
                      />
                    </div>
                    <div>
                      <Label>Содержание</Label>
                      <Textarea
                        value={noteContent}
                        onChange={e => setNoteContent(e.target.value)}
                        placeholder="Текст заметки..."
                        rows={6}
                      />
                    </div>
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600" onClick={handleCreateNote}>
                      Создать
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Edit Note Dialog */}
            <Dialog open={!!editingNote} onOpenChange={() => setEditingNote(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Редактировать заметку</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Заголовок</Label>
                    <Input
                      value={noteTitle}
                      onChange={e => setNoteTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Содержание</Label>
                    <Textarea
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-600" onClick={handleUpdateNote}>
                    Сохранить
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {students.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <StickyNote className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Добавьте учеников для создания заметок</p>
                </CardContent>
              </Card>
            ) : notes.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <StickyNote className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Нет заметок</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {notes.map(note => (
                  <Card key={note.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{note.title}</CardTitle>
                          <CardDescription>
                            {note.student.name || note.student.username}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditNote(note)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteNote(note.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">{note.content}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {format(new Date(note.updatedAt), 'dd.MM.yyyy HH:mm')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
