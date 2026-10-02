import React, { useState, useMemo } from 'react';
import { 
  Folder, FolderOpen, ChevronRight, ChevronDown, Check, CheckSquare, Square, 
  Search, Filter, Laptop, ArrowUp, Layers, CheckCircle2, 
  Sparkles, FileText, BookOpen, AlertCircle
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';

const DIFFICULTY_MAP = {
  NHAN_BIET: { label: 'Nhận biết', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  THONG_HIEU: { label: 'Thông hiểu', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  VAN_DUNG: { label: 'Vận dụng', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  VAN_DUNG_CAO: { label: 'Vận dụng cao', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const TYPE_MAP = {
  MULTIPLE_CHOICE: 'Trắc nghiệm',
  TRUE_FALSE: 'Đúng / Sai',
  SHORT_ANSWER: 'Điền từ / Ngắn',
  ESSAY: 'Tự luận'
};

export function ManualQuestionExplorer({
  questions = [],
  selectedQuestionIds = [],
  onToggleSelect,
  onSelectBatch
}) {
  // Navigation path state: [ { type: 'root'|'subject'|'grade'|'chapter'|'lesson'|'topic', value: string, label: string } ]
  const [currentPath, setCurrentPath] = useState([
    { type: 'root', value: 'root', label: 'Tất cả câu hỏi' }
  ]);

  // Tree expanded nodes set: e.g. "s:Vật lý", "g:Vật lý/Khối 10", etc.
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());

  // Search & Filters in current folder
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewDetail, setViewDetail] = useState(true); // show/hide options preview

  // Build the hierarchical tree structure from loaded questions
  const tree = useMemo(() => {
    const root = {};
    for (const q of questions) {
      const subj = q.subject || 'Môn khác';
      const grade = q.grade_level ? `Khối ${q.grade_level}` : 'Khối khác';
      const chap = q.chapter || 'Chương chung';
      const les = q.lesson || 'Bài chung';
      const top = q.topic || 'Dạng chung';

      if (!root[subj]) root[subj] = { count: 0, children: {} };
      root[subj].count++;

      if (!root[subj].children[grade]) root[subj].children[grade] = { count: 0, children: {} };
      root[subj].children[grade].count++;

      if (!root[subj].children[grade].children[chap]) root[subj].children[grade].children[chap] = { count: 0, children: {} };
      root[subj].children[grade].children[chap].count++;

      if (!root[subj].children[grade].children[chap].children[les]) root[subj].children[grade].children[chap].children[les] = { count: 0, children: {} };
      root[subj].children[grade].children[chap].children[les].count++;

      if (!root[subj].children[grade].children[chap].children[les].children[top]) root[subj].children[grade].children[chap].children[les].children[top] = { count: 0 };
      root[subj].children[grade].children[chap].children[les].children[top].count++;
    }
    return root;
  }, [questions]);

  // Toggle folder expansion in tree
  const toggleFolder = (key) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Expand all / Collapse all folders
  const handleExpandAll = () => {
    const all = new Set();
    Object.entries(tree).forEach(([subj, sVal]) => {
      all.add(`s:${subj}`);
      Object.entries(sVal.children || {}).forEach(([grade, gVal]) => {
        all.add(`g:${subj}/${grade}`);
        Object.entries(gVal.children || {}).forEach(([chap, cVal]) => {
          all.add(`c:${subj}/${grade}/${chap}`);
          Object.keys(cVal.children || {}).forEach(([les]) => {
            all.add(`l:${subj}/${grade}/${chap}/${les}`);
          });
        });
      });
    });
    setExpandedFolders(all);
  };

  const handleCollapseAll = () => {
    setExpandedFolders(new Set());
  };

  // Navigate to path
  const navigateTo = (path) => {
    setCurrentPath(path);
  };

  // Navigate up one folder level
  const navigateUp = () => {
    if (currentPath.length > 1) {
      setCurrentPath(prev => prev.slice(0, prev.length - 1));
    }
  };

  // Filter questions according to current folder path + local search + filters
  const folderQuestions = useMemo(() => {
    let list = questions;

    // Filter by path
    const pathMap = {};
    for (const item of currentPath) {
      if (item.type !== 'root') {
        pathMap[item.type] = item.value;
      }
    }

    if (pathMap.subject) {
      list = list.filter(q => (q.subject || 'Môn khác') === pathMap.subject);
    }
    if (pathMap.grade) {
      list = list.filter(q => (q.grade_level ? `Khối ${q.grade_level}` : 'Khối khác') === pathMap.grade);
    }
    if (pathMap.chapter) {
      list = list.filter(q => (q.chapter || 'Chương chung') === pathMap.chapter);
    }
    if (pathMap.lesson) {
      list = list.filter(q => (q.lesson || 'Bài chung') === pathMap.lesson);
    }
    if (pathMap.topic) {
      list = list.filter(q => (q.topic || 'Dạng chung') === pathMap.topic);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(item => 
        (item.content || '').toLowerCase().includes(q) ||
        (item.code || '').toLowerCase().includes(q) ||
        (item.topic || '').toLowerCase().includes(q)
      );
    }

    // Filter by difficulty
    if (difficultyFilter !== 'all') {
      list = list.filter(item => item.difficulty === difficultyFilter);
    }

    // Filter by question type
    if (typeFilter !== 'all') {
      list = list.filter(item => item.question_type === typeFilter);
    }

    return list;
  }, [questions, currentPath, searchTerm, difficultyFilter, typeFilter]);

  // Check if all questions in current folder view are selected
  const allCurrentSelected = folderQuestions.length > 0 && folderQuestions.every(q => selectedQuestionIds.includes(q.id));
  const someCurrentSelected = !allCurrentSelected && folderQuestions.some(q => selectedQuestionIds.includes(q.id));

  // Toggle select all in current folder
  const handleToggleSelectAllInFolder = () => {
    const ids = folderQuestions.map(q => q.id);
    if (allCurrentSelected) {
      onSelectBatch?.(ids, false);
    } else {
      onSelectBatch?.(ids, true);
    }
  };

  // Selected breakdown
  const selectedBreakdown = useMemo(() => {
    const map = { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 };
    for (const q of questions) {
      if (selectedQuestionIds.includes(q.id)) {
        if (map[q.difficulty] !== undefined) {
          map[q.difficulty]++;
        }
      }
    }
    return map;
  }, [questions, selectedQuestionIds]);

  const currentFolderLabel = currentPath[currentPath.length - 1]?.label || 'Tất cả';

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col font-sans">
      {/* 1. WINDOW TOP TITLE BAR (Like File Explorer Title) */}
      <div className="bg-gray-100/90 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-pastel-purple/20 flex items-center justify-center text-pastel-purpleDark">
            <Laptop className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-extrabold text-gray-800 tracking-wide uppercase">
            Trình Duyệt Thư Mục Ngân Hàng Câu Hỏi
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-extrabold text-pastel-purpleDark bg-purple-50 px-3 py-1 rounded-full border border-purple-200 shadow-2xs">
            Đã chọn {selectedQuestionIds.length} câu hỏi
          </span>
        </div>
      </div>

      {/* 2. ADDRESS / BREADCRUMB BAR (Address Bar like Windows Explorer) */}
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={navigateUp}
          disabled={currentPath.length <= 1}
          className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-30 transition shrink-0 mr-1"
          title="Lên một thư mục cha (Alt + Up)"
        >
          <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
        </button>

        {/* Breadcrumb pills */}
        <div className="flex flex-wrap items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-gray-200 flex-1 min-w-[200px] shadow-2xs">
          <Laptop className="w-3.5 h-3.5 text-gray-400 shrink-0 mr-0.5" />
          {currentPath.map((crumb, idx) => {
            const isLast = idx === currentPath.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}
                <button
                  type="button"
                  onClick={() => navigateTo(currentPath.slice(0, idx + 1))}
                  className={`px-1.5 py-0.5 rounded-md transition truncate max-w-[180px] font-semibold ${
                    isLast 
                      ? 'bg-purple-50 text-pastel-purpleDark font-bold' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  title={crumb.label}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. TOOLBAR: Search, Filters, and Actions */}
      <div className="p-3 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm câu hỏi trong thư mục này..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-pastel-purple"
            />
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3 h-3 text-gray-400 shrink-0" />
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:border-pastel-purple"
            >
              <option value="all">Tất cả mức độ</option>
              <option value="NHAN_BIET">Nhận biết</option>
              <option value="THONG_HIEU">Thông hiểu</option>
              <option value="VAN_DUNG">Vận dụng</option>
              <option value="VAN_DUNG_CAO">Vận dụng cao</option>
            </select>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:border-pastel-purple"
          >
            <option value="all">Tất cả dạng câu</option>
            <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
            <option value="TRUE_FALSE">Đúng / Sai</option>
            <option value="SHORT_ANSWER">Điền từ</option>
            <option value="ESSAY">Tự luận</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          {/* Select all in folder */}
          {folderQuestions.length > 0 && (
            <button
              type="button"
              onClick={handleToggleSelectAllInFolder}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs ${
                allCurrentSelected
                  ? 'bg-purple-100 border-purple-300 text-pastel-purpleDark'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {allCurrentSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-pastel-purpleDark" />
              ) : (
                <Square className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span>{allCurrentSelected ? 'Bỏ chọn thư mục' : `Chọn tất cả (${folderQuestions.length})`}</span>
            </button>
          )}

          {/* Toggle View Options */}
          <button
            type="button"
            onClick={() => setViewDetail(!viewDetail)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
          >
            {viewDetail ? 'Thu gọn đáp án' : 'Xem đủ đáp án'}
          </button>
        </div>
      </div>

      {/* 4. MAIN EXPLORER SPLIT VIEW (Tree Left, Files Right) */}
      <div className="grid grid-cols-12 min-h-[520px] max-h-[640px] overflow-hidden">
        {/* LEFT PANE: FOLDER TREE (Navigation Pane) */}
        <div className="col-span-12 md:col-span-4 lg:col-span-4 border-r border-gray-200 bg-gray-50/60 overflow-y-auto p-2.5 space-y-1">
          <div className="flex items-center justify-between px-2 py-1 mb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Cây thư mục kiến thức</span>
            <div className="space-x-1">
              <button type="button" onClick={handleExpandAll} className="hover:text-pastel-purpleDark">Mở hết</button>
              <span>•</span>
              <button type="button" onClick={handleCollapseAll} className="hover:text-pastel-purpleDark">Thu gọn</button>
            </div>
          </div>

          {/* Root node */}
          <div
            onClick={() => navigateTo([{ type: 'root', value: 'root', label: 'Tất cả câu hỏi' }])}
            className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition text-xs ${
              currentPath.length === 1 && currentPath[0].type === 'root'
                ? 'bg-pastel-purple text-white font-bold shadow-2xs'
                : 'hover:bg-gray-100/80 text-gray-800 font-semibold'
            }`}
          >
            <Laptop className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">Tất cả câu hỏi</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              currentPath.length === 1 && currentPath[0].type === 'root' ? 'bg-white/20 text-white' : 'bg-gray-200/70 text-gray-600'
            }`}>
              {questions.length}
            </span>
          </div>

          {/* Subject Nodes */}
          {Object.entries(tree).map(([subjName, subjNode]) => {
            const sKey = `s:${subjName}`;
            const sOpen = expandedFolders.has(sKey);
            const isSubjActive = currentPath.length === 2 && currentPath[1].value === subjName;

            return (
              <div key={subjName} className="space-y-0.5">
                <div
                  className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-xl cursor-pointer transition text-xs group ${
                    isSubjActive 
                      ? 'bg-purple-100 text-pastel-purpleDark font-bold border border-purple-200' 
                      : 'hover:bg-gray-100/80 text-gray-800 font-semibold'
                  }`}
                  onClick={() => {
                    toggleFolder(sKey);
                    navigateTo([
                      { type: 'root', value: 'root', label: 'Tất cả câu hỏi' },
                      { type: 'subject', value: subjName, label: `Môn ${subjName}` }
                    ]);
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleFolder(sKey); }}
                    className="p-0.5 hover:bg-gray-200/60 rounded shrink-0"
                  >
                    {sOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                  </button>
                  {sOpen ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" /> : <Folder className="w-4 h-4 text-amber-500 shrink-0" />}
                  <span className="flex-1 truncate">Môn {subjName}</span>
                  <span className="text-[10px] bg-gray-200/60 text-gray-600 px-1.5 py-0.2 rounded-full font-bold">
                    {subjNode.count}
                  </span>
                </div>

                {/* Grade Nodes */}
                {sOpen && (
                  <div className="pl-4 space-y-0.5 border-l border-gray-200 ml-3">
                    {Object.entries(subjNode.children || {}).map(([gradeName, gradeNode]) => {
                      const gKey = `g:${subjName}/${gradeName}`;
                      const gOpen = expandedFolders.has(gKey);
                      const isGradeActive = currentPath.length === 3 && currentPath[2].value === gradeName;

                      return (
                        <div key={gradeName} className="space-y-0.5">
                          <div
                            className={`flex items-center space-x-1.5 px-2 py-1 rounded-xl cursor-pointer transition text-xs ${
                              isGradeActive 
                                ? 'bg-purple-100 text-pastel-purpleDark font-bold border border-purple-200' 
                                : 'hover:bg-gray-100/80 text-gray-700 font-medium'
                            }`}
                            onClick={() => {
                              toggleFolder(gKey);
                              navigateTo([
                                { type: 'root', value: 'root', label: 'Tất cả câu hỏi' },
                                { type: 'subject', value: subjName, label: `Môn ${subjName}` },
                                { type: 'grade', value: gradeName, label: gradeName }
                              ]);
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleFolder(gKey); }}
                              className="p-0.5 hover:bg-gray-200/60 rounded shrink-0"
                            >
                              {gOpen ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                            </button>
                            {gOpen ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            <span className="flex-1 truncate">{gradeName}</span>
                            <span className="text-[10px] text-gray-400 font-bold">{gradeNode.count}</span>
                          </div>

                          {/* Chapter Nodes */}
                          {gOpen && (
                            <div className="pl-4 space-y-0.5 border-l border-gray-200 ml-2.5">
                              {Object.entries(gradeNode.children || {}).map(([chapName, chapNode]) => {
                                const cKey = `c:${subjName}/${gradeName}/${chapName}`;
                                const cOpen = expandedFolders.has(cKey);
                                const isChapActive = currentPath.length === 4 && currentPath[3].value === chapName;

                                return (
                                  <div key={chapName} className="space-y-0.5">
                                    <div
                                      className={`flex items-center space-x-1.5 px-2 py-1 rounded-xl cursor-pointer transition text-xs ${
                                        isChapActive 
                                          ? 'bg-purple-100 text-pastel-purpleDark font-bold border border-purple-200' 
                                          : 'hover:bg-gray-100/80 text-gray-700 font-medium'
                                      }`}
                                      onClick={() => {
                                        toggleFolder(cKey);
                                        navigateTo([
                                          { type: 'root', value: 'root', label: 'Tất cả câu hỏi' },
                                          { type: 'subject', value: subjName, label: `Môn ${subjName}` },
                                          { type: 'grade', value: gradeName, label: gradeName },
                                          { type: 'chapter', value: chapName, label: chapName }
                                        ]);
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleFolder(cKey); }}
                                        className="p-0.5 hover:bg-gray-200/60 rounded shrink-0"
                                      >
                                        {cOpen ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                                      </button>
                                      {cOpen ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                      <span className="flex-1 truncate" title={chapName}>{chapName}</span>
                                      <span className="text-[10px] text-gray-400 font-bold">{chapNode.count}</span>
                                    </div>

                                    {/* Lesson Nodes */}
                                    {cOpen && (
                                      <div className="pl-4 space-y-0.5 border-l border-gray-200 ml-2">
                                        {Object.entries(chapNode.children || {}).map(([lesName, lesNode]) => {
                                          const isLesActive = currentPath.length === 5 && currentPath[4].value === lesName;

                                          return (
                                            <div
                                              key={lesName}
                                              onClick={() => {
                                                navigateTo([
                                                  { type: 'root', value: 'root', label: 'Tất cả câu hỏi' },
                                                  { type: 'subject', value: subjName, label: `Môn ${subjName}` },
                                                  { type: 'grade', value: gradeName, label: gradeName },
                                                  { type: 'chapter', value: chapName, label: chapName },
                                                  { type: 'lesson', value: lesName, label: lesName }
                                                ]);
                                              }}
                                              className={`flex items-center space-x-1.5 px-2 py-1 rounded-xl cursor-pointer transition text-[11px] ${
                                                isLesActive 
                                                  ? 'bg-purple-100 text-pastel-purpleDark font-bold border border-purple-200' 
                                                  : 'hover:bg-gray-100/80 text-gray-600'
                                              }`}
                                            >
                                              <BookOpen className="w-3 h-3 text-pastel-purple shrink-0" />
                                              <span className="flex-1 truncate" title={lesName}>{lesName}</span>
                                              <span className="text-[10px] text-gray-400 font-bold">{lesNode.count}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT PANE: FILES / QUESTIONS VIEW (Contents Pane) */}
        <div className="col-span-12 md:col-span-8 lg:col-span-8 bg-white overflow-y-auto p-4 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header info bar of right pane */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-bold text-gray-800">{currentFolderLabel}</span>
                <span className="text-xs text-gray-400 font-semibold">({folderQuestions.length} câu hỏi)</span>
              </div>

              {someCurrentSelected && (
                <span className="text-[11px] text-pastel-purpleDark font-bold bg-purple-50 px-2 py-0.5 rounded-md">
                  Đã chọn {folderQuestions.filter(q => selectedQuestionIds.includes(q.id)).length} / {folderQuestions.length}
                </span>
              )}
            </div>

            {/* Questions List */}
            {folderQuestions.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mx-auto">
                  <Folder className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-gray-600">Thư mục này hiện không có câu hỏi nào phù hợp</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Hãy thử chọn thư mục cha hoặc xóa bộ lọc tìm kiếm để xem câu hỏi khác.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {folderQuestions.map((q, idx) => {
                  const isSelected = selectedQuestionIds.includes(q.id);
                  const diffConfig = DIFFICULTY_MAP[q.difficulty] || { label: q.difficulty || 'Mức độ', color: 'bg-gray-50 text-gray-600 border-gray-200' };
                  const optList = Array.isArray(q.options)
                    ? q.options
                    : typeof q.options === 'string'
                    ? JSON.parse(q.options || '[]')
                    : [];

                  return (
                    <div
                      key={q.id}
                      onClick={() => onToggleSelect?.(q.id)}
                      className={`p-4 rounded-2xl border-2 transition cursor-pointer select-none space-y-2.5 ${
                        isSelected
                          ? 'border-pastel-purple bg-purple-50/40 shadow-xs ring-1 ring-pastel-purple/30'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/40'
                      }`}
                    >
                      {/* Top Header of Question Card */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect?.(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-gray-300 text-pastel-purple focus:ring-pastel-purple cursor-pointer"
                          />
                          <span className="font-extrabold text-gray-800 text-sm">Câu {idx + 1}</span>
                          <span className="text-gray-400 font-medium">#{q.id}</span>
                          <span className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] ${diffConfig.color}`}>
                            {diffConfig.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 font-semibold text-[10px]">
                            {TYPE_MAP[q.question_type] || q.question_type}
                          </span>
                        </div>

                        {isSelected && (
                          <span className="flex items-center space-x-1 text-xs font-bold text-pastel-purpleDark bg-purple-100 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" />
                            <span>Đã chọn</span>
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="text-sm text-gray-800 leading-relaxed font-normal pl-6">
                        <MathRenderer content={q.content || ''} />
                      </div>

                      {/* Options Preview */}
                      {viewDetail && optList.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 pt-1">
                          {optList.map((opt, optIdx) => {
                            const isCorrect = q.correct_option === optIdx;
                            return (
                              <div
                                key={optIdx}
                                className={`p-2 rounded-xl border text-xs font-medium flex items-start space-x-2 ${
                                  isCorrect
                                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-semibold'
                                    : 'bg-gray-50 border-gray-150 text-gray-700'
                                }`}
                              >
                                <span className="w-5 h-5 rounded-md bg-white border flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <div className="flex-1 pt-0.5">
                                  <MathRenderer content={opt} />
                                </div>
                                {isCorrect && (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Sub-questions for TRUE_FALSE */}
                      {viewDetail && Array.isArray(q.sub_questions) && q.sub_questions.length > 0 && (
                        <div className="space-y-1.5 pl-6 pt-1">
                          {q.sub_questions.map((sub, sIdx) => (
                            <div key={sIdx} className="p-2 rounded-xl bg-gray-50 border border-gray-150 text-xs flex items-center justify-between">
                              <span className="font-semibold text-gray-700 mr-2">
                                {String.fromCharCode(97 + sIdx)}) <MathRenderer content={sub.statement || ''} />
                              </span>
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                                sub.answer ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {sub.answer ? 'Đúng' : 'Sai'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Footer tags */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400 pl-6 pt-1">
                        <span>{q.subject}</span>
                        <span>• Lớp {q.grade_level}</span>
                        {q.chapter && <span>• {q.chapter}</span>}
                        {q.lesson && <span>• {q.lesson}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. BOTTOM STATUS BAR */}
      <div className="bg-gray-50/90 px-4 py-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 text-gray-600 font-semibold">
          <span>Đang hiển thị: {folderQuestions.length} câu</span>
          <span>•</span>
          <span>Tổng kho: {questions.length} câu</span>
        </div>

        {/* Selected count breakdown */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 px-3 py-1 bg-white border border-gray-200 rounded-xl shadow-2xs">
            <span className="font-extrabold text-pastel-purpleDark">Tổng chọn: {selectedQuestionIds.length} câu</span>
          </div>
          <div className="hidden sm:flex items-center space-x-1 text-[11px] font-bold">
            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700">NB: {selectedBreakdown.NHAN_BIET}</span>
            <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">TH: {selectedBreakdown.THONG_HIEU}</span>
            <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700">VD: {selectedBreakdown.VAN_DUNG}</span>
            <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700">VDC: {selectedBreakdown.VAN_DUNG_CAO}</span>
          </div>
          {selectedQuestionIds.length > 0 && (
            <button
              type="button"
              onClick={() => onSelectBatch?.(selectedQuestionIds, false)}
              className="text-[11px] font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Bỏ chọn tất cả
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
