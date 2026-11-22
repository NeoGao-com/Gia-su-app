import React, { useState } from 'react';
import { 
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText, 
  Plus, Trash2, X, GitMerge, AlertTriangle 
} from 'lucide-react';
import { Modal } from './Modal';

export const countQuestionsInTree = (node) => {
  if (typeof node === 'number') return node;
  if (!node || typeof node !== 'object') return 0;
  let total = 0;
  for (const k of Object.keys(node)) {
    total += countQuestionsInTree(node[k]);
  }
  return total;
};

export const getSiblings = (treeData, taxonomy, level, currentName) => {
  if (!treeData || !taxonomy || level < 2) return [];
  const subjectObj = treeData[taxonomy.subject];
  if (!subjectObj || typeof subjectObj !== 'object') return [];

  // Match grade level flexibly
  const gradeKey = Object.keys(subjectObj).find((k) => {
    const num = parseInt(k.replace(/[^0-9]/g, ''), 10);
    return num === Number(taxonomy.grade_level);
  }) || Object.keys(subjectObj)[0];

  if (!gradeKey) return [];
  const gradeObj = subjectObj[gradeKey];
  if (!gradeObj || typeof gradeObj !== 'object') return [];

  if (level === 2) {
    // Siblings are other chapters in this grade
    return Object.keys(gradeObj)
      .filter((k) => k !== currentName)
      .map((k) => ({
        name: k,
        taxonomy: {
          subject: taxonomy.subject,
          grade_level: taxonomy.grade_level,
          chapter: k,
        },
        count: countQuestionsInTree(gradeObj[k]),
      }));
  }

  if (level === 3) {
    // Siblings are other lessons in this chapter
    const chapterObj = gradeObj[taxonomy.chapter];
    if (!chapterObj || typeof chapterObj !== 'object') return [];
    return Object.keys(chapterObj)
      .filter((k) => k !== currentName)
      .map((k) => ({
        name: k,
        taxonomy: {
          subject: taxonomy.subject,
          grade_level: taxonomy.grade_level,
          chapter: taxonomy.chapter,
          lesson: k,
        },
        count: countQuestionsInTree(chapterObj[k]),
      }));
  }

  if (level === 4) {
    // Siblings are other topics in this lesson
    const chapterObj = gradeObj[taxonomy.chapter];
    if (!chapterObj || typeof chapterObj !== 'object') return [];
    const lessonObj = chapterObj[taxonomy.lesson];
    if (!lessonObj || typeof lessonObj !== 'object') return [];
    return Object.keys(lessonObj)
      .filter((k) => k !== currentName)
      .map((k) => ({
        name: k,
        taxonomy: {
          subject: taxonomy.subject,
          grade_level: taxonomy.grade_level,
          chapter: taxonomy.chapter,
          lesson: taxonomy.lesson,
          topic: k,
        },
        count: countQuestionsInTree(lessonObj[k]),
      }));
  }

  return [];
};

export function WinFileExplorerTree({ 
  treeData, 
  onSelectCategory, 
  onAddCategory, 
  onDeleteCategory, 
  onMoveCategory, 
  onMergeCategory,
  onMoveQuestion, 
  selectedCategory 
}) {
  const [expanded, setExpanded] = useState({});
  const [dragOver, setDragOver] = useState(null);

  // Merge Confirm Modal State
  const [mergeModalState, setMergeModalState] = useState({
    isOpen: false,
    sourceName: '',
    sourceTaxonomy: null,
    sourceCount: 0,
    targetName: '',
    targetTaxonomy: null,
    targetCount: 0,
    siblings: [],
    isDrag: false,
  });

  const toggleExpand = (key, e) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenMergeModal = (categoryPayload, level, name, count) => {
    const siblings = getSiblings(treeData, categoryPayload, level, name);
    const initialTarget = siblings.length > 0 ? siblings[0] : null;
    setMergeModalState({
      isOpen: true,
      sourceName: name,
      sourceTaxonomy: categoryPayload,
      sourceCount: count,
      targetName: initialTarget ? initialTarget.name : '',
      targetTaxonomy: initialTarget ? initialTarget.taxonomy : null,
      targetCount: initialTarget ? initialTarget.count : 0,
      siblings,
      isDrag: false,
    });
  };

  const handleTargetSiblingChange = (siblingName) => {
    const selected = mergeModalState.siblings.find((s) => s.name === siblingName);
    if (selected) {
      setMergeModalState((prev) => ({
        ...prev,
        targetName: selected.name,
        targetTaxonomy: selected.taxonomy,
        targetCount: selected.count,
      }));
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergeModalState.sourceTaxonomy || !mergeModalState.targetTaxonomy) return;
    const source = mergeModalState.sourceTaxonomy;
    const target = mergeModalState.targetTaxonomy;
    setMergeModalState((prev) => ({ ...prev, isOpen: false }));
    if (onMergeCategory) {
      await onMergeCategory(source, target);
    } else if (onMoveCategory) {
      await onMoveCategory(source, target);
    }
  };

  const ActionButtons = ({ categoryPayload, level, name, childrenNode }) => {
    const canMerge = level >= 2;
    const count = countQuestionsInTree(childrenNode);

    return (
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition ml-auto">
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddCategory(categoryPayload); }} 
          className="p-1 hover:bg-emerald-100 text-emerald-600 rounded transition" 
          title="Thêm thư mục con"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {canMerge && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenMergeModal(categoryPayload, level, name, count);
            }}
            className="p-1 hover:bg-indigo-100 text-indigo-600 rounded transition"
            title="Gộp thư mục"
          >
            <GitMerge className="w-3.5 h-3.5" />
          </button>
        )}

        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeleteCategory(categoryPayload); }} 
          className="p-1 hover:bg-red-100 text-red-600 rounded transition" 
          title="Xóa thư mục và câu hỏi bên trong"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const renderNode = (name, key, taxonomy, children, level) => {
    const isExpanded = expanded[key] !== false;
    const isFolder = typeof children === 'object' && children !== null && !Array.isArray(children);

    let currentTaxonomy = { ...taxonomy };
    if (level === 0) {
      currentTaxonomy = { subject: name };
    } else if (level === 1) {
      currentTaxonomy = { ...taxonomy, grade_level: parseInt(name.replace(/[^0-9]/g, ''), 10) || 10 };
    } else if (level === 2) {
      currentTaxonomy = { ...taxonomy, chapter: name };
    } else if (level === 3) {
      currentTaxonomy = { ...taxonomy, lesson: name };
    } else if (level === 4) {
      currentTaxonomy = { ...taxonomy, topic: name };
    }

    const isSelected = selectedCategory && JSON.stringify(selectedCategory) === JSON.stringify(currentTaxonomy);
    const isDragTarget = dragOver === key;
    const nodeCount = countQuestionsInTree(children);

    const handleDragStart = (e) => {
      e.stopPropagation();
      const payload = JSON.stringify({ 
        type: 'category', 
        taxonomy: currentTaxonomy, 
        level, 
        name,
        count: nodeCount,
        key 
      });
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragOver !== key) setDragOver(key);
      e.dataTransfer.dropEffect = 'move';
    };

    const handleDragLeave = (e) => {
      e.stopPropagation();
      if (dragOver === key) setDragOver(null);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(null);
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (!data) return;

        if (data.type === 'category') {
          // Cannot drop on itself
          if (data.key === key || JSON.stringify(data.taxonomy) === JSON.stringify(currentTaxonomy)) {
            return;
          }
          // Cannot drop into its own descendant
          if (data.key && key.startsWith(data.key + '/')) {
            alert('Không thể di chuyển thư mục vào chính nó hoặc thư mục con!');
            return;
          }

          // Case 1: Same level -> MERGE action
          if (data.level === level) {
            if (level < 2) {
              alert('Không thể gộp toàn bộ Môn học hoặc Khối lớp!');
              return;
            }
            // Trigger Confirm Modal for MERGE
            setMergeModalState({
              isOpen: true,
              sourceName: data.name,
              sourceTaxonomy: data.taxonomy,
              sourceCount: data.count || 0,
              targetName: name,
              targetTaxonomy: currentTaxonomy,
              targetCount: nodeCount,
              siblings: [],
              isDrag: true,
            });
            return;
          }

          // Case 2: Child to parent -> MOVE action
          if (data.level === level + 1) {
            let moveTargetTaxonomy = { ...currentTaxonomy };
            if (data.level === 3) {
              // Bài -> Chương
              moveTargetTaxonomy = {
                ...currentTaxonomy,
                lesson: data.taxonomy.lesson || data.name
              };
            } else if (data.level === 4) {
              // Dạng -> Bài
              moveTargetTaxonomy = {
                ...currentTaxonomy,
                topic: data.taxonomy.topic || data.name
              };
            } else if (data.level === 2) {
              // Chương -> Khối
              moveTargetTaxonomy = {
                ...currentTaxonomy,
                chapter: data.taxonomy.chapter || data.name
              };
            }

            if (onMoveCategory) {
              onMoveCategory(data.taxonomy, moveTargetTaxonomy);
            }
            return;
          }

          // Case 3: Parent to child
          if (data.level < level) {
            alert('Không thể di chuyển thư mục cấp trên vào thư mục cấp dưới!');
            return;
          }

          // Case 4: Skipping parent levels
          if (data.level > level + 1) {
            alert('Không thể di chuyển vượt cấp. Vui lòng di chuyển vào đúng thư mục cha (ví dụ: Bài vào Chương)!');
            return;
          }
        } else if (data.type === 'question' && onMoveQuestion) {
          onMoveQuestion(data.questionId, currentTaxonomy);
        }
      } catch (err) {
        console.error('Drop parse error:', err);
      }
    };

    return (
      <div key={key} className="group">
        <div
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={(e) => {
            if (isFolder) toggleExpand(key, e);
            onSelectCategory(currentTaxonomy);
          }}
          style={{ paddingLeft: `${level * 14 + 8}px` }}
          className={`flex items-center space-x-2 py-2 pr-2 rounded-xl hover:bg-slate-50 cursor-pointer text-slate-800 text-xs transition ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : ''} ${isDragTarget ? 'bg-emerald-50 border-2 border-dashed border-emerald-400' : ''}`}
        >
          <span className="text-slate-400">
            {isFolder ? (isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : <div className="w-3.5"></div>}
          </span>
          {isFolder ? (isExpanded ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" /> : <Folder className="w-4 h-4 text-amber-500 shrink-0" />) : <FileText className="w-4 h-4 text-indigo-500 shrink-0" />}
          <span className="flex-1 truncate">{name}</span>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0 tabular-nums">
            {nodeCount} câu
          </span>
          <ActionButtons 
            categoryPayload={currentTaxonomy} 
            level={level} 
            name={name} 
            childrenNode={children} 
          />
        </div>
        {isExpanded && isFolder && (
          <div className="border-l border-slate-200 ml-3 space-y-1">
            {Object.entries(children).map(([k, v]) => {
              return renderNode(k, `${key}/${k}`, currentTaxonomy, v, level + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs font-sans select-none text-sm h-full flex flex-col min-h-0">
      <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-200/80 shrink-0">
        <div className="font-bold text-slate-800 flex items-center space-x-2">
          <FolderOpen className="w-5 h-5 text-indigo-600" />
          <span>Cây danh mục kiến thức</span>
        </div>
        {selectedCategory && (
          <button
            onClick={() => onSelectCategory(null)}
            className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
            title="Bỏ lọc, xem tất cả câu hỏi"
          >
            <X className="w-3 h-3" />
            <span>Bỏ lọc</span>
          </button>
        )}
      </div>
      <div className="space-y-1 overflow-y-auto flex-1 min-h-0 max-h-[500px] lg:max-h-none overscroll-contain pr-1">
        {Object.keys(treeData || {}).length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">Chưa có danh mục nào.</div>
        ) : (
          Object.entries(treeData).map(([subject, grades]) => renderNode(
            subject, 
            subject, 
            { subject }, 
            grades, 
            0
          ))
        )}
      </div>

      {/* Confirm Modal for Merge Actions */}
      <Modal
        isOpen={mergeModalState.isOpen}
        onClose={() => setMergeModalState((prev) => ({ ...prev, isOpen: false }))}
        title="Xác nhận gộp thư mục"
        size="md"
      >
        <div className="space-y-4 py-1 text-slate-800">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Hành động gộp dữ liệu không thể hoàn tác!</p>
              <p className="mt-0.5 text-amber-700">
                Toàn bộ câu hỏi trong thư mục nguồn sẽ được chuyển sang thư mục đích. Thư mục nguồn sau đó sẽ được sáp nhập.
              </p>
            </div>
          </div>

          {/* Visual Source & Target Display */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            {/* Source Folder Card */}
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-rose-200/80 shadow-2xs">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                  <Folder className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500 block">Thư mục nguồn (chuyển đi)</span>
                  <span className="font-bold text-sm text-slate-800 truncate block">{mergeModalState.sourceName}</span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg shrink-0 border border-rose-200/60 tabular-nums">
                {mergeModalState.sourceCount} câu hỏi
              </span>
            </div>

            {/* Merge Arrow Badge */}
            <div className="flex items-center justify-center -my-1 text-indigo-500">
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs font-semibold">
                <GitMerge className="w-3.5 h-3.5 rotate-90" />
                <span>Gộp vào</span>
              </div>
            </div>

            {/* Target Folder Card / Dropdown */}
            {mergeModalState.isDrag ? (
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-200/80 shadow-2xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 block">Thư mục đích (nhận câu hỏi)</span>
                    <span className="font-bold text-sm text-slate-800 truncate block">{mergeModalState.targetName}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg shrink-0 border border-emerald-200/60 tabular-nums">
                  {mergeModalState.targetCount} câu hiện có
                </span>
              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl border border-indigo-200/80 shadow-2xs space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 block">
                  Chọn thư mục đích cùng cấp để gộp vào:
                </label>
                {mergeModalState.siblings.length === 0 ? (
                  <div className="text-xs text-rose-500 italic py-1">
                    Không có thư mục cùng cấp nào khác trong cùng nhánh để gộp vào.
                  </div>
                ) : (
                  <select
                    value={mergeModalState.targetName}
                    onChange={(e) => handleTargetSiblingChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium"
                  >
                    {mergeModalState.siblings.map((sib) => (
                      <option key={sib.name} value={sib.name}>
                        {sib.name} ({sib.count} câu hỏi)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Summary */}
          {mergeModalState.targetName && (
            <div className="text-xs text-slate-500 px-1">
              Sau khi gộp, thư mục <strong>"{mergeModalState.targetName}"</strong> sẽ có tổng cộng{' '}
              <strong className="text-indigo-600 font-bold">
                {(mergeModalState.sourceCount || 0) + (mergeModalState.targetCount || 0)}
              </strong>{' '}
              câu hỏi.
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end items-center space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setMergeModalState((prev) => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!mergeModalState.targetTaxonomy}
              onClick={handleConfirmMerge}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Xác nhận gộp</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
