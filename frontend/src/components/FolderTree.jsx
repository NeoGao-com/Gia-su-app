import React, { useState } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, FileText, Layers, Plus, Trash2 } from 'lucide-react';

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
            selectedNodePath === subjPath ? 'bg-pastel-purpleLight text-pastel-purpleDark font-bold' : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            {isOpen ? <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-100" /> : <Folder className="w-4 h-4 text-amber-500 fill-amber-50" />}
            <span className="font-semibold">{subjName}</span>
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCreateSubFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreateSubFolder({ subject: subjName }, 'grade'); }}
                title="Thêm Khối"
                className="p-1.5 bg-white hover:bg-pastel-purple hover:text-white rounded-lg text-gray-600 shadow-xs border border-gray-100 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName }, subjName, grades._id); }}
                title="Xóa Thư mục"
                className="p-1.5 bg-white text-red-500 hover:bg-red-100 rounded-lg shadow-xs border border-gray-100 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="pl-4 border-l border-gray-100 ml-3 space-y-0.5 mt-1">
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
            selectedNodePath === gradePath ? 'bg-pastel-purpleLight text-pastel-purpleDark font-bold' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <div className="flex items-center space-x-2">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
            {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-blue-500" /> : <Folder className="w-3.5 h-3.5 text-blue-400" />}
            <span>{gradeName}</span>
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCreateSubFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreateSubFolder({ subject: subjName, grade_level: gradeNum }, 'chapter'); }}
                title="Thêm Chương"
                className="p-1.5 bg-white hover:bg-pastel-purple hover:text-white rounded-lg text-gray-600 shadow-xs border border-gray-100 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName, grade_level: gradeNum }, gradeName, chaps._id); }}
                title="Xóa Thư mục"
                className="p-1.5 bg-white text-red-500 hover:bg-red-100 rounded-lg shadow-xs border border-gray-100 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="pl-4 border-l border-gray-100 ml-3 space-y-0.5 mt-0.5">
            {Object.entries(chaps).filter(([k]) => k !== '_id').map(([chapName, lessons]) => renderChap(subjName, gradeNum, gradeName, chapName, lessons))}
          </div>
        )}
      </div>
    );
  };

  const renderChap = (subjName, gradeNum, gradeName, chapName, lessons) => {
    const chapPath = `subj:${subjName}|grade:${gradeName}|chap:${chapName}`;
    const isOpen = expanded[chapPath];
    const isTarget = dragOverPath === chapPath;

    return (
      <div key={chapPath}>
        <div
          onClick={() => { toggle(chapPath); onSelectNode({ subject: subjName, grade_level: gradeNum, chapter: chapName }); }}
          onDragOver={(e) => handleDragOver(e, chapPath)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, { subject: subjName, grade_level: gradeNum, chapter: chapName }, chapPath)}
          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition select-none ${
            isTarget ? 'bg-emerald-100 border-2 border-dashed border-emerald-500' :
            selectedNodePath === chapPath ? 'bg-pastel-purpleLight text-pastel-purpleDark font-bold' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <div className="flex items-center space-x-2 truncate">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
            {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-emerald-500" /> : <Folder className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="truncate max-w-[120px]">{chapName}</span>
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCreateSubFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreateSubFolder({ subject: subjName, grade_level: gradeNum, chapter: chapName }, 'lesson'); }}
                title="Thêm Bài"
                className="p-1.5 bg-white hover:bg-pastel-purple hover:text-white rounded-lg text-gray-600 shadow-xs border border-gray-100 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName, grade_level: gradeNum, chapter: chapName }, chapName, lessons._id); }}
                title="Xóa Thư mục"
                className="p-1.5 bg-white text-red-500 hover:bg-red-100 rounded-lg shadow-xs border border-gray-100 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="pl-4 border-l border-gray-100 ml-3 space-y-0.5 mt-0.5">
            {Object.entries(lessons).filter(([k]) => k !== '_id').map(([lessName, topics]) => renderLesson(subjName, gradeNum, gradeName, chapName, lessName, topics))}
          </div>
        )}
      </div>
    );
  };

  const renderLesson = (subjName, gradeNum, gradeName, chapName, lessName, topics) => {
    const lessPath = `subj:${subjName}|grade:${gradeName}|chap:${chapName}|less:${lessName}`;
    const isOpen = expanded[lessPath];
    const isTarget = dragOverPath === lessPath;

    return (
      <div key={lessPath}>
        <div
          onClick={() => { toggle(lessPath); onSelectNode({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: lessName }); }}
          onDragOver={(e) => handleDragOver(e, lessPath)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, { subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: lessName }, lessPath)}
          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition select-none ${
            isTarget ? 'bg-purple-100 border-2 border-dashed border-purple-500' :
            selectedNodePath === lessPath ? 'bg-pastel-purpleLight text-pastel-purpleDark font-bold' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <div className="flex items-center space-x-2 truncate">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span className="truncate max-w-[110px]">{lessName}</span>
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCreateSubFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreateSubFolder({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: lessName }, 'topic'); }}
                title="Thêm Dạng"
                className="p-1.5 bg-white hover:bg-pastel-purple hover:text-white rounded-lg text-gray-600 shadow-xs border border-gray-100 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: lessName }, lessName, topics._id); }}
                title="Xóa Thư mục"
                className="p-1.5 bg-white text-red-500 hover:bg-red-100 rounded-lg shadow-xs border border-gray-100 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="pl-4 border-l border-gray-100 ml-3 space-y-0.5 mt-0.5">
            {Object.entries(topics).filter(([k]) => k !== '_id').map(([topName, item]) => {
              const topPath = `subj:${subjName}|grade:${gradeName}|chap:${chapName}|less:${lessName}|top:${topName}`;
              const isTopTarget = dragOverPath === topPath;
              const count = typeof item === 'object' ? item.count : item;
              const topId = typeof item === 'object' ? item._id : null;

              return (
                <div
                  key={topPath}
                  onClick={() => onSelectNode({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: lessName, topic: topName })}
                  onDragOver={(e) => handleDragOver(e, topPath)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, { subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: lessName, topic: topName }, topPath)}
                  className={`group flex items-center justify-between px-2.5 py-1 rounded-lg cursor-pointer transition select-none ${
                    isTopTarget ? 'bg-indigo-100 border-2 border-dashed border-indigo-500' :
                    selectedNodePath === topPath ? 'bg-pastel-purpleLight text-pastel-purpleDark font-bold' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-3 h-3 text-gray-400" />
                    <span className="truncate max-w-[120px] text-xs">{topName}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-500">{count}</span>
                    {onDeleteFolder && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteFolder({ subject: subjName, grade_level: gradeNum, chapter: chapName, lesson: lessName, topic: topName }, topName, topId); }}
                        title="Xóa Thư mục"
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition opacity-0 group-hover:opacity-100"
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
    <div className="w-80 bg-white rounded-3xl border border-gray-100 p-4 shadow-sm h-[calc(100vh-140px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <h3 className="font-bold text-gray-800 text-sm flex items-center space-x-2">
          <Folder className="w-4 h-4 text-pastel-purpleDark" />
          <span>Thư mục kiến thức</span>
        </h3>
        <button
          onClick={() => onSelectNode({})}
          className="text-xs text-pastel-purpleDark hover:underline font-medium"
        >
          Tất cả
        </button>
      </div>

      {Object.keys(treeData).length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-8">Chưa có dữ liệu thư mục</div>
      ) : (
        Object.entries(treeData).map(([subjName, grades]) => renderSubject(subjName, grades))
      )}
    </div>
  );
}
