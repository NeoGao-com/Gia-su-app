import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api, { resolveImageUrl } from '../../api/axios';
import { Plus, Search, FolderTree, Trash2, Edit3, Sparkles } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CreateQuestionModal } from '../../components/CreateQuestionModal';
import { CreateCategoryModal } from '../../components/CreateCategoryModal';
import { WinFileExplorerTree } from '../../components/WinFileExplorerTree';
import { MathRenderer } from '../../components/MathRenderer';

export function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [treeData, setTreeData] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null); // { subject, grade_level, chapter, lesson, topic }
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // JSON Import modal
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadTree = async () => {
      try {
        const res = await api.get('/questions/tree/structure');
        if (!cancelled) setTreeData(res.data || {});
      } catch {
        if (!cancelled) setTreeData({});
      }
    };
    loadTree();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadQuestions = async () => {
      try {
        let url = '/questions/?limit=100';
        if (selectedCategory) {
          if (selectedCategory.subject) url += `&subject=${encodeURIComponent(selectedCategory.subject)}`;
          if (selectedCategory.grade_level) url += `&grade_level=${selectedCategory.grade_level}`;
          if (selectedCategory.chapter) url += `&chapter=${encodeURIComponent(selectedCategory.chapter)}`;
          if (selectedCategory.lesson) url += `&lesson=${encodeURIComponent(selectedCategory.lesson)}`;
          if (selectedCategory.topic) url += `&topic=${encodeURIComponent(selectedCategory.topic)}`;
        }
        const res = await api.get(url);
        if (cancelled) return;
        setQuestions(Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []));
      } catch {
        if (!cancelled) setQuestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadQuestions();
    return () => { cancelled = true; };
  }, [selectedCategory]);

  const refreshQuestions = async () => {
    try {
      setLoading(true);
      let url = '/questions/?limit=100';
      if (selectedCategory) {
        if (selectedCategory.subject) url += `&subject=${encodeURIComponent(selectedCategory.subject)}`;
        if (selectedCategory.grade_level) url += `&grade_level=${selectedCategory.grade_level}`;
        if (selectedCategory.chapter) url += `&chapter=${encodeURIComponent(selectedCategory.chapter)}`;
        if (selectedCategory.lesson) url += `&lesson=${encodeURIComponent(selectedCategory.lesson)}`;
        if (selectedCategory.topic) url += `&topic=${encodeURIComponent(selectedCategory.topic)}`;
      }
      const res = await api.get(url);
      setQuestions(Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []));
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshTreeData = async () => {
    try {
      const res = await api.get('/questions/tree/structure');
      setTreeData(res.data || {});
    } catch {
      setTreeData({});
    }
  };

  const handleOpenModal = (q = null) => {
    if (q) {
      setEditingQuestion(q);
    } else {
      setEditingQuestion(null);
    }
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (formData) => {
    try {
      if (editingQuestion) {
        await api.put(`/questions/${editingQuestion.id}`, formData);
        alert('Cập nhật câu hỏi thành công!');
      } else {
        await api.post('/questions/', formData);
        alert('Tạo câu hỏi mới thành công!');
      }
      setIsModalOpen(false);
      setEditingQuestion(null);
      refreshQuestions();
      refreshTreeData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể lưu câu hỏi');
    }
  };

  const handleAddCategory = async (categoryData) => {
    try {
      await api.post('/questions/categories', categoryData);
      setIsCategoryModalOpen(false);
      refreshTreeData();
      alert('Tạo danh mục thành công!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể tạo danh mục');
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa câu hỏi này?')) return;
    try {
      await api.delete(`/questions/${id}`);
      refreshQuestions();
      refreshTreeData();
      alert('Đã xóa câu hỏi thành công!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể xóa câu hỏi');
    }
  };

  const handleCopyAiPrompt = () => {
    const textToCopy = `Hãy tạo cho tôi danh sách câu hỏi trắc nghiệm dưới dạng JSON chuẩn xác theo cấu trúc sau để tôi nhập vào hệ thống:
{
  "questions": [
    {
      "subject": "Toán",
      "grade_level": 10,
      "question_type": "MULTIPLE_CHOICE",
      "content": "Nội dung câu hỏi ở đây...",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correct_answer": "Đáp án A",
      "explanation": "Giải thích chi tiết...",
      "difficulty": "THONG_HIEU",
      "chapter": "Chương I",
      "lesson": "Bài 1",
      "topic": "Dạng 1"
    }
  ]
}
Yêu cầu: Đảm bảo đúng định dạng JSON, không kèm văn bản giải thích ngoài JSON.`;
    navigator.clipboard.writeText(textToCopy);
    alert('Đã copy Prompt mẫu cho AI!');
  };

  
  
  
  const handleDeleteCategory = async (categoryData) => {
    if (!confirm('Bạn có chắc muốn xóa thư mục này? (Tất cả câu hỏi trong thư mục cũng sẽ bị xóa)')) return;
    try {
        const res = await api.delete('/questions/categories', { data: categoryData });
        setSelectedCategory(null);
        refreshQuestions();
        refreshTreeData();
        alert(res.data?.message || 'Đã xóa danh mục thành công!');
    } catch (err) {
        alert(err.response?.data?.detail || 'Không thể xóa danh mục');
    }
  };

  // Kéo-thả: di chuyển 1 câu hỏi sang thư mục khác (đổi taxonomy)
  const handleMoveQuestion = async (questionId, targetTaxonomy) => {
    try {
      const targetName = [
        targetTaxonomy.subject,
        targetTaxonomy.grade_level ? `Khối ${targetTaxonomy.grade_level}` : '',
        targetTaxonomy.chapter,
        targetTaxonomy.lesson,
        targetTaxonomy.topic
      ].filter(Boolean).join(' › ');

      const payload = {
        subject: targetTaxonomy.subject || 'Toán',
        grade_level: targetTaxonomy.grade_level || 10,
        chapter: targetTaxonomy.chapter || 'Chương I',
        lesson: targetTaxonomy.lesson || 'Bài 1',
        topic: targetTaxonomy.topic || 'Dạng 1'
      };

      await api.put(`/questions/${questionId}`, payload);
      alert(`Đã di chuyển câu hỏi sang "${targetName}" thành công!`);
      refreshQuestions();
      refreshTreeData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể di chuyển câu hỏi');
    }
  };

  // Kéo-thả: di chuyển cả thư mục (đổi taxonomy của tất cả câu hỏi + category con)
  const handleMoveCategory = async (sourceTaxonomy, targetTaxonomy) => {
    try {
      let url = `/questions/?limit=500`;
      if (sourceTaxonomy.subject) url += `&subject=${encodeURIComponent(sourceTaxonomy.subject)}`;
      if (sourceTaxonomy.grade_level) url += `&grade_level=${sourceTaxonomy.grade_level}`;
      if (sourceTaxonomy.chapter) url += `&chapter=${encodeURIComponent(sourceTaxonomy.chapter)}`;
      if (sourceTaxonomy.lesson) url += `&lesson=${encodeURIComponent(sourceTaxonomy.lesson)}`;
      if (sourceTaxonomy.topic) url += `&topic=${encodeURIComponent(sourceTaxonomy.topic)}`;
      const res = await api.get(url);
      const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
      if (items.length === 0) return alert('Thư mục nguồn không có câu hỏi để di chuyển');

      const targetName = [
        targetTaxonomy.subject,
        targetTaxonomy.grade_level ? `Khối ${targetTaxonomy.grade_level}` : '',
        targetTaxonomy.chapter,
        targetTaxonomy.lesson,
        targetTaxonomy.topic
      ].filter(Boolean).join(' › ');

      if (!confirm(`Di chuyển ${items.length} câu hỏi sang "${targetName}"?`)) return;

      for (const q of items) {
        const payload = {
          subject: targetTaxonomy.subject ?? q.subject,
          grade_level: targetTaxonomy.grade_level ?? q.grade_level,
          chapter: targetTaxonomy.chapter ?? q.chapter,
          lesson: targetTaxonomy.lesson ?? q.lesson,
          topic: targetTaxonomy.topic ?? q.topic
        };
        await api.put(`/questions/${q.id}`, payload);
      }
      alert(`Đã di chuyển ${items.length} câu hỏi sang "${targetName}"!`);
      refreshQuestions();
      refreshTreeData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể di chuyển thư mục');
    }
  };


  

  const handleImportJsonSubmit = async (e) => {
    e.preventDefault();
    try {
      let raw = jsonInput.trim();
      // Tự động gỡ markdown codeblock ```json ... ``` nếu copy trực tiếp từ AI
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        alert(`Định dạng JSON không hợp lệ: ${parseErr.message}\n\nHãy kiểm tra xem văn bản có bị thiếu dấu ngoặc {} hoặc nháy kép "" không.`);
        return;
      }
      const payload = Array.isArray(parsed) ? { questions: parsed } : (parsed.questions ? parsed : { questions: [parsed] });
      const res = await api.post('/questions/import-json', payload);
      alert(res.data.message || 'Nhập câu hỏi thành công!');
      setIsJsonModalOpen(false);
      setJsonInput('');
      refreshQuestions();
      refreshTreeData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể nhập JSON');
    }
  };

  const filteredQuestions = questions.filter(q => {
    const query = searchQuery.toLowerCase();
    const contentMatch = (q.content || '').toLowerCase().includes(query);
    const codeMatch = (q.code || '').toLowerCase().includes(query);
    return contentMatch || codeMatch;
  });


  // ponytail: bỏ log debug khi build production, chỉ log lúc dev để tránh spam console
  useEffect(() => {
    if (import.meta.env.DEV) console.log("Questions state updated:", questions?.length || 0);
  }, [questions]);

  return (
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                <FolderTree className="w-7 h-7 text-pastel-purpleDark" />
                <span>Ngân hàng Câu hỏi & Cây kiến thức</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1">Quản lý câu hỏi phân tầng theo Môn, Khối, Chương, Bài và Dạng bài.</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsJsonModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-2xl font-semibold text-sm shadow-sm hover:bg-emerald-700 transition"
              >
                <span>Nhập JSON</span>
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center space-x-2 px-5 py-2.5 bg-pastel-purple text-white rounded-2xl font-bold text-sm shadow-sm hover:bg-pastel-purpleDark transition"
              >
                <Plus className="w-5 h-5" />
                <span>Tạo câu hỏi</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Tree Sidebar */}
            <div className="col-span-4">
              <WinFileExplorerTree
                treeData={treeData}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onAddCategory={() => { setIsCategoryModalOpen(true); }}
                onDeleteCategory={handleDeleteCategory}
                onMoveQuestion={handleMoveQuestion}
                onMoveCategory={handleMoveCategory}
              />
            </div>

            {/* Questions Main Content */}
            <div className="col-span-8 space-y-4">
              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-3">
                <Search className="w-5 h-5 text-gray-400 ml-2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm câu hỏi theo nội dung hoặc mã câu hỏi..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none text-sm focus:outline-none"
                />
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 font-bold text-sm text-gray-700 flex justify-between items-center">
                  <span>Danh sách câu hỏi ({filteredQuestions.length})</span>
                  {selectedCategory && (
                    <span className="text-xs font-normal text-pastel-purpleDark bg-purple-50 px-3 py-1 rounded-full">
                      Đang lọc theo: {selectedCategory.subject} › Khối {selectedCategory.grade_level} › {selectedCategory.chapter} › {selectedCategory.lesson} › {selectedCategory.topic}
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="text-center py-20 text-gray-400">Đang tải danh sách câu hỏi...</div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">Không tìm thấy câu hỏi nào.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredQuestions.map(q => (
                      <div
                        key={q.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'question', questionId: q.id }));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className="p-6 hover:bg-gray-50/50 transition space-y-3 cursor-grab active:cursor-grabbing"
                        title="Kéo câu hỏi này thả vào thư mục bên trái để di chuyển"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-2">
                            <span className="px-3 py-1 bg-purple-50 text-pastel-purpleDark rounded-xl text-xs font-bold">{q.code || `Q${q.id}`}</span>
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold">{q.question_type}</span>
                            <span className="text-xs text-gray-400">{q.subject} - Khối {q.grade_level}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button onClick={() => handleOpenModal(q)} className="p-2 text-gray-400 hover:text-pastel-purpleDark hover:bg-purple-50 rounded-xl transition">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="text-sm font-bold text-gray-800">
                          <MathRenderer content={q.content} />
                        </div>

                        {q.image_url && (
                          <div className="mt-2">
                            <img src={resolveImageUrl(q.image_url)} alt="Minh họa" className="max-h-48 rounded-2xl border object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          </div>
                        )}

                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            {q.options.map((opt, idx) => {
                              const label = ['A', 'B', 'C', 'D'][idx];
                              const isCorrect = q.correct_answer === opt || q.correct_answer === label;
                              return (
                                <div key={idx} className={`p-3 rounded-2xl text-xs font-medium border flex items-center space-x-2 ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                                  <span className="w-5 h-5 flex items-center justify-center bg-white rounded-lg shadow-xs font-bold">{label}</span>
                                  <MathRenderer content={opt} />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="text-xs text-gray-500 bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                            <strong className="text-blue-700 mr-1">Lời giải:</strong>
                            <MathRenderer content={q.explanation} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Create / Edit Question Modal */}
          {isModalOpen && (
            <CreateQuestionModal
              key={editingQuestion?.id ?? 'new'}
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onSubmit={handleSaveQuestion}
              initialData={editingQuestion}
            />
          )}

          {/* JSON Import Modal */}
          <Modal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} title="Nhập danh sách câu hỏi qua JSON">
            <form onSubmit={handleImportJsonSubmit} className="space-y-4 p-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Dán dữ liệu JSON theo định dạng chuẩn hoặc sử dụng Prompt mẫu để tạo qua AI.
                </p>
                <button
                  type="button"
                  onClick={handleCopyAiPrompt}
                  className="px-3 py-1.5 bg-purple-50 text-pastel-purpleDark hover:bg-purple-100 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Copy Prompt AI</span>
                </button>
              </div>
              <div>
                <textarea
                  rows="10"
                  required
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  placeholder="Dán JSON câu hỏi vào đây..."
                  className="w-full px-3 py-2 border rounded-xl text-xs font-mono bg-gray-50"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsJsonModalOpen(false)} className="px-4 py-2 border rounded-xl text-sm font-semibold">Hủy</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition">
                  Xác nhận Nhập JSON
                </button>
              </div>
            </form>
          </Modal>
          <CreateCategoryModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} onSubmit={handleAddCategory} />
        </main>
      </div>
    </div>
  );
}