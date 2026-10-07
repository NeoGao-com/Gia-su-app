import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  User, Mail, Phone, Calendar, School, 
  Lock, KeyRound, ShieldCheck, CheckCircle2, 
  Save, Eye, EyeOff, Loader2, AlertCircle, 
  BookOpen, Sparkles, UserCheck, FileText, Award
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';

export function TeacherProfile() {
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
    date_of_birth: '',
    gender: 'Nam',
    school: '',
    notes: '',
    role: 'TEACHER',
  });

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Load current teacher profile from API or localStorage
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
          date_of_birth: data.date_of_birth || '',
          gender: data.gender || 'Nam',
          school: data.school || '',
          notes: data.notes || '',
          role: data.role || 'TEACHER',
        });
        localStorage.setItem('user', JSON.stringify(data));
      } catch (err) {
        console.error('Failed to load teacher profile:', err);
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
              date_of_birth: data.date_of_birth || '',
              gender: data.gender || 'Nam',
              school: data.school || '',
              notes: data.notes || '',
              role: data.role || 'TEACHER',
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
      toast.error('Họ và tên giáo viên không được để trống.');
      return;
    }

    setSavingInfo(true);
    try {
      const payload = {
        full_name: (profile.full_name || '').trim(),
        phone_number: (profile.phone_number || '').trim() || null,
        date_of_birth: profile.date_of_birth || null,
        gender: profile.gender || null,
        school: (profile.school || '').trim() || null,
        notes: (profile.notes || '').trim() || null,
      };

      const res = await api.put('/auth/profile', payload);
      const updatedUser = res.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.dispatchEvent(new Event('user-updated'));
      toast.success('Cập nhật thông tin giáo viên thành công!');
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
    if (newPassword === currentPassword) {
      setPasswordError('Mật khẩu mới không được trùng với mật khẩu cũ.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    } catch (err) {
      setPasswordError(err.response?.data?.detail || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.');
    } finally {
      setChangingPassword(false);
    }
  };

  const initial = (profile.full_name || profile.email || 'G').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-7 mb-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md border-2 border-white ring-4 ring-indigo-50">
                  {initial}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {profile.full_name || 'Giáo viên'}
                    </h1>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                      Giáo viên
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-mono mt-0.5">{profile.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {profile.school && (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        <School className="w-3 h-3 text-slate-400" />
                        <span>{profile.school}</span>
                      </span>
                    )}
                    {profile.phone_number && (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                        <Phone className="w-3 h-3 text-emerald-500" />
                        <span>{profile.phone_number}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Security Status Badge */}
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Trạng thái bảo mật</span>
                <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600 mt-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Đã bảo vệ mật khẩu</span>
                </div>
              </div>
            </div>

            {/* Decorative background gradient */}
            <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-indigo-50/60 to-transparent pointer-events-none" />
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-200 mb-6 pb-px">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'info'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Thông tin giảng viên</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Bảo mật & Đổi mật khẩu</span>
            </button>
          </div>

          {/* TAB 1: THÔNG TIN GIẢNG VIÊN */}
          {activeTab === 'info' && (
            <form onSubmit={handleUpdateProfile} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-7 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  <span>Thông tin cá nhân & Liên hệ</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Thông tin này giúp học sinh và phụ huynh có thể liên hệ khi cần hỗ trợ hoặc giải đáp bài tập.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Họ và tên */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Họ và tên giáo viên <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-800 transition outline-hidden"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                </div>

                {/* Email (Readonly) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email tài khoản
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      disabled
                      value={profile.email}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium cursor-not-allowed outline-hidden"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">Email đăng nhập không thể thay đổi</span>
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Số điện thoại liên hệ
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={profile.phone_number}
                      onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-800 transition outline-hidden"
                      placeholder="0912 345 678"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">Hiển thị trong thông tin liên lạc lớp học</span>
                </div>

                {/* Ngày sinh */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ngày sinh
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={profile.date_of_birth}
                      onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-800 transition outline-hidden"
                    />
                  </div>
                </div>

                {/* Giới tính */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Giới tính
                  </label>
                  <select
                    value={profile.gender}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-800 transition outline-hidden bg-white"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                {/* Trường học / Đơn vị */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Trường học / Đơn vị công tác
                  </label>
                  <div className="relative">
                    <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={profile.school}
                      onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-800 transition outline-hidden"
                      placeholder="Ví dụ: THPT Chuyên Hà Nội - Amsterdam"
                    />
                  </div>
                </div>
              </div>

              {/* Giới thiệu / Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Giới thiệu bản thân / Môn học chuyên môn
                </label>
                <textarea
                  rows={3}
                  value={profile.notes}
                  onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                  className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-800 transition outline-hidden"
                  placeholder="Ví dụ: Giáo viên phụ trách môn Toán & Vật lý khối THPT, luyện thi THPT Quốc gia..."
                />
              </div>

              {/* Submit Button */}
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
          )}

          {/* TAB 2: BẢO MẬT & ĐỔI MẬT KHẨU */}
          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-7 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  <span>Thay đổi mật khẩu tài khoản</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Đảm bảo tài khoản giảng dạy của bạn được bảo mật bằng cách sử dụng mật khẩu mạnh.
                </p>
              </div>

              {passwordError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="space-y-4 max-w-md">
                {/* Mật khẩu hiện tại */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mật khẩu hiện tại <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-800 transition outline-hidden"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mật khẩu mới <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-800 transition outline-hidden"
                      placeholder="Tối thiểu 6 ký tự"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-800 transition outline-hidden"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password tips */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Lời khuyên bảo mật:</span>
                </div>
                <p>• Mật khẩu nên có tối thiểu 6 ký tự, bao gồm cả chữ hoa, chữ thường và chữ số.</p>
                <p>• Không nên sử dụng lại mật khẩu của các tài khoản khác hoặc thông tin cá nhân dễ đoán.</p>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs hover:shadow-md transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang cập nhật mật khẩu...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Cập nhật mật khẩu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
