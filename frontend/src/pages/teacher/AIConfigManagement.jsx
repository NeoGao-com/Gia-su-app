import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { 
  Cpu, Plus, CheckCircle, Trash2, Key, Globe, Layers, Play, Eye, EyeOff, 
  Sparkles, Edit3, Zap, Terminal, Award, CheckCircle2, RefreshCw
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { MathRenderer } from '../../components/MathRenderer';
import { useToast } from '../../context/ToastContext';

const PRESET_PROVIDERS = [
  {
    id: 'gemini',
    provider: 'Gemini',
    name: 'Google Gemini 2.0 Flash',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model_name: 'gemini-2.0-flash',
    badge: 'Khuyên dùng • Nhanh & Tốt',
    bg: 'from-blue-500/10 via-indigo-500/10 to-purple-500/10 border-blue-200',
    iconColor: 'text-blue-600',
    description: 'Miễn phí giới hạn cao, phản hồi cực nhanh, nhận diện công thức toán LaTeX xuất sắc.'
  },
  {
    id: 'openai',
    provider: 'OpenAI',
    name: 'OpenAI GPT-4o Mini',
    base_url: 'https://api.openai.com/v1',
    model_name: 'gpt-4o-mini',
    badge: 'Phổ biến',
    bg: 'from-emerald-500/10 to-teal-500/10 border-emerald-200',
    iconColor: 'text-emerald-600',
    description: 'Chuẩn mực ngành, ổn định tuyệt đối cho khảo thí và thẩm định đề thi.'
  },
  {
    id: 'deepseek',
    provider: 'DeepSeek',
    name: 'DeepSeek V3',
    base_url: 'https://api.deepseek.com/v1',
    model_name: 'deepseek-chat',
    badge: 'Toán học & Tiết kiệm',
    bg: 'from-sky-500/10 to-indigo-500/10 border-sky-200',
    iconColor: 'text-sky-600',
    description: 'Mô hình chuyên sâu về tư duy logic toán học với chi phí API siêu rẻ.'
  },
  {
    id: 'groq',
    provider: 'Groq',
    name: 'Groq LPU (Llama 3.3 70B)',
    base_url: 'https://api.groq.com/openai/v1',
    model_name: 'llama-3.3-70b-versatile',
    badge: 'Siêu tốc độ',
    bg: 'from-amber-500/10 to-orange-500/10 border-amber-200',
    iconColor: 'text-amber-600',
    description: 'Xử lý văn bản tức thì (hàng trăm token/giây) dựa trên kiến trúc chip LPU.'
  },
  {
    id: 'openrouter',
    provider: 'OpenRouter',
    name: 'OpenRouter (Claude 3.5 Sonnet)',
    base_url: 'https://openrouter.ai/api/v1',
    model_name: 'anthropic/claude-3.5-sonnet',
    badge: 'Đa mô hình',
    bg: 'from-purple-500/10 to-pink-500/10 border-purple-200',
    iconColor: 'text-purple-600',
    description: 'Cổng đa nhà cung cấp, hỗ trợ Claude 3.5 Sonnet, GPT-4o, Gemini.'
  },
  {
    id: 'ollama',
    provider: 'Ollama',
    name: 'Ollama Local (Offline)',
    base_url: 'http://localhost:11434/v1',
    model_name: 'llama3',
    badge: 'Chạy nội bộ',
    bg: 'from-gray-500/10 to-slate-500/10 border-gray-200',
    iconColor: 'text-gray-700',
    description: 'Chạy trực tiếp trên máy chủ giáo viên không cần internet hay API key.'
  }
];

export function AIConfigManagement() {
  const { toast, confirm } = useToast();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testingCustom, setTestingCustom] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState({});

  // Active Provider Info
  const activeConfig = configs.find(c => c.is_active);

  // Form State
  const [formData, setFormData] = useState({
    provider: 'Gemini',
    name: 'Google Gemini 2.0 Flash',
    api_key: '',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model_name: 'gemini-2.0-flash',
    is_active: false
  });

  // Playground state
  const [playgroundTab, setPlaygroundTab] = useState('generate'); // 'generate' | 'verify' | 'grade'
  const [playgroundLoading, setPlaygroundLoading] = useState(false);

  // Playground: Generate questions
  const [promptText, setPromptText] = useState('Cho tam giác ABC có góc A = 60 độ, cạnh b = 5, c = 8. Tính cạnh a và diện tích tam giác.');
  const [numQuestions, setNumQuestions] = useState(2);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);

  // Playground: Verify question
  const [verifyContent, setVerifyContent] = useState('Nghiệm của phương trình $2^x = 8$ là:');
  const [verifyOptions, setVerifyOptions] = useState(['$x = 2$', '$x = 3$', '$x = 4$', '$x = 1$']);
  const [verifyCorrectOption, setVerifyCorrectOption] = useState(1);
  const [verifyResult, setVerifyResult] = useState(null);

  // Playground: Grade Essay
  const [essayPrompt, setEssayPrompt] = useState('Nêu ý nghĩa hình học của đạo hàm tại một điểm.');
  const [essaySolution, setEssaySolution] = useState('Đạo hàm của hàm số y = f(x) tại điểm x0 là hệ số góc của tiếp tuyến của đồ thị hàm số tại điểm M0(x0; f(x0)).');
  const [studentAnswer, setStudentAnswer] = useState('Đạo hàm là hệ số góc của đường tiếp tuyến với đồ thị tại điểm đó.');
  const [gradeResult, setGradeResult] = useState(null);

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/ai-configs');
      setConfigs(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể tải cấu hình AI');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleOpenAddModal = (preset = null) => {
    setEditingConfigId(null);
    if (preset) {
      setFormData({
        provider: preset.provider,
        name: preset.name,
        api_key: '',
        base_url: preset.base_url,
        model_name: preset.model_name,
        is_active: configs.length === 0
      });
    } else {
      setFormData({
        provider: 'Gemini',
        name: 'Google Gemini 2.0 Flash',
        api_key: '',
        base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        model_name: 'gemini-2.0-flash',
        is_active: configs.length === 0
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (config) => {
    setEditingConfigId(config.id);
    setFormData({
      provider: config.provider,
      name: config.name,
      api_key: config.api_key || '',
      base_url: config.base_url || '',
      model_name: config.model_name || '',
      is_active: config.is_active || false
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingConfigId) {
        await api.put(`/ai-configs/${editingConfigId}`, formData);
        toast.success('Đã cập nhật cấu hình AI thành công!');
      } else {
        await api.post('/ai-configs', formData);
        toast.success('Đã thêm AI Provider thành công!');
      }
      setIsModalOpen(false);
      loadConfigs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể lưu cấu hình');
    }
  };

  const handleActivate = async (id, name) => {
    try {
      await api.post(`/ai-configs/${id}/activate`);
      loadConfigs();
      toast.success(`Đã kích hoạt AI Provider "${name}"!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể kích hoạt');
    }
  };

  const handleTestExisting = async (id) => {
    try {
      setTestingId(id);
      const res = await api.post(`/ai-configs/${id}/test`);
      toast.success(res.data?.message || 'Kiểm tra kết nối AI thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kiểm tra kết nối thất bại');
    } finally {
      setTestingId(null);
    }
  };

  const handleTestInModal = async () => {
    if (!formData.api_key && formData.provider !== 'Ollama') {
      toast.warning('Vui lòng nhập API Key để kiểm tra kết nối');
      return;
    }
    try {
      setTestingCustom(true);
      const res = await api.post('/ai-configs/test-custom', {
        provider: formData.provider,
        api_key: formData.api_key || 'dummy_for_ollama',
        base_url: formData.base_url,
        model_name: formData.model_name
      });
      toast.success(res.data?.message || 'Kiểm tra kết nối thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kiểm tra kết nối thất bại');
    } finally {
      setTestingCustom(false);
    }
  };

  const handleDelete = (id, name) => {
    confirm({
      title: 'Xác nhận xóa AI Provider',
      message: `Bạn có chắc muốn xóa cấu hình AI "${name}"?`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await api.delete(`/ai-configs/${id}`);
          loadConfigs();
          toast.success('Đã xóa cấu hình AI thành công!');
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể xóa cấu hình');
        }
      }
    });
  };

  // Playground actions
  const handlePlaygroundGenerate = async () => {
    if (!promptText.trim()) {
      toast.warning('Vui lòng nhập chủ đề câu hỏi');
      return;
    }
    try {
      setPlaygroundLoading(true);
      const res = await api.post('/ai/generate-questions', {
        prompt_text: promptText,
        num_questions: numQuestions
      });
      setGeneratedQuestions(res.data?.questions || []);
      toast.success(`AI đã sinh thành công ${res.data?.questions?.length || 0} câu hỏi!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể sinh câu hỏi bằng AI');
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const handlePlaygroundVerify = async () => {
    try {
      setPlaygroundLoading(true);
      const res = await api.post('/ai/verify-question', {
        content: verifyContent,
        question_type: 'MULTIPLE_CHOICE',
        options: verifyOptions,
        correct_option: verifyCorrectOption,
        sample_solution: null
      });
      setVerifyResult(res.data);
      toast.success('AI đã hoàn thành thẩm định câu hỏi!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể thẩm định câu hỏi bằng AI');
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const handlePlaygroundGrade = async () => {
    try {
      setPlaygroundLoading(true);
      const res = await api.post('/ai/grade-essay', {
        question_content: essayPrompt,
        sample_solution: essaySolution,
        student_answer: studentAnswer
      });
      setGradeResult(res.data);
      toast.success('AI đã hoàn thành chấm bài tự luận!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể chấm bài bằng AI');
    } finally {
      setPlaygroundLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Cpu className="w-6 h-6" />
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Trợ lý Soạn đề & Cài đặt AI
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Kết nối các mô hình AI (Google Gemini, OpenAI GPT-4o, DeepSeek, Claude) để hỗ trợ sinh câu hỏi, chuẩn hóa đề thi và gợi ý lời giải.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleOpenAddModal()}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm hover:bg-indigo-700 active:scale-95 transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm nhà cung cấp AI</span>
              </button>
            </div>
          </div>

          {/* Active Provider Status Banner */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeConfig ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trạng thái AI hệ thống</div>
                {activeConfig ? (
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-base font-extrabold text-slate-900">{activeConfig.name}</span>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-bold flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Đang hoạt động</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-amber-700 mt-0.5">
                    Chưa kích hoạt AI Provider nào (hệ thống đang dùng chế độ offline/mặc định)
                  </div>
                )}
                {activeConfig && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    Mô hình: <strong className="text-slate-800">{activeConfig.model_name}</strong> • Nhà cung cấp: <strong className="text-slate-800">{activeConfig.provider}</strong>
                  </div>
                )}
              </div>
            </div>

            {activeConfig && (
              <button
                onClick={() => handleTestExisting(activeConfig.id)}
                disabled={testingId === activeConfig.id}
                className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 text-indigo-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingId === activeConfig.id ? 'animate-spin' : ''}`} />
                <span>{testingId === activeConfig.id ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
              </button>
            )}
          </div>

          {/* Quick Connect Preset Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Kết nối nhanh các nhà cung cấp phổ biến</span>
              </h2>
              <span className="text-xs text-slate-400">Nhấn vào để điền sẵn mẫu cấu hình</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {PRESET_PROVIDERS.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleOpenAddModal(p)}
                  className={`p-4 rounded-2xl border bg-gradient-to-br ${p.bg} hover:border-indigo-400 cursor-pointer transition shadow-xs flex flex-col justify-between`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900">{p.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 border border-slate-200 text-slate-700">
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {p.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-indigo-700">
                    <span>+ Thiết lập cấu hình</span>
                    <span className="text-[11px] font-mono text-slate-400">{p.model_name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Configured AI List */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 font-extrabold text-sm text-slate-800 flex justify-between items-center">
              <span>Danh sách nhà cung cấp AI đã lưu ({configs.length})</span>
            </div>

            {loading ? (
              <div className="text-center py-16 text-slate-400 text-sm">Đang tải danh sách...</div>
            ) : configs.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm space-y-2">
                <Cpu className="w-8 h-8 text-slate-300 mx-auto" />
                <div>Chưa có cấu hình AI nào được lưu.</div>
                <button
                  onClick={() => handleOpenAddModal()}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  + Thêm nhà cung cấp AI đầu tiên
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {configs.map(c => (
                  <div key={c.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900">{c.name}</span>
                        <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200/60 text-indigo-700 rounded-full text-xs font-bold">
                          {c.provider}
                        </span>
                        {c.is_active && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Đang hoạt động</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                        <span className="flex items-center space-x-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/80">
                          <Key className="w-3 h-3 text-slate-400" />
                          <span>{revealedKeys[c.id] ? c.api_key : c.api_key_masked}</span>
                          <button
                            type="button"
                            onClick={() => setRevealedKeys(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                            className="text-slate-400 hover:text-slate-700 ml-1 p-0.5"
                            title={revealedKeys[c.id] ? 'Ẩn key' : 'Hiện key'}
                          >
                            {revealedKeys[c.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </span>

                        <span className="flex items-center space-x-1 text-slate-400 font-sans">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>Mô hình: <strong className="text-slate-700">{c.model_name}</strong></span>
                        </span>

                        {c.base_url && (
                          <span className="flex items-center space-x-1 text-slate-400 font-sans truncate max-w-xs" title={c.base_url}>
                            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{c.base_url}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleTestExisting(c.id)}
                        disabled={testingId === c.id}
                        className="flex items-center space-x-1 px-3 py-2 bg-indigo-50 border border-indigo-200/70 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
                        title="Kiểm tra kết nối và đo độ trễ"
                      >
                        <Play className="w-3 h-3" />
                        <span>{testingId === c.id ? 'Test...' : 'Kiểm tra'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                        title="Chỉnh sửa cấu hình"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {!c.is_active ? (
                        <button
                          onClick={() => handleActivate(c.id, c.name)}
                          className="px-3.5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-bold transition shadow-xs"
                        >
                          Kích hoạt
                        </button>
                      ) : (
                        <span className="px-3.5 py-2 text-emerald-700 bg-emerald-50 rounded-xl text-xs font-bold border border-emerald-200">
                          Đang dùng
                        </span>
                      )}

                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Xóa cấu hình"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive AI Playground */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-indigo-600" />
                  <span>Trải nghiệm & Thử nghiệm tính năng AI</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thử nghiệm khả năng sinh câu hỏi, giải toán LaTeX và chấm bài tự luận của AI Provider đang kích hoạt.
                </p>
              </div>

              {/* Tabs */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setPlaygroundTab('generate')}
                  className={`px-3 py-1.5 rounded-lg transition ${playgroundTab === 'generate' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Sinh câu hỏi
                </button>
                <button
                  onClick={() => setPlaygroundTab('verify')}
                  className={`px-3 py-1.5 rounded-lg transition ${playgroundTab === 'verify' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Thẩm định câu hỏi
                </button>
                <button
                  onClick={() => setPlaygroundTab('grade')}
                  className={`px-3 py-1.5 rounded-lg transition ${playgroundTab === 'grade' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Chấm tự luận
                </button>
              </div>
            </div>

            {/* Tab 1: Generate Questions */}
            {playgroundTab === 'generate' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Chủ đề / Yêu cầu đề thi</label>
                    <input
                      type="text"
                      value={promptText}
                      onChange={e => setPromptText(e.target.value)}
                      placeholder="VD: Cho tam giác ABC..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-600 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng câu</label>
                    <div className="flex items-center space-x-2">
                      <select
                        value={numQuestions}
                        onChange={e => setNumQuestions(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50/50 font-bold focus:outline-none focus:border-indigo-600 text-slate-800"
                      >
                        <option value={1}>1 câu</option>
                        <option value={2}>2 câu</option>
                        <option value={3}>3 câu</option>
                        <option value={5}>5 câu</option>
                      </select>
                      <button
                        onClick={handlePlaygroundGenerate}
                        disabled={playgroundLoading}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shrink-0 cursor-pointer shadow-xs"
                      >
                        {playgroundLoading ? 'Đang tạo...' : 'Tạo'}
                      </button>
                    </div>
                  </div>
                </div>

                {generatedQuestions.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-slate-700">Kết quả sinh từ AI:</div>
                    {generatedQuestions.map((q, idx) => (
                      <div key={idx} className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-indigo-700 tabular-nums">Câu {idx + 1} ({q.question_type})</span>
                          <span className="text-[11px] font-bold text-slate-500">{q.difficulty}</span>
                        </div>
                        <div className="text-xs text-slate-800 font-medium">
                          <MathRenderer content={q.content} />
                        </div>
                        {q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt, oIdx) => (
                              <div
                                key={oIdx}
                                className={`px-3 py-1.5 rounded-xl border text-xs flex items-center space-x-2 ${
                                  q.correct_option === oIdx
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                                <MathRenderer content={opt} />
                              </div>
                            ))}
                          </div>
                        )}
                        {q.explanation && (
                          <div className="text-[11px] text-slate-500 italic bg-white p-2 rounded-xl border border-slate-100">
                            <strong>Lời giải:</strong> <MathRenderer content={q.explanation} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Verify Question */}
            {playgroundTab === 'verify' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung câu hỏi cần thẩm định</label>
                  <input
                    type="text"
                    value={verifyContent}
                    onChange={e => setVerifyContent(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:outline-none focus:border-indigo-600 text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {verifyOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="verify-correct"
                        checked={verifyCorrectOption === idx}
                        onChange={() => setVerifyCorrectOption(idx)}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold w-4 text-slate-700">{String.fromCharCode(65 + idx)}.</span>
                      <input
                        type="text"
                        value={opt}
                        onChange={e => {
                          const newOpts = [...verifyOptions];
                          newOpts[idx] = e.target.value;
                          setVerifyOptions(newOpts);
                        }}
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handlePlaygroundVerify}
                    disabled={playgroundLoading}
                    className="flex items-center space-x-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{playgroundLoading ? 'Đang thẩm định...' : 'Bắt đầu thẩm định'}</span>
                  </button>
                </div>

                {verifyResult && (
                  <div className={`p-4 rounded-2xl border space-y-2 ${verifyResult.is_correct ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {verifyResult.is_correct ? (
                          <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-xs font-bold">
                            ĐÁP ÁN ĐÚNG
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full text-xs font-bold">
                            CẦN KIỂM TRA LẠI
                          </span>
                        )}
                        <span className="text-xs text-slate-500 font-medium tabular-nums">
                          Độ tin cậy: {Math.round((verifyResult.confidence || 0.9) * 100)}%
                        </span>
                      </div>
                    </div>
                    {verifyResult.ai_answer && (
                      <div className="text-xs font-bold text-slate-700">
                        Đáp án AI tính toán: <strong className="text-indigo-700">{verifyResult.ai_answer}</strong>
                      </div>
                    )}
                    <div className="text-xs text-slate-600 leading-relaxed">
                      {verifyResult.feedback}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Grade Essay */}
            {playgroundTab === 'grade' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Đề bài tự luận</label>
                    <textarea
                      rows="2"
                      value={essayPrompt}
                      onChange={e => setEssayPrompt(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-indigo-600 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Đáp án mẫu / Thang điểm</label>
                    <textarea
                      rows="2"
                      value={essaySolution}
                      onChange={e => setEssaySolution(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-indigo-600 text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bài làm của học sinh</label>
                  <textarea
                    rows="3"
                    value={studentAnswer}
                    onChange={e => setStudentAnswer(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-indigo-600 text-slate-800"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handlePlaygroundGrade}
                    disabled={playgroundLoading}
                    className="flex items-center space-x-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Award className="w-4 h-4" />
                    <span>{playgroundLoading ? 'Đang chấm...' : 'Chấm bài'}</span>
                  </button>
                </div>

                {gradeResult && (
                  <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl font-extrabold text-indigo-700 tabular-nums">
                        {gradeResult.score !== undefined ? `${gradeResult.score} / 10 Điểm` : 'Đã chấm'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {gradeResult.feedback}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Thêm / Chỉnh sửa Provider */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={editingConfigId ? 'Chỉnh sửa AI Provider' : 'Thêm AI Provider mới'}
            size="md"
          >
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nhà cung cấp (Provider)</label>
                <select
                  value={formData.provider}
                  onChange={e => {
                    const val = e.target.value;
                    const matchedPreset = PRESET_PROVIDERS.find(p => p.provider === val);
                    const defaultBase = matchedPreset ? matchedPreset.base_url : 'https://api.openai.com/v1';
                    const defaultModel = matchedPreset ? matchedPreset.model_name : 'gpt-4o-mini';
                    setFormData({
                      ...formData,
                      provider: val,
                      name: matchedPreset ? matchedPreset.name : `${val} Provider`,
                      base_url: defaultBase,
                      model_name: defaultModel
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-indigo-600 text-slate-800"
                >
                  <option value="Gemini">Google Gemini (Gemini 2.0 Flash, 1.5 Pro)</option>
                  <option value="OpenAI">OpenAI (GPT-4o, GPT-4o-mini, o3-mini)</option>
                  <option value="DeepSeek">DeepSeek (DeepSeek V3, R1)</option>
                  <option value="Groq">Groq LPU (Llama 3.3 70B, Mixtral)</option>
                  <option value="OpenRouter">OpenRouter (Claude 3.5, GPT-4o)</option>
                  <option value="Ollama">Ollama Local (Offline)</option>
                  <option value="Custom">Custom OpenAI-compatible Endpoint</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên hiển thị</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Google Gemini 2.0 Flash chính"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-indigo-600 text-slate-800"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    API Key {formData.provider === 'Ollama' ? '(Không bắt buộc với Ollama)' : ''}
                  </label>
                  {formData.provider === 'Gemini' && (
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-indigo-600 hover:underline font-bold"
                    >
                      Lấy Gemini Key miễn phí ↗
                    </a>
                  )}
                  {formData.provider === 'OpenAI' && (
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-indigo-600 hover:underline font-bold"
                    >
                      Lấy OpenAI Key ↗
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  required={formData.provider !== 'Ollama'}
                  placeholder={formData.provider === 'Ollama' ? 'Để trống nếu dùng Ollama nội bộ' : 'sk-... hoặc AIzaSy...'}
                  value={formData.api_key}
                  onChange={e => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-mono focus:outline-none focus:border-indigo-600 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Base URL (API Endpoint)</label>
                  <input
                    type="text"
                    required
                    value={formData.base_url}
                    onChange={e => setFormData({ ...formData, base_url: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Model Name</label>
                  <input
                    type="text"
                    required
                    value={formData.model_name}
                    onChange={e => setFormData({ ...formData, model_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestInModal}
                  disabled={testingCustom}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{testingCustom ? 'Đang test key...' : 'Kiểm tra key trước khi lưu'}</span>
                </button>

                <label className="flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Kích hoạt ngay</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {editingConfigId ? 'Cập nhật' : 'Lưu cấu hình'}
                </button>
              </div>
            </form>
          </Modal>
        </main>
      </div>
    </div>
  );
}
