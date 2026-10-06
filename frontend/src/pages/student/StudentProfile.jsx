import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  User, Mail, Phone, Calendar, School, 
  Lock, KeyRound, ShieldCheck, CheckCircle2, 
  Save, Eye, EyeOff, Loader2, AlertCircle, 
  GraduationCap, Sparkles, HeartHandshake, FileText
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function StudentProfile() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'security'
  const [loading, setLoading] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile Form State
  const [profile, setProfile] = useState({
    id: null,
    email: '',
    full_name: '',
    phone_number: '',
    parent_phone: '',
    parent_name: '',
    date_of_birth: '',
    gender: 'Nam',
    school: '',
    student_code: '',
    grade_level: '',
    notes: '',
    role: 'STUDENT',
  });

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Load current user profile from API or localStorage
  useEffect(() => {
    async function loadUserProfile() {
      setLoading(true);
      try {
        const res = await api.get('/auth/me');
        const data = res.data;
        setProfile({
          id: data.id,
          email: data.email || '',
          full_name: data.full_name || '',
          phone_number: data.phone_number || '',
          parent_phone: data.parent_phone || '',
          parent_name: data.parent_name || '',
          date_of_birth: data.date_of_birth || '',
          gender: data.gender || 'Nam',
          school: data.school || '',
          student_code: data.student_code || '',
          grade_level: data.grade_level ? String(data.grade_level) : '',
          notes: data.notes || '',
          role: data.role || 'STUDENT',
        });
        // Update user in localStorage
        localStorage.setItem('user', JSON.stringify(data));
      } catch (err) {
        console.error('Failed to load user profile:', err);
        // Fallback to localStorage
        const storedStr = localStorage.getItem('user');
        if (storedStr) {
          try {
            const data = JSON.parse(storedStr);
            setProfile(prev => ({
              ...prev,
              id: data.id,
              email: data.email || '',
              full_name: data.full_name || '',
              phone_number: data.phone_number || '',
              parent_phone: data.parent_phone || '',
              parent_name: data.parent_name || '',
              date_of_birth: data.date_of_birth || '',
              gender: data.gender || 'Nam',
              school: data.school || '',
              student_code: data.student_code || '',
              grade_level: data.grade_level ? String(data.grade_level) : '',
              notes: data.notes || '',
              role: data.role || 'STUDENT',
            }));
          } catch {}
        }
      } finally {
        setLoading(false);
      }
    }
    loadUserProfile();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profile.full_name.trim()) {
      toast.error('Họ và tên không được để trống.');
      return;
    }

    setSavingInfo(true);
    try {
      const payload = {
        full_name: profile.full_name.trim(),
        phone_number: profile.phone_number.trim() || null,
        parent_phone: profile.parent_phone.trim() || null,
        parent_name: profile.parent_name.trim() || null,
        date_of_birth: profile.date_of_birth || null,
        gender: profile.gender || null,
        school: profile.school.trim() || null,
        student_code: profile.student_code.trim() || null,
        grade_level: profile.grade_level ? parseInt(profile.grade_level, 10) : null,
        notes: profile.notes.trim() || null,
      };

      const res = await api.put('/auth/profile', payload);
      const updatedUser = res.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('Cập nhật thông tin cá nhân thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể cập nhật thông tin. Vui lòng thử lại.');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại.';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const initial = (profile.full_name || profile.email || 'H').charAt(0).toUpperCase();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-card relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-50 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              {initial}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {profile.full_name || 'Học sinh'}
                </h1>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Học sinh</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-mono mt-0.5">{profile.email}</p>
              
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600">
                {profile.school && (
                  <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] font-medium text-slate-700">
                    <School className="w-3 h-3 text-slate-500" />
                    <span>{profile.school}</span>
                  </span>
                )}
                {profile.grade_level && (
                  <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] font-medium text-slate-700">
                    <span>Khối {profile.grade_level}</span>
                  </span>
                )}
                {profile.student_code && (
                  <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium text-slate-700">
                    <span>Mã: {profile.student_code}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'info'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Thông tin cá nhân</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Đổi mật khẩu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'info' ? (
        /* --- TAB 1: THÔNG TIN HỌC SINH --- */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-card animate-fadeIn">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Chỉnh sửa thông tin học sinh
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cập nhật thông tin cá nhân và thông tin phụ huynh để giáo viên tiện liên lạc
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline-block">
              * Trường bắt buộc
            </span>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            {/* Nhóm 1: Thông tin cơ bản */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                <User className="w-4 h-4 text-indigo-600" />
                <span>1. Thông tin học tập &amp; cá nhân</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Họ và tên học sinh *
                  </label>
                  <input
                    type="text"
                    required
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm font-medium text-slate-900 transition"
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email tài khoản (Không thể thay đổi)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      disabled
                      value={profile.email}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm font-mono cursor-not-allowed select-all"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-600 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Đã xác thực
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Số điện thoại học sinh
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      value={profile.phone_number}
                      onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm font-medium text-slate-900 transition"
                      placeholder="0912 345 678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ngày sinh
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <input
                      type="date"
                      value={profile.date_of_birth}
                      onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm font-medium text-slate-900 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Giới tính
                  </label>
                  <select
                    value={profile.gender}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm font-medium text-slate-900 transition"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Khối lớp
                  </label>
                  <select
                    value={profile.grade_level}
                    onChange={(e) => setProfile({ ...profile, grade_level: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm font-medium text-slate-900 transition"
                  >
                    <option value="">Chọn khối lớp</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Khối {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Trường học đang theo học
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <School className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={profile.school}
                      onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm font-medium text-slate-900 transition"
                      placeholder="THPT Chuyên Lê Hồng Phong..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mã số học sinh
                  </label>
                  <input
                    type="text"
                    value={profile.student_code}
                    onChange={(e) => setProfile({ ...profile, student_code: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm font-mono text-slate-900 transition"
                    placeholder="HS-102"
                  />
                </div>
              </div>
            </div>

            {/* Nhóm 2: Thông tin phụ huynh */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                <HeartHandshake className="w-4 h-4 text-emerald-600" />
                <span>2. Thông tin liên hệ phụ huynh</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Họ và tên phụ huynh
                  </label>
                  <input
                    type="text"
                    value={profile.parent_name}
                    onChange={(e) => setProfile({ ...profile, parent_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm font-medium text-slate-900 transition"
                    placeholder="Nguyễn Văn B (Bố) / Lê Thị C (Mẹ)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Số điện thoại phụ huynh
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      value={profile.parent_phone}
                      onChange={(e) => setProfile({ ...profile, parent_phone: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm font-medium text-slate-900 transition"
                      placeholder="0987 654 321"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Nhóm 3: Ghi chú cá nhân */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>3. Mục tiêu học tập &amp; Ghi chú cá nhân</span>
              </h3>

              <div>
                <textarea
                  rows={3}
                  value={profile.notes}
                  onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm text-slate-900 transition resize-none"
                  placeholder="Ví dụ: Ôn thi tốt nghiệp THPT, mục tiêu đạt điểm 9+ môn Toán và Vật lý..."
                />
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={savingInfo}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs hover:shadow-md transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
              >
                {savingInfo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu thông tin...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu thay đổi thông tin</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* --- TAB 2: ĐỔI MẬT KHẨU --- */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-card animate-fadeIn max-w-xl mx-auto">
          <div className="pb-4 mb-6 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Đổi mật khẩu tài khoản
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Định kỳ đổi mật khẩu để bảo vệ an toàn cho tài khoản và kết quả bài thi của bạn
            </p>
          </div>

          {passwordError && (
            <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs sm:text-sm font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mật khẩu hiện tại *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm text-slate-900 transition"
                  placeholder="Nhập mật khẩu đang dùng"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mật khẩu mới *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm text-slate-900 transition"
                  placeholder="Tối thiểu 6 ký tự"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Gợi ý: Mật khẩu nên gồm chữ cái, số và ký tự đặc biệt để an toàn nhất.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Xác nhận mật khẩu mới *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm text-slate-900 transition"
                  placeholder="Gõ lại mật khẩu mới"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs hover:shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang cập nhật mật khẩu...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Cập nhật mật khẩu mới</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
