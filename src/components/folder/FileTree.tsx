import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  path: string;
  language?: string;
}

interface FileTreeProps {
  nodes: FileNode[];
  selectedFiles: Set<string>;
  onSelectionChange: (files: Set<string>) => void;
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  selectedFiles: Set<string>;
  onToggle: (path: string, isFolder: boolean, children?: FileNode[]) => void;
}

function getAllFilePaths(node: FileNode): string[] {
  if (node.type === 'file') return [node.path];
  return node.children?.flatMap(getAllFilePaths) || [];
}

function TreeNode({ node, level, selectedFiles, onToggle }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  
  const isFolder = node.type === 'folder';
  const allChildPaths = getAllFilePaths(node);
  const isSelected = node.type === 'file' 
    ? selectedFiles.has(node.path)
    : allChildPaths.every(p => selectedFiles.has(p));
  const isPartiallySelected = isFolder && 
    !isSelected && 
    allChildPaths.some(p => selectedFiles.has(p));

  const handleToggle = () => {
    onToggle(node.path, isFolder, node.children);
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.tsx')) {
      return <File className="h-4 w-4 text-yellow-500" />;
    }
    if (name.endsWith('.sql')) {
      return <File className="h-4 w-4 text-blue-500" />;
    }
    if (name.endsWith('.pas')) {
      return <File className="h-4 w-4 text-orange-500" />;
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors hover:bg-secondary/50',
          isSelected && 'bg-primary/10'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {isFolder ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-secondary rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleToggle}
          className={cn(isPartiallySelected && 'opacity-50')}
        />
        
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 text-primary" />
          ) : (
            <Folder className="h-4 w-4 text-primary" />
          )
        ) : (
          getFileIcon(node.name)
        )}
        
        <span className="text-sm truncate">{node.name}</span>
      </div>
      
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedFiles={selectedFiles}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ nodes, selectedFiles, onSelectionChange }: FileTreeProps) {
  const handleToggle = (path: string, isFolder: boolean, children?: FileNode[]) => {
    const newSelection = new Set(selectedFiles);
    
    if (isFolder && children) {
      const allPaths = children.flatMap(getAllFilePaths);
      const allSelected = allPaths.every(p => newSelection.has(p));
      
      if (allSelected) {
        allPaths.forEach(p => newSelection.delete(p));
      } else {
        allPaths.forEach(p => newSelection.add(p));
      }
    } else {
      if (newSelection.has(path)) {
        newSelection.delete(path);
      } else {
        newSelection.add(path);
      }
    }
    
    onSelectionChange(newSelection);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2 max-h-[400px] overflow-auto">
      {nodes.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          selectedFiles={selectedFiles}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
