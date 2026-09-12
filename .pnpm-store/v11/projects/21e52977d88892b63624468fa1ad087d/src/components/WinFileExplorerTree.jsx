import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Plus, Trash2 } from 'lucide-react';

export function WinFileExplorerTree({ treeData, onSelectCategory, onAddCategory, onDeleteCategory, onMoveCategory, onMoveQuestion, selectedCategory }) {
  const [expanded, setExpanded] = useState({});
  const [dragOver, setDragOver] = useState(null);

  const toggleExpand = (key, e) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const ActionButtons = ({ categoryPayload }) => (
    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition ml-auto">
        <button onClick={(e) => { e.stopPropagation(); onAddCategory(categoryPayload); }} className="p-1 hover:bg-emerald-100 text-emerald-600 rounded" title="Thêm thư mục con">
            <Plus className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDeleteCategory(categoryPayload); }} className="p-1 hover:bg-red-100 text-red-600 rounded" title="Xóa thư mục">
            <Trash2 className="w-3.5 h-3.5" />
        </button>
    </div>
  );

  const renderNode = (name, key, taxonomy, children, level) => {
    const isExpanded = expanded[key] !== false;
    const isFolder = typeof children === 'object' && children !== null && !Array.isArray(children);

    let currentTaxonomy = { ...taxonomy };
    if (level === 0) {
      currentTaxonomy = { subject: name };
    } else if (level === 1) {
      currentTaxonomy = { ...taxonomy, grade_level: parseInt(name.replace(/[^0-9]/g, '')) || 10 };
    } else if (level === 2) {
      currentTaxonomy = { ...taxonomy, chapter: name };
    } else if (level === 3) {
      currentTaxonomy = { ...taxonomy, lesson: name };
    } else if (level === 4) {
      currentTaxonomy = { ...taxonomy, topic: name };
    }

    const isSelected = JSON.stringify(selectedCategory) === JSON.stringify(currentTaxonomy);
    const isDragTarget = dragOver === key;

    const handleDragStart = (e) => {
      e.stopPropagation();
      const payload = JSON.stringify({ type: 'category', taxonomy: currentTaxonomy, level, key });
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
        if (data.type === 'category' && onMoveCategory) {
          if (JSON.stringify(data.taxonomy) === JSON.stringify(currentTaxonomy)) return;
          if (data.key && key.startsWith(data.key)) {
            alert('Không thể di chuyển thư mục vào chính nó hoặc thư mục con!');
            return;
          }
          onMoveCategory(data.taxonomy, currentTaxonomy);
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
                className={`flex items-center space-x-2 p-2 rounded-xl hover:bg-gray-50 cursor-pointer text-gray-800 text-xs ${level > 0 ? 'pl-'+(level*3) : ''} ${isSelected ? 'bg-purple-50 border border-purple-200' : ''} ${isDragTarget ? 'bg-emerald-50 border-2 border-dashed border-emerald-400' : ''}`}
            >
                <span className="text-gray-400">
                    {isFolder ? (isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : <div className="w-3.5"></div>}
                </span>
                {isFolder ? (isExpanded ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <Folder className="w-4 h-4 text-amber-500" />) : <FileText className="w-4 h-4 text-blue-500" />}
                <span className="flex-1 font-medium">{name}</span>
                <ActionButtons categoryPayload={currentTaxonomy} />
            </div>
            {isExpanded && isFolder && (
                <div className="pl-4 border-l border-gray-100 ml-3 space-y-1">
                    {Object.entries(children).map(([k, v]) => {
                        return renderNode(k, `${key}/${k}`, currentTaxonomy, v, level + 1);
                    })}
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm font-sans select-none text-sm">
      <div className="flex justify-between items-center pb-3 mb-3 border-b border-gray-100">
        <div className="font-bold text-gray-800 flex items-center space-x-2">
          <FolderOpen className="w-5 h-5 text-pastel-purpleDark" />
          <span>Trình quản lý Thư mục</span>
        </div>
      </div>
      <div className="space-y-1 overflow-y-auto max-h-[600px] pr-1">
        {Object.entries(treeData).map(([subject, grades]) => renderNode(
          subject, 
          subject, 
          { subject }, 
          grades, 
          0
        ))}
      </div>
    </div>
  );
}
