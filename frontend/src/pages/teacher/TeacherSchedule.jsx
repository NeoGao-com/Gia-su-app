import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { 
  Calendar as CalendarIcon, Clock, Plus, Trash2, Edit3, 
  ChevronLeft, ChevronRight, Users, Sparkles, AlertCircle, 
  Check, X, BookOpen, MapPin, Repeat, Eye, Move, Maximize2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';

const DAYS = [
  { id: 1, name: 'Thứ Hai', short: 'T2' },
  { id: 2, name: 'Thứ Ba', short: 'T3' },
  { id: 3, name: 'Thứ Tư', short: 'T4' },
  { id: 4, name: 'Thứ Năm', short: 'T5' },
  { id: 5, name: 'Thứ Sáu', short: 'T6' },
  { id: 6, name: 'Thứ Bảy', short: 'T7' },
  { id: 7, name: 'Chủ Nhật', short: 'CN' },
];

const COLOR_PALETTE = [
  { id: '#4f46e5', label: 'Tím Indigo', bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-900', bar: 'bg-indigo-600', ring: 'ring-indigo-600' },
  { id: '#059669', label: 'Xanh Lá Emerald', bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-900', bar: 'bg-emerald-600', ring: 'ring-emerald-600' },
  { id: '#d97706', label: 'Cam Hổ Phách', bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-900', bar: 'bg-amber-600', ring: 'ring-amber-600' },
  { id: '#e11d48', label: 'Đỏ Hồng Rose', bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-900', bar: 'bg-rose-600', ring: 'ring-rose-600' },
  { id: '#7c3aed', label: 'Tím Violet', bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', bar: 'bg-purple-600', ring: 'ring-purple-600' },
  { id: '#0284c7', label: 'Xanh Da Trời Sky', bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-900', bar: 'bg-sky-600', ring: 'ring-sky-600' },
  { id: '#ea580c', label: 'Cam Đậm Orange', bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', bar: 'bg-orange-600', ring: 'ring-orange-600' },
  { id: '#0d9488', label: 'Xanh Ngọc Teal', bg: 'bg-teal-50', border: 'border-teal-400', text: 'text-teal-900', bar: 'bg-teal-600', ring: 'ring-teal-600' },
];

const START_HOUR = 7; // 07:00
const END_HOUR = 21;  // 21:00
const HOUR_HEIGHT = 64; // px per hour (roughly ~1px per min)

function getHoursList() {
  const hours = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hours.push(`${h < 10 ? '0' + h : h}:00`);
  }
  return hours;
}

function timeToMins(tStr) {
  if (!tStr) return 0;
  const [h, m] = tStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
}

function computeOverlappingLayout(dayEvents) {
  if (!dayEvents || dayEvents.length === 0) return [];
  const sorted = [...dayEvents].sort((a, b) => {
    const diff = timeToMins(a.start_time) - timeToMins(b.start_time);
    if (diff !== 0) return diff;
    return (b.duration_minutes || 90) - (a.duration_minutes || 90);
  });

  const clusters = [];
  let currentCluster = [];
  let clusterEndMins = 0;

  sorted.forEach((ev) => {
    const startM = timeToMins(ev.start_time);
    const endM = timeToMins(ev.end_time) || (startM + (ev.duration_minutes || 90));

    if (currentCluster.length === 0) {
      currentCluster.push(ev);
      clusterEndMins = endM;
    } else if (startM < clusterEndMins) {
      currentCluster.push(ev);
      clusterEndMins = Math.max(clusterEndMins, endM);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterEndMins = endM;
    }
  });
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const layoutedEvents = [];
  clusters.forEach((cluster) => {
    const columns = [];
    const eventColMap = new Map();

    cluster.forEach((ev) => {
      const evStart = timeToMins(ev.start_time);
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        const lastEnd = timeToMins(lastInCol.end_time) || (timeToMins(lastInCol.start_time) + (lastInCol.duration_minutes || 90));
        if (evStart >= lastEnd) {
          columns[c].push(ev);
          eventColMap.set(ev.id, c);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([ev]);
        eventColMap.set(ev.id, columns.length - 1);
      }
    });

    const totalCols = columns.length;
    cluster.forEach((ev) => {
      const col = eventColMap.get(ev.id) || 0;
      layoutedEvents.push({
        ...ev,
        colIndex: col,
        totalCols: totalCols,
      });
    });
  });

  return layoutedEvents;
}

export function TeacherSchedule() {
  const { toast, confirm } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('ALL');
  
  // Week navigation (offset in weeks from current week)
  const [weekOffset, setWeekOffset] = useState(0);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingEventId, setEditingEventId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Event Form State
  const [formData, setFormData] = useState({
    title: '',
    classroom_id: '',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '09:30',
    duration_minutes: 90,
    color: '#4f46e5',
    is_recurring: true,
    specific_date: '',
    description: '',
  });

  // Drag and Drop & Resize State
  const [draggingEvent, setDraggingEvent] = useState(null);
  const [resizingEvent, setResizingEvent] = useState(null);
  const resizeStartY = useRef(0);
  const resizeStartDuration = useRef(90);

  const hoursList = getHoursList();

  // Calculate current week dates
  const getWeekDates = (offset) => {
    const now = new Date();
    // Monday of current week
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setDate(monday.getDate() + offset * 7);

    return DAYS.map((d, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return {
        ...d,
        dateStr: `${dd}/${mm}`,
        isoDate: `${yyyy}-${mm}-${dd}`,
      };
    });
  };

  const weekDays = getWeekDates(weekOffset);

  // Fetch teacher's schedule
  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await api.get('/schedule/teacher');
      setEvents(res.data.events || []);
      setClassrooms(res.data.classrooms || []);
    } catch (err) {
      console.error('Lỗi tải thời khóa biểu:', err);
      toast.error('Không thể tải dữ liệu thời khóa biểu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  // Filter events based on selected classroom and week
  const filteredEvents = events.filter((ev) => {
    // Filter by classroom
    if (selectedClassroom !== 'ALL' && String(ev.classroom_id) !== String(selectedClassroom)) {
      return false;
    }

    // Filter by week
    if (ev.is_recurring) {
      // Recurring events display on all weeks
      return true;
    } else if (ev.specific_date) {
      // One-off event only displays if specific_date falls in the current week view
      return weekDays.some((w) => w.isoDate === ev.specific_date);
    }
    return true;
  });

  // Open modal to create event
  const handleOpenCreateModal = (dayId = 1, startTime = '08:00') => {
    setModalMode('create');
    setEditingEventId(null);
    const startM = timeToMins(startTime);
    const endM = startM + 90;
    setFormData({
      title: '',
      classroom_id: selectedClassroom !== 'ALL' ? selectedClassroom : (classrooms[0]?.id || ''),
      day_of_week: dayId,
      start_time: startTime,
      end_time: minsToTime(endM),
      duration_minutes: 90,
      color: '#4f46e5',
      is_recurring: true,
      specific_date: '',
      description: '',
    });
    setModalOpen(true);
  };

  // Open modal to edit event
  const handleOpenEditModal = (ev) => {
    setModalMode('edit');
    setEditingEventId(ev.id);
    setFormData({
      title: ev.title,
      classroom_id: ev.classroom_id || '',
      day_of_week: ev.day_of_week,
      start_time: ev.start_time,
      end_time: ev.end_time,
      duration_minutes: ev.duration_minutes || (timeToMins(ev.end_time) - timeToMins(ev.start_time)),
      color: ev.color || '#4f46e5',
      is_recurring: ev.is_recurring ?? true,
      specific_date: ev.specific_date || '',
      description: ev.description || '',
    });
    setModalOpen(true);
  };

  // Submit create or edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Vui lòng nhập tên tiết học hoặc sự kiện');
      return;
    }

    const startM = timeToMins(formData.start_time);
    const endM = timeToMins(formData.end_time);
    if (endM <= startM) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        classroom_id: formData.classroom_id ? parseInt(formData.classroom_id, 10) : null,
        day_of_week: parseInt(formData.day_of_week, 10),
        start_time: formData.start_time,
        end_time: formData.end_time,
        duration_minutes: endM - startM,
        color: formData.color,
        is_recurring: formData.is_recurring,
        specific_date: !formData.is_recurring ? formData.specific_date || null : null,
        description: formData.description.trim() || null,
      };

      if (modalMode === 'create') {
        const res = await api.post('/schedule/events', payload);
        setEvents((prev) => [...prev, res.data]);
        toast.success('Đã thêm khối sự kiện vào thời khóa biểu!');
      } else {
        const res = await api.put(`/schedule/events/${editingEventId}`, payload);
        setEvents((prev) => prev.map((ev) => (ev.id === editingEventId ? res.data : ev)));
        toast.success('Đã cập nhật thông tin sự kiện!');
      }

      setModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Thao tác thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete event
  const handleDeleteEvent = async (eventId) => {
    const target = events.find((e) => e.id === eventId);
    const ok = await confirm({
      title: 'Xóa sự kiện thời khóa biểu?',
      message: `Bạn có chắc chắn muốn xóa khối sự kiện "${target?.title || 'này'}" khỏi thời khóa biểu? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xóa sự kiện',
      cancelText: 'Hủy',
    });
    if (!ok) return;

    try {
      await api.delete(`/schedule/events/${eventId}`);
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
      setModalOpen(false);
      toast.success('Đã xóa sự kiện thành công.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể xóa sự kiện.');
    }
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e, ev) => {
    setDraggingEvent(ev);
    e.dataTransfer.setData('text/plain', String(ev.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetDayId, targetHour) => {
    e.preventDefault();
    if (!draggingEvent) return;

    const newStartM = targetHour * 60;
    const dur = draggingEvent.duration_minutes || 90;
    const newEndM = newStartM + dur;

    const newStartTime = minsToTime(newStartM);
    const newEndTime = minsToTime(newEndM);

    // Optimistic update
    const prevEvents = [...events];
    const updated = {
      ...draggingEvent,
      day_of_week: targetDayId,
      start_time: newStartTime,
      end_time: newEndTime,
      duration_minutes: dur,
    };
    setEvents((prev) => prev.map((item) => (item.id === draggingEvent.id ? updated : item)));
    setDraggingEvent(null);

    try {
      const res = await api.put(`/schedule/events/${draggingEvent.id}`, {
        day_of_week: targetDayId,
        start_time: newStartTime,
        end_time: newEndTime,
        duration_minutes: dur,
      });
      if (res.data) {
        setEvents((prev) => prev.map((item) => (item.id === draggingEvent.id ? res.data : item)));
      }
      toast.success(`Đã chuyển lịch "${draggingEvent.title}" sang ${DAYS.find(d => d.id === targetDayId)?.name} lúc ${newStartTime}`);
    } catch (err) {
      setEvents(prevEvents);
      toast.error('Không thể cập nhật vị trí lịch học');
    }
  };

  // --- RESIZE (PHÓNG TO / THU NHỎ THỜI LƯỢNG) HANDLERS ---
  const handleResizeStart = (e, ev) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingEvent(ev);
    resizeStartY.current = e.clientY;
    resizeStartDuration.current = ev.duration_minutes || (timeToMins(ev.end_time) - timeToMins(ev.start_time)) || 90;

    const handleMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - resizeStartY.current;
      // 1px delta ~ 1 minute. Snap to 15-minute steps
      const deltaMins = Math.round(deltaY / 15) * 15;
      const newDuration = Math.max(30, Math.min(300, resizeStartDuration.current + deltaMins));

      setEvents((prev) =>
        prev.map((item) => {
          if (item.id === ev.id) {
            const startM = timeToMins(item.start_time);
            return {
              ...item,
              duration_minutes: newDuration,
              end_time: minsToTime(startM + newDuration),
            };
          }
          return item;
        })
      );
    };

    const handleMouseUp = async (upEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      const deltaY = upEvent.clientY - resizeStartY.current;
      const deltaMins = Math.round(deltaY / 15) * 15;
      const finalDuration = Math.max(30, Math.min(300, resizeStartDuration.current + deltaMins));
      const startM = timeToMins(ev.start_time);
      const newEndTime = minsToTime(startM + finalDuration);

      setResizingEvent(null);

      try {
        const res = await api.put(`/schedule/events/${ev.id}`, {
          duration_minutes: finalDuration,
          end_time: newEndTime,
        });
        if (res.data) {
          setEvents((prev) => prev.map((item) => (item.id === ev.id ? res.data : item)));
        }
        toast.success(`Đã điều chỉnh thời lượng "${ev.title}" thành ${finalDuration} phút (${newEndTime})`);
      } catch (err) {
        toast.error('Lỗi cập nhật thời lượng');
        fetchSchedule();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getColorConfig = (colorHex) => {
    return COLOR_PALETTE.find((c) => c.id.toLowerCase() === (colorHex || '').toLowerCase()) || COLOR_PALETTE[0];
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar role="teacher" />

        <main className="flex-1 p-3 sm:p-5 lg:p-7 max-w-7xl mx-auto w-full flex flex-col">
          {/* Header Controls */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-6 mb-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold mb-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Thời Khóa Biểu Giảng Dạy</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                  <span>Lịch Dạy & Sự Kiện Tuần</span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kéo thả khối để đổi giờ/ngày, kéo cạnh dưới để thu phóng thời lượng. Lịch lặp lại tuần tự động áp dụng cho các tuần kế tiếp.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Classroom Filter */}
                <select
                  value={selectedClassroom}
                  onChange={(e) => setSelectedClassroom(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:border-slate-300 transition outline-hidden cursor-pointer"
                >
                  <option value="ALL">Tất cả lớp học</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp: {c.name} ({c.code})
                    </option>
                  ))}
                </select>

                {/* Add Event Button */}
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs hover:shadow-md transition flex items-center space-x-2 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Thêm Tiết Học / Sự Kiện</span>
                </button>
              </div>
            </div>

            {/* Week Navigator */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                  title="Tuần trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    weekOffset === 0
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  Tuần hiện tại
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                  title="Tuần sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs sm:text-sm font-bold text-slate-700 ml-2">
                  {weekDays[0].dateStr} - {weekDays[6].dateStr} ({weekDays[0].isoDate.split('-')[0]})
                </span>
              </div>

              {/* Status Hint */}
              <div className="hidden lg:flex items-center space-x-3 text-xs text-slate-500">
                <span className="flex items-center space-x-1">
                  <Move className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Kéo thả để dời lịch</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Kéo mép dưới để tăng/giảm giờ</span>
                </span>
              </div>
            </div>
          </div>

          {/* Timetable Interactive Grid */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs flex-1 flex flex-col overflow-hidden relative">
            {/* Week Days Header */}
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
              <div className="p-3 text-center border-r border-slate-200/80 font-bold text-xs text-slate-400 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>Giờ</span>
              </div>
              {weekDays.map((d) => (
                <div
                  key={d.id}
                  className="p-2.5 sm:p-3 text-center border-r border-slate-200/80 last:border-r-0"
                >
                  <div className="font-bold text-xs sm:text-sm text-slate-800">{d.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{d.dateStr}</div>
                </div>
              ))}
            </div>

            {/* Grid Body */}
            <div className="overflow-y-auto max-h-[720px] relative select-none">
              <div className="grid grid-cols-8 relative" style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}>
                {/* Time Axis Column */}
                <div className="border-r border-slate-200/80 bg-slate-50/50">
                  {hoursList.map((hour, idx) => (
                    <div
                      key={hour}
                      className="border-b border-slate-100 flex items-start justify-center pt-1 text-[11px] font-mono font-medium text-slate-400"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    >
                      {hour}
                    </div>
                  ))}
                </div>

                {/* 7 Days Columns */}
                {weekDays.map((d) => {
                  const dayEvents = filteredEvents.filter((ev) => ev.day_of_week === d.id);

                  return (
                    <div
                      key={d.id}
                      className="border-r border-slate-200/80 last:border-r-0 relative hover:bg-slate-50/30 transition-colors"
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        // Calculate hour dropped on
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetY = e.clientY - rect.top;
                        const targetHour = Math.floor(offsetY / HOUR_HEIGHT) + START_HOUR;
                        handleDrop(e, d.id, Math.min(END_HOUR - 1, Math.max(START_HOUR, targetHour)));
                      }}
                    >
                      {/* Grid background hour lines */}
                      {hoursList.map((hour, hIdx) => (
                        <div
                          key={hIdx}
                          onClick={() => handleOpenCreateModal(d.id, hour)}
                          className="border-b border-slate-100/90 h-[64px] hover:bg-indigo-50/20 transition cursor-pointer group relative"
                          title={`Nhấn để thêm sự kiện vào ${d.name} lúc ${hour}`}
                        >
                          <span className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 text-[10px] text-indigo-400 font-semibold">
                            + Thêm
                          </span>
                        </div>
                      ))}

                      {/* Event Cards in Day */}
                      {computeOverlappingLayout(dayEvents).map((ev) => {
                        const startM = timeToMins(ev.start_time);
                        const durM = ev.duration_minutes || (timeToMins(ev.end_time) - startM) || 90;
                        const topPx = ((startM - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                        const heightPx = Math.max(36, (durM / 60) * HOUR_HEIGHT);
                        const colorConf = getColorConfig(ev.color);

                        const leftStyle = ev.totalCols > 1
                          ? `calc(${(ev.colIndex * 100) / ev.totalCols}% + 2px)`
                          : '4px';
                        const widthStyle = ev.totalCols > 1
                          ? `calc(${100 / ev.totalCols}% - 4px)`
                          : 'calc(100% - 8px)';

                        return (
                          <div
                            key={ev.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, ev)}
                            onClick={() => handleOpenEditModal(ev)}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              left: leftStyle,
                              width: widthStyle,
                              zIndex: 10 + (ev.colIndex || 0),
                            }}
                            className={`absolute rounded-xl p-2 border ${colorConf.bg} ${colorConf.border} shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing group overflow-hidden flex flex-col justify-between`}
                          >
                            {/* Left highlight strip */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorConf.bar}`} />

                            {/* Card Content */}
                            <div className="pl-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`font-bold text-[11px] sm:text-xs truncate ${colorConf.text}`}>
                                  {ev.title}
                                </span>
                                <div className="flex items-center space-x-1 shrink-0">
                                  {ev.is_recurring ? (
                                    <Repeat className="w-3 h-3 text-slate-400" title="Lặp lại hàng tuần" />
                                  ) : (
                                    <span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1 rounded-sm">
                                      Ngoài lề
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 text-[10px] text-slate-500 mt-0.5 font-mono">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{ev.start_time} - {ev.end_time}</span>
                                <span className="font-semibold text-slate-400">({durM}p)</span>
                              </div>

                              {ev.classroom_name && (
                                <div className="text-[10px] text-indigo-700 font-semibold truncate mt-0.5">
                                  Lớp: {ev.classroom_name}
                                </div>
                              )}
                            </div>

                            {/* Bottom Resize Handle */}
                            <div
                              onMouseDown={(e) => handleResizeStart(e, ev)}
                              className="h-2 w-full hover:bg-slate-300/60 rounded-b-md cursor-ns-resize flex items-center justify-center -mb-1 opacity-60 group-hover:opacity-100 transition-opacity"
                              title="Kéo để điều chỉnh thời lượng"
                            >
                              <div className="w-6 h-0.5 bg-slate-400 rounded-full" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* CREATE / EDIT EVENT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {modalMode === 'create' ? 'Thêm Khối Tiết Học / Sự Kiện Mới' : 'Chỉnh Sửa Sự Kiện Thời Khóa Biểu'}
                  </h3>
                  <p className="text-xs text-slate-500">Thiết lập thời lượng, thứ trong tuần và màu sắc</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Tên môn học / Tiết học */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tên tiết học / Môn học / Sự kiện <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ví dụ: Toán 12 - Hình học không gian, Ôn tập kiểm tra..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-hidden"
                />
              </div>

              {/* Lớp học áp dụng */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lớp học phụ trách
                </label>
                <select
                  value={formData.classroom_id}
                  onChange={(e) => setFormData({ ...formData, classroom_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-hidden"
                >
                  <option value="">Lịch chung / Cá nhân (Học sinh không thấy)</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Khi gắn với lớp học, học sinh của lớp đó sẽ thấy lịch trên thời khóa biểu của mình.
                </span>
              </div>

              {/* Thứ trong tuần */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Thứ trong tuần
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, day_of_week: d.id })}
                      className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        formData.day_of_week === d.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Giờ bắt đầu, Giờ kết thúc, Thời lượng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Giờ bắt đầu
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      const sM = timeToMins(newStart);
                      const eM = sM + formData.duration_minutes;
                      setFormData({
                        ...formData,
                        start_time: newStart,
                        end_time: minsToTime(eM),
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-medium text-slate-800 focus:border-indigo-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Giờ kết thúc
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      const sM = timeToMins(formData.start_time);
                      const eM = timeToMins(newEnd);
                      const dur = Math.max(15, eM - sM);
                      setFormData({
                        ...formData,
                        end_time: newEnd,
                        duration_minutes: dur,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-medium text-slate-800 focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Conflict warning */}
              {(() => {
                const conflict = events.find((ev) => {
                  if (editingEventId && ev.id === editingEventId) return false;
                  if (ev.day_of_week !== parseInt(formData.day_of_week, 10)) return false;
                  const formStart = timeToMins(formData.start_time);
                  const formEnd = timeToMins(formData.end_time);
                  const evStart = timeToMins(ev.start_time);
                  const evEnd = timeToMins(ev.end_time) || (evStart + (ev.duration_minutes || 90));
                  return formStart < evEnd && formEnd > evStart;
                });
                if (!conflict) return null;
                return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Trùng lịch:</strong> Khung giờ này đang trùng với "<strong>{conflict.title}</strong>" ({conflict.start_time} - {conflict.end_time}). Hai tiết học sẽ được xếp song song.
                    </span>
                  </div>
                );
              })()}

              {/* Quick duration buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Thời lượng nhanh
                </label>
                <div className="flex flex-wrap gap-2">
                  {[45, 60, 90, 120, 180].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => {
                        const sM = timeToMins(formData.start_time);
                        setFormData({
                          ...formData,
                          duration_minutes: dur,
                          end_time: minsToTime(sM + dur),
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        formData.duration_minutes === dur
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {dur} phút
                    </button>
                  ))}
                </div>
              </div>

              {/* Bảng chọn màu sắc (Color Palette) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Màu sắc khối sự kiện
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c.id })}
                      className={`w-8 h-8 rounded-full ${c.bar} flex items-center justify-center transition cursor-pointer ring-2 ${
                        formData.color === c.id ? `${c.ring} ring-offset-2 scale-110 shadow-xs` : 'ring-transparent'
                      }`}
                      title={c.label}
                    >
                      {formData.color === c.id && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lặp lại hàng tuần / Sự kiện ngoài lề */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-800 flex items-center space-x-1.5">
                      <Repeat className="w-4 h-4 text-indigo-600" />
                      <span>Lặp lại hàng tuần</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Tự động hiển thị ở tất cả các tuần tiếp theo
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded-md focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                {!formData.is_recurring && (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ngày diễn ra sự kiện ngoài lề
                    </label>
                    <input
                      type="date"
                      required={!formData.is_recurring}
                      value={formData.specific_date}
                      onChange={(e) => setFormData({ ...formData, specific_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Ghi chú / Phòng học / Link online */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ghi chú / Phòng học / Link học online
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ví dụ: Phòng A204 hoặc link Google Meet / Zoom..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:border-indigo-500 outline-hidden"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {modalMode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEventId)}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa sự kiện</span>
                  </button>
                ) : <div />}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-xs text-slate-600 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs hover:shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo sự kiện' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
