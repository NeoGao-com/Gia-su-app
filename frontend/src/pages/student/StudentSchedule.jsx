import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, 
  Users, BookOpen, MapPin, Repeat, Eye, X, School, Info
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
  { id: '#4f46e5', label: 'Tím Indigo', bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-950', bar: 'bg-indigo-600' },
  { id: '#059669', label: 'Xanh Lá Emerald', bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-950', bar: 'bg-emerald-600' },
  { id: '#d97706', label: 'Cam Hổ Phách', bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-950', bar: 'bg-amber-600' },
  { id: '#e11d48', label: 'Đỏ Hồng Rose', bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-950', bar: 'bg-rose-600' },
  { id: '#7c3aed', label: 'Tím Violet', bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-950', bar: 'bg-purple-600' },
  { id: '#0284c7', label: 'Xanh Da Trời Sky', bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-950', bar: 'bg-sky-600' },
  { id: '#ea580c', label: 'Cam Đậm Orange', bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-950', bar: 'bg-orange-600' },
  { id: '#0d9488', label: 'Xanh Ngọc Teal', bg: 'bg-teal-50', border: 'border-teal-400', text: 'text-teal-950', bar: 'bg-teal-600' },
];

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 64;

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

export function StudentSchedule() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('ALL');

  // Week navigation offset
  const [weekOffset, setWeekOffset] = useState(0);

  // Selected event modal (Read-only view)
  const [selectedEvent, setSelectedEvent] = useState(null);

  const hoursList = getHoursList();

  // Calculate current week dates
  const getWeekDates = (offset) => {
    const now = new Date();
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

  // Fetch student's schedule (Read-only)
  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await api.get('/schedule/student');
      setEvents(res.data.events || []);
      setClassrooms(res.data.classrooms || []);
    } catch (err) {
      console.error('Lỗi tải thời khóa biểu học sinh:', err);
      toast.error('Không thể tải dữ liệu thời khóa biểu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  // Filter events based on selected classroom and week
  const filteredEvents = events.filter((ev) => {
    if (selectedClassroom !== 'ALL' && String(ev.classroom_id) !== String(selectedClassroom)) {
      return false;
    }

    if (ev.is_recurring) {
      return true;
    } else if (ev.specific_date) {
      return weekDays.some((w) => w.isoDate === ev.specific_date);
    }
    return true;
  });

  const getColorConfig = (colorHex) => {
    return COLOR_PALETTE.find((c) => c.id.toLowerCase() === (colorHex || '').toLowerCase()) || COLOR_PALETTE[0];
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar role="student" />

        <main className="flex-1 p-3 sm:p-5 lg:p-7 max-w-7xl mx-auto w-full flex flex-col">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-6 mb-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold mb-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Thời Khóa Biểu Học Tập</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                  <span>Lịch Học & Tiết Học Tuần</span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lịch học trực quan các lớp bạn tham gia. Bấm vào từng khối tiết học để xem thông tin chi tiết và phòng học/link học.
                </p>
              </div>

              {/* Classroom filter */}
              <div className="flex items-center space-x-2">
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

              <div className="text-xs text-slate-500 hidden sm:flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>Chế độ xem lịch biểu học sinh</span>
              </div>
            </div>
          </div>

          {/* Timetable Grid (Read-only) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs flex-1 flex flex-col overflow-hidden relative">
            {/* Header Days */}
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
                  {hoursList.map((hour) => (
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
                      className="border-r border-slate-200/80 last:border-r-0 relative hover:bg-slate-50/20 transition-colors"
                    >
                      {/* Grid background hour lines */}
                      {hoursList.map((hour, hIdx) => (
                        <div
                          key={hIdx}
                          className="border-b border-slate-100/90 h-[64px]"
                        />
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
                            onClick={() => setSelectedEvent(ev)}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              left: leftStyle,
                              width: widthStyle,
                              zIndex: 10 + (ev.colIndex || 0),
                            }}
                            className={`absolute rounded-xl p-2 border ${colorConf.bg} ${colorConf.border} shadow-2xs hover:shadow-md transition-all cursor-pointer group overflow-hidden flex flex-col justify-between`}
                            title="Bấm để xem chi tiết tiết học"
                          >
                            {/* Left highlight strip */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorConf.bar}`} />

                            {/* Card Content */}
                            <div className="pl-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`font-bold text-[11px] sm:text-xs truncate ${colorConf.text}`}>
                                  {ev.title}
                                </span>
                                {ev.is_recurring ? (
                                  <Repeat className="w-3 h-3 text-slate-400 shrink-0" title="Lặp lại hàng tuần" />
                                ) : (
                                  <span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1 rounded-sm shrink-0">
                                    Ngoài lề
                                  </span>
                                )}
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

                            {/* Teacher info footer */}
                            {ev.teacher_name && (
                              <div className="pl-1 text-[9px] text-slate-500 truncate">
                                GV: {ev.teacher_name}
                              </div>
                            )}
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

      {/* EVENT DETAILS VIEW MODAL (READ-ONLY) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center space-x-2.5">
                <div
                  className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: selectedEvent.color || '#4f46e5' }}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Chi Tiết Tiết Học
                  </h3>
                  <p className="text-xs text-slate-500">Thời khóa biểu học tập của bạn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Details Body */}
            <div className="p-5 space-y-4">
              {/* Event Title */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Môn học / Tiết học
                </span>
                <h4 className="text-base font-extrabold text-slate-900">
                  {selectedEvent.title}
                </h4>
              </div>

              {/* Classroom & Teacher */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Lớp học</span>
                  <span className="text-xs font-bold text-indigo-700">
                    {selectedEvent.classroom_name || 'Lớp chung'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Giáo viên</span>
                  <span className="text-xs font-bold text-slate-800">
                    {selectedEvent.teacher_name || 'Giáo viên phụ trách'}
                  </span>
                </div>
              </div>

              {/* Time & Duration */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                  <CalendarIcon className="w-4 h-4 text-indigo-600" />
                  <span>
                    {DAYS.find((d) => d.id === selectedEvent.day_of_week)?.name || 'Thứ ?'}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>
                    {selectedEvent.start_time} - {selectedEvent.end_time} ({selectedEvent.duration_minutes || 90} phút)
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                  <Repeat className="w-4 h-4 text-purple-600" />
                  <span>
                    {selectedEvent.is_recurring ? 'Lặp lại đều đặn hàng tuần' : `Sự kiện ngoài lề ngày ${selectedEvent.specific_date || ''}`}
                  </span>
                </div>
              </div>

              {/* Description / Room / Link */}
              {selectedEvent.description && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Ghi chú / Phòng học / Link online
                  </span>
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                    {selectedEvent.description}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
