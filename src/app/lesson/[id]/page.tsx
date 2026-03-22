'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  BookOpen, Users, Calendar, Clock, FileText, LogOut, Download,
  Upload, Trash2, Home, Pencil, Eraser, RotateCcw, Save, Palette, Minus, Square, Circle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';

interface Student {
  id: string;
  name: string | null;
  email: string;
  username: string;
  avatar: string | null;
}

interface Tutor {
  id: string;
  name: string | null;
  email: string;
  username: string;
  avatar: string | null;
}

interface LessonFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploader: {
    id: string;
    name: string | null;
    username: string;
  };
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  date: string;
  duration: number;
  tutor: Tutor;
  students: { student: Student }[];
  files: LessonFile[];
}

type Tool = 'pencil' | 'eraser' | 'line' | 'rectangle' | 'circle';
type Color = string;

const COLORS = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFFFFF'
];

const BRUSH_SIZES = [2, 4, 8, 12, 20];

export default function LessonPage() {
  const { user, isLoading, fetchUser, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [files, setFiles] = useState<LessonFile[]>([]);
  const [activeTab, setActiveTab] = useState('whiteboard');

  // Whiteboard state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState<Color>('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [shapes, setShapes] = useState<Array<{
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    size: number;
  }>>([]);
  const [drawingHistory, setDrawingHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const fetchLesson = useCallback(async () => {
    if (!lessonId) return;

    const res = await fetch(`/api/lessons/${lessonId}`);
    if (res.ok) {
      const data = await res.json();
      setLesson(data.lesson);
      setFiles(data.lesson.files || []);
    } else {
      toast.error('Урок не найден');
      router.push('/dashboard');
    }
  }, [lessonId, router]);

  const fetchWhiteboard = useCallback(async () => {
    if (!lessonId) return;

    const res = await fetch(`/api/whiteboard/${lessonId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.whiteboard && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = data.whiteboard.imageData || data.whiteboard;
        }
      }
    }
  }, [lessonId]);

  useEffect(() => {
    if (user && lessonId) {
      fetchLesson();
      fetchWhiteboard();
    }
  }, [user, lessonId, fetchLesson, fetchWhiteboard]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight - 60;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [activeTab]);

  // Drawing functions
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setIsDrawing(true);
    setLastPos(pos);
    setStartPos(pos);

    // Save current state for undo
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setDrawingHistory(prev => [...prev.slice(0, historyIndex + 1), imageData]);
        setHistoryIndex(prev => prev + 1);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPos) return;

    const pos = getMousePos(e);

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    setLastPos(pos);
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) {
      setIsDrawing(false);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      setIsDrawing(false);
      return;
    }

    const pos = getMousePos(e);

    // Draw shape if using shape tool
    if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (tool === 'rectangle') {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
    } else if (tool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2)
      );
      ctx.beginPath();
      ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.stroke();
    }

    setIsDrawing(false);
    setLastPos(null);
    setStartPos(null);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const newIndex = historyIndex - 1;
        ctx.putImageData(drawingHistory[newIndex], 0, 0);
        setHistoryIndex(newIndex);
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setDrawingHistory(prev => [...prev.slice(0, historyIndex + 1), imageData]);
      setHistoryIndex(prev => prev + 1);
    }
  };

  const handleSaveWhiteboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsSaving(true);
    try {
      const imageData = canvas.toDataURL('image/png');
      const res = await fetch(`/api/whiteboard/${lessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: imageData })
      });

      if (res.ok) {
        toast.success('Доска сохранена');
      } else {
        toast.error('Ошибка сохранения');
      }
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('lessonId', lessonId);

    const res = await fetch('/api/files', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      toast.success('Файл загружен');
      fetchLesson();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Ошибка загрузки');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  const handleDeleteFile = async (fileId: string) => {
    const res = await fetch(`/api/files/${fileId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      toast.success('Файл удалён');
      fetchLesson();
    } else {
      toast.error('Ошибка удаления');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  };

  const isTutor = lesson && user && lesson.tutor.id === user.id;

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

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <p className="text-gray-600">Загрузка урока...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-emerald-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={user.role === 'TUTOR' ? '/tutor' : '/student'}>
              <Button variant="ghost" size="icon">
                <Home className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">{lesson.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(parseISO(lesson.date), 'd MMMM yyyy', { locale: ru })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {format(parseISO(lesson.date), 'HH:mm')} ({lesson.duration} мин)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={lesson.tutor.avatar || undefined} />
                <AvatarFallback className="bg-emerald-500 text-white text-sm">
                  {lesson.tutor.name?.[0] || lesson.tutor.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{lesson.tutor.name || lesson.tutor.username}</span>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex -space-x-2">
              {lesson.students.slice(0, 3).map((s, i) => (
                <Avatar key={s.student.id} className="w-8 h-8 border-2 border-white">
                  <AvatarImage src={s.student.avatar || undefined} />
                  <AvatarFallback className="bg-teal-500 text-white text-sm">
                    {s.student.name?.[0] || s.student.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {lesson.students.length > 3 && (
                <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium">
                  +{lesson.students.length - 3}
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 pt-4">
            <TabsList>
              <TabsTrigger value="whiteboard">
                <Pencil className="w-4 h-4 mr-2" />
                Доска
              </TabsTrigger>
              <TabsTrigger value="files">
                <FileText className="w-4 h-4 mr-2" />
                Файлы ({files.length})
              </TabsTrigger>
              <TabsTrigger value="info">
                <Users className="w-4 h-4 mr-2" />
                Информация
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="whiteboard" className="flex-1 p-4 m-0">
            <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
                <div className="flex items-center gap-1 border-r pr-2 mr-2">
                  <Button
                    variant={tool === 'pencil' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setTool('pencil')}
                    className={tool === 'pencil' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={tool === 'eraser' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setTool('eraser')}
                    className={tool === 'eraser' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                  >
                    <Eraser className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={tool === 'line' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setTool('line')}
                    className={tool === 'line' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={tool === 'rectangle' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setTool('rectangle')}
                    className={tool === 'rectangle' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={tool === 'circle' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setTool('circle')}
                    className={tool === 'circle' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                  >
                    <Circle className="w-4 h-4" />
                  </Button>
                </div>

                {/* Colors */}
                <div className="flex items-center gap-1 border-r pr-2 mr-2">
                  {COLORS.slice(0, 6).map(c => (
                    <button
                      key={c}
                      className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-emerald-500' : 'border-gray-300'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer"
                  />
                </div>

                {/* Brush sizes */}
                <div className="flex items-center gap-1 border-r pr-2 mr-2">
                  {BRUSH_SIZES.map(size => (
                    <Button
                      key={size}
                      variant={brushSize === size ? 'default' : 'ghost'}
                      size="icon"
                      onClick={() => setBrushSize(size)}
                      className={`w-8 h-8 ${brushSize === size ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                    >
                      <div
                        className="rounded-full bg-current"
                        style={{ width: size, height: size }}
                      />
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={handleUndo} disabled={historyIndex <= 0}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleClear}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    className="bg-emerald-500 hover:bg-emerald-600 ml-2"
                    size="sm"
                    onClick={handleSaveWhiteboard}
                    disabled={isSaving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </div>
              </div>

              {/* Canvas */}
              <div className="flex-1 relative bg-white">
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="files" className="flex-1 p-4 m-0 overflow-auto">
            <div className="max-w-4xl mx-auto">
              {isTutor && (
                <div className="mb-6">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleUploadFile}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Загрузить файл
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    Максимальный размер файла: 10 МБ
                  </p>
                </div>
              )}

              {files.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Файлы не загружены</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {files.map(file => (
                    <Card key={file.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium">{file.originalName}</p>
                              <p className="text-sm text-gray-500">
                                {formatFileSize(file.size)} • Загружен {format(new Date(file.createdAt), 'dd.MM.yyyy HH:mm')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDownloadFile(file.id, file.originalName)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {isTutor && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteFile(file.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="info" className="flex-1 p-4 m-0 overflow-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Информация об уроке</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">Название</label>
                    <p className="font-medium">{lesson.title}</p>
                  </div>
                  {lesson.description && (
                    <div>
                      <label className="text-sm text-gray-500">Описание</label>
                      <p className="whitespace-pre-wrap">{lesson.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Дата</label>
                      <p className="font-medium">{format(parseISO(lesson.date), 'd MMMM yyyy', { locale: ru })}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Время</label>
                      <p className="font-medium">{format(parseISO(lesson.date), 'HH:mm')} ({lesson.duration} мин)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Репетитор</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={lesson.tutor.avatar || undefined} />
                      <AvatarFallback className="bg-emerald-500 text-white">
                        {lesson.tutor.name?.[0] || lesson.tutor.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{lesson.tutor.name || lesson.tutor.username}</p>
                      <p className="text-sm text-gray-500">{lesson.tutor.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ученики ({lesson.students.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {lesson.students.map(s => (
                      <div key={s.student.id} className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={s.student.avatar || undefined} />
                          <AvatarFallback className="bg-teal-500 text-white">
                            {s.student.name?.[0] || s.student.username[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{s.student.name || s.student.username}</p>
                          <p className="text-sm text-gray-500">{s.student.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
