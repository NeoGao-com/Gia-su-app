import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText, 
  Plus, Edit2, Trash2, File, Image, Code, Archive
} from 'lucide-react';

// Helper to get icon based on extension/type
function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return <Image className="w-4 h-4 text-purple-500" />;
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py'].includes(ext)) return <Code className="w-4 h-4 text-blue-500" />;
  if (['zip', 'rar', 'tar', 'gz'].includes(ext)) return <Archive className="w-4 h-4 text-amber-500" />;
  if (['txt', 'md', 'doc', 'docx'].includes(ext)) return <FileText className="w-4 h-4 text-gray-500" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

export function WinFileExplorer({ initialData, onSelectNode, onAddFolder, onAddFile, onRename, onDelete }) {
  const [data, setData] = useState(initialData || {
    name: 'This PC',
    isFolder: true,
    isOpen: true,
    children: [
      {
        id: '1',
        name: 'Documents',
        isFolder: true,
        isOpen: true,
        children: [
          { id: '1-1', name: 'Resume.docx', isFolder: false },
          { id: '1-2', name: 'Budget.xlsx', isFolder: false },
          { 
            id: '1-3', 
            name: 'Projects', 
            isFolder: true, 
            isOpen: false,
            children: [
              { id: '1-3-1', name: 'app.js', isFolder: false },
              { id: '1-3-2', name: 'styles.css', isFolder: false }
            ]
          }
        ]
      },
      {
        id: '2',
        name: 'Pictures',
        isFolder: true,
        isOpen: false,
        children: [
          { id: '2-1', name: 'vacation.jpg', isFolder: false },
          { id: '2-2', name: 'avatar.png', isFolder: false }
        ]
      },
      { id: '3', name: 'notes.txt', isFolder: false }
    ]
  });

  const [selectedId, setSelectedId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, node }
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const editInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const toggleFolder = (node, e) => {
    e?.stopPropagation();
    if (!node.isFolder) return;
    
    // Recursive update function
    const updateNode = (item) => {
      if (item === node || item.id === node.id) {
        return { ...item, isOpen: !item.isOpen };
      }
      if (item.children) {
        return { ...item, children: item.children.map(updateNode) };
      }
      return item;
    };

    setData(updateNode(data));
  };

  const handleSelect = (node, e) => {
    e.stopPropagation();
    setSelectedId(node.id);
    if (onSelectNode) onSelectNode(node);
  };

  const handleDoubleClick = (node, e) => {
    e.stopPropagation();
    if (node.isFolder) {
      toggleFolder(node);
    } else {
      alert(`Opening file: ${node.name}`);
    }
  };

  const handleContextMenu = (node, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(node.id);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node
    });
  };

  const startRename = (node, e) => {
    e?.stopPropagation();
    setEditingId(node.id);
    setEditName(node.name);
    setContextMenu(null);
  };

  const saveRename = (node) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    const updateNode = (item) => {
      if (item.id === node.id) {
        return { ...item, name: editName.trim() };
      }
      if (item.children) {
        return { ...item, children: item.children.map(updateNode) };
      }
      return item;
    };
    setData(updateNode(data));
    setEditingId(null);
    if (onRename) onRename(node, editName.trim());
  };

  const handleDelete = (node, e) => {
    e?.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${node.name}"?`)) return;

    const removeNode = (item) => {
      if (!item.children) return item;
      return {
        ...item,
        children: item.children
          .filter(child => child.id !== node.id)
          .map(removeNode)
      };
    };

    setData(removeNode(data));
    setContextMenu(null);
    if (onDelete) onDelete(node);
  };

  const handleAddSub = (parentNode, isFolder, e) => {
    e?.stopPropagation();
    const newName = prompt(isFolder ? 'Enter folder name:' : 'Enter file name:');
    if (!newName) return;

    const newNode = {
      id: Date.now().toString(),
      name: newName,
      isFolder,
      isOpen: isFolder,
      children: isFolder ? [] : undefined
    };

    const addRecursive = (item) => {
      if (item.id === parentNode.id) {
        return {
          ...item,
          isOpen: true,
          children: [...(item.children || []), newNode]
        };
      }
      if (item.children) {
        return { ...item, children: item.children.map(addRecursive) };
      }
      return item;
    };

    setData(addRecursive(data));
    setContextMenu(null);
    if (isFolder && onAddFolder) onAddFolder(parentNode, newNode);
    if (!isFolder && onAddFile) onAddFile(parentNode, newNode);
  };

  const renderNode = (node, depth = 0) => {
    const isSelected = selectedId === node.id;
    const isHovered = hoveredId === node.id;
    const isEditing = editingId === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={(e) => handleSelect(node, e)}
          onDoubleClick={(e) => handleDoubleClick(node, e)}
          onContextMenu={(e) => handleContextMenu(node, e)}
          onMouseEnter={() => setHoveredId(node.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-md cursor-pointer text-sm transition ${
            isSelected 
              ? 'bg-blue-100 text-blue-900 font-medium border border-blue-300' 
              : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2 truncate">
            {node.isFolder ? (
              <button 
                onClick={(e) => toggleFolder(node, e)}
                className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
              >
                {node.isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4" /> // Spacer for alignment
            )}

            {node.isFolder ? (
              node.isOpen ? (
                <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-100" />
              ) : (
                <Folder className="w-4 h-4 text-amber-500 fill-amber-50" />
              )
            ) : (
              getFileIcon(node.name)
            )}

            {isEditing ? (
              <input
                ref={editInputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => saveRename(node)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveRename(node);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="px-1 py-0.5 text-xs bg-white border border-blue-500 rounded outline-none"
              />
            ) : (
              <span className="truncate max-w-[180px]">{node.name}</span>
            )}
          </div>

          {/* Hover Action Menu */}
          {(isHovered || isSelected) && !isEditing && (
            <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100">
              {node.isFolder && (
                <>
                  <button
                    onClick={(e) => handleAddSub(node, true, e)}
                    title="New Subfolder"
                    className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-blue-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleAddSub(node, false, e)}
                    title="New File"
                    className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-blue-600"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => startRename(node, e)}
                title="Rename"
                className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-amber-600"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => handleDelete(node, e)}
                title="Delete"
                className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Children */}
        {node.isFolder && node.isOpen && node.children && node.children.length > 0 && (
          <div className="space-y-0.5">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-80 bg-white border border-gray-200 rounded-lg shadow-sm p-3 font-sans select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <FolderOpen className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">File Explorer</span>
        </div>
        <button
          onClick={(e) => handleAddSub(data, true, e)}
          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs font-medium flex items-center space-x-1 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Root Folder</span>
        </button>
      </div>

      <div className="overflow-y-auto max-h-[500px]">
        {renderNode(data, 0)}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.isFolder && (
            <>
              <button
                onClick={(e) => handleAddSub(contextMenu.node, true, e)}
                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-gray-700 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4 text-blue-500" />
                <span>New Subfolder</span>
              </button>
              <button
                onClick={(e) => handleAddSub(contextMenu.node, false, e)}
                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-gray-700 flex items-center space-x-2"
              >
                <FileText className="w-4 h-4 text-blue-500" />
                <span>New File</span>
              </button>
              <div className="my-1 border-t border-gray-100" />
            </>
          )}
          <button
            onClick={(e) => startRename(contextMenu.node, e)}
            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-gray-700 flex items-center space-x-2"
          >
            <Edit2 className="w-4 h-4 text-amber-500" />
            <span>Rename</span>
          </button>
          <button
            onClick={(e) => handleDelete(contextMenu.node, e)}
            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
