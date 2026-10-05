import React, { useState } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, FileText, Layers, Plus, Trash2 } from 'lucide-react';

const formatTitle = (name, fallback) => {
  if (!name || name === 'null' || name === 'undefined' || name === 'None') {
    return fallback;
  }
  return name;
};

export function FolderTree({ treeData, onSelectNode, selectedNodePath, onDropQuestion, onCreateSubFolder, onDeleteFolder }) {
  const [expanded, setExpanded] = useState({});
  const [dragOverPath, setDragOverPath] = useState(null);

  const toggle = (path) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleDragOver = (e, path) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(path);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverPath(null);
  };

  const handleDrop = (e, filterObj) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    const qId = e.dataTransfer.getData('text/plain');
    if (qId && onDropQuestion) {
      onDropQuestion(Number(qId), filterObj);
    }
  };

  const renderSubject = (subjName, grades) => {
    const subjPath = `subj:${subjName}`;
    const isOpen = expanded[subjPath];
    const isTarget = dragOverPath === subjPath;

    return (
      <div key={subjPath} className="mb-1 text-sm">
        <div
          onClick={() => { toggle(subjPath); onSelectNode({ subject: subjName }); }}
          onDragOver={(e) => handleDragOver(e, subjPath)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, { subject: subjName }, subjPath)}
          className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition select-none ${
            isTarget ? 'bg-amber-100 border-2 border-dashed border-amber-500' :
            selectedNodePath === subjPath ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            {isOpen ? <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-100" /> : <Folder className="w-4 h-4 text-amber-500 fill-amber-50" />}
            <span className="font-semibold">{subjName}</span>
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCreateSubFolder && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCreateSubFolder({ subject: subjName }, 'grade'); }}
                title="Thêm Khối"
                className="p-1.5 bg-white hover:bg-indigo-600 hover:text-white rounded-lg text-slate-600 shadow-2xs border border-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteFolder && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName }, subjName, grades._id); }}
                title="Xóa Thư mục"
                className="p-1.5 bg-white text-rose-600 hover:bg-rose-50 rounded-lg shadow-2xs border border-slate-200 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="pl-4 border-l border-slate-200 ml-3 space-y-0.5 mt-1">
            {Object.entries(grades).filter(([k]) => k !== '_id').map(([gradeName, chaps]) => renderGrade(subjName, gradeName, chaps))}
          </div>
        )}
      </div>
    );
  };

  const renderGrade = (subjName, gradeName, chaps) => {
    const gradeNum = parseInt(gradeName.replace('Khối ', '')) || 10;
    const gradePath = `subj:${subjName}|grade:${gradeName}`;
    const isOpen = expanded[gradePath];
    const isTarget = dragOverPath === gradePath;

    return (
      <div key={gradePath}>
        <div
          onClick={() => { toggle(gradePath); onSelectNode({ subject: subjName, grade_level: gradeNum }); }}
          onDragOver={(e) => handleDragOver(e, gradePath)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, { subject: subjName, grade_level: gradeNum }, gradePath)}
          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition select-none ${
            isTarget ? 'bg-blue-100 border-2 border-dashed border-blue-500' :
            selectedNodePath === gradePath ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <div className="flex items-center space-x-2">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-blue-500" /> : <Folder className="w-3.5 h-3.5 text-blue-400" />}
            <span>{gradeName}</span>
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCreateSubFolder && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCreateSubFolder({ subject: subjName, grade_level: gradeNum }, 'chapter'); }}
                title="Thêm Chương"
                className="p-1.5 bg-white hover:bg-indigo-600 hover:text-white rounded-lg text-slate-600 shadow-2xs border border-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteFolder && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName, grade_level: gradeNum }, gradeName, chaps._id); }}
                title="Xóa Thư mục"
                className="p-1.5 bg-white text-rose-600 hover:bg-rose-50 rounded-lg shadow-2xs border border-slate-200 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="pl-4 border-l border-slate-200 ml-3 space-y-0.5 mt-0.5">
            {Object.entries(chaps).filter(([k]) => k !== '_id').map(([chapName, lessons]) => renderChap(subjName, gradeNum, gradeName, chapName, lessons))}
          </div>
        )}
      </div>
    );
  };

  const renderChap = (subjName, gradeNum, gradeName, chapName, lessons) => {
    const cleanChapName = formatTitle(chapName, 'Chương chung');
    const chapPath = `subj:${subjName}|grade:${gradeName}|chap:${cleanChapName}`;
    const isOpen = expanded[chapPath];
    const isTarget = dragOverPath === chapPath;

    return (
      <div key={chapPath}>
        <div
          onClick={() => { toggle(chapPath); onSelectNode({ subject: subjName, grade_level: gradeNum, chapter: cleanChapName }); }}
          onDragOver={(e) => handleDragOver(e, chapPath)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, { subject: subjName, grade_level: gradeNum, chapter: cleanChapName }, chapPath)}
          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition select-none ${
            isTarget ? 'bg-emerald-100 border-2 border-dashed border-emerald-500' :
            selectedNodePath === chapPath ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <div className="flex items-center space-x-2 truncate">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-emerald-500" /> : <Folder className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="truncate max-w-[120px]">{cleanChapName}</span>
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCreateSubFolder && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCreateSubFolder({ subject: subjName, grade_level: gradeNum, chapter: cleanChapName }, 'lesson'); }}
                title="Thêm Bài"
                className="p-1.5 bg-white hover:bg-indigo-600 hover:text-white rounded-lg text-slate-600 shadow-2xs border border-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteFolder && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName, grade_level: gradeNum, chapter: cleanChapName }, cleanChapName, lessons._id); }}
                title="Xóa Thư mục"
                className="p-1.5 bg-white text-rose-600 hover:bg-rose-50 rounded-lg shadow-2xs border border-slate-200 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="pl-4 border-l border-slate-200 ml-3 space-y-0.5 mt-0.5">
            {Object.entries(lessons).filter(([k]) => k !== '_id').map(([lessName, topics]) => renderLesson(subjName, gradeNum, gradeName, cleanChapName, lessName, topics))}
          </div>
        )}
      </div>
    );
  };

  const renderLesson = (subjName, gradeNum, gradeName, chapName, lessName, topics) => {
    const cleanLessName = formatTitle(lessName, 'Bài chung');
    const lessPath = `subj:${subjName}|grade:${gradeName}|chap:${chapName}|less:${cleanLessName}`;
    const isOpen = expanded[lessPath];
    const isTarget = dragOverPath === lessPath;

    return (
      <div key={lessPath}>
        <div
          onClick={() => { toggle(lessPath); onSelectNode({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: cleanLessName }); }}
          onDragOver={(e) => handleDragOver(e, lessPath)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, { subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: cleanLessName }, lessPath)}
          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition select-none ${
            isTarget ? 'bg-indigo-100 border-2 border-dashed border-indigo-500' :
            selectedNodePath === lessPath ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <div className="flex items-center space-x-2 truncate">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span className="truncate max-w-[110px]">{cleanLessName}</span>
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCreateSubFolder && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCreateSubFolder({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: cleanLessName }, 'topic'); }}
                title="Thêm Dạng"
                className="p-1.5 bg-white hover:bg-indigo-600 hover:text-white rounded-lg text-slate-600 shadow-2xs border border-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteFolder && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: cleanLessName }, cleanLessName, topics._id); }}
                title="Xóa Thư mục"
                className="p-1.5 bg-white text-rose-600 hover:bg-rose-50 rounded-lg shadow-2xs border border-slate-200 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="pl-4 border-l border-slate-200 ml-3 space-y-0.5 mt-0.5">
            {Object.entries(topics).filter(([k]) => k !== '_id').map(([topName, item]) => {
              const cleanTopName = formatTitle(topName, 'Dạng chung');
              const topPath = `subj:${subjName}|grade:${gradeName}|chap:${chapName}|less:${cleanLessName}|top:${cleanTopName}`;
              const isTopTarget = dragOverPath === topPath;
              const count = typeof item === 'object' ? item.count : item;
              const topId = typeof item === 'object' ? item._id : null;

              return (
                <div
                  key={topPath}
                  onClick={() => onSelectNode({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: cleanLessName, topic: cleanTopName })}
                  onDragOver={(e) => handleDragOver(e, topPath)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, { subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: cleanLessName, topic: cleanTopName }, topPath)}
                  className={`group flex items-center justify-between px-2.5 py-1 rounded-lg cursor-pointer transition select-none ${
                    isTopTarget ? 'bg-indigo-100 border-2 border-dashed border-indigo-500' :
                    selectedNodePath === topPath ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span className="truncate max-w-[120px] text-xs">{cleanTopName}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600 tabular-nums font-semibold">{count}</span>
                    {onDeleteFolder && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: cleanLessName, topic: cleanTopName }, cleanTopName, topId); }}
                        title="Xóa Thư mục"
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs h-[calc(100vh-140px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/80">
        <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
          <Folder className="w-4 h-4 text-indigo-600" />
          <span>Thư mục kiến thức</span>
        </h3>
        <button
          type="button"
          onClick={() => onSelectNode({})}
          className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
        >
          Tất cả
        </button>
      </div>

      {Object.keys(treeData).length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-8">Chưa có dữ liệu thư mục</div>
      ) : (
        Object.entries(treeData).map(([subjName, grades]) => renderSubject(subjName, grades))
      )}
    </div>
  );
}
