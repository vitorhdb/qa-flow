/**
 * Utilitários para acesso ao sistema de arquivos do navegador
 * Usa File System Access API quando disponível, com fallback para input file
 */

export interface FileSystemFile {
  name: string;
  path: string;
  content: string;
  handle?: FileSystemFileHandle;
}

export interface FileSystemFolder {
  name: string;
  path: string;
  files: FileSystemFile[];
  subfolders: FileSystemFolder[];
}

/**
 * Verifica se a File System Access API está disponível
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Lê o conteúdo de um arquivo
 * Otimizado para arquivos grandes (>1MB)
 */
async function readFile(file: File, maxSize: number = 10 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    // Para arquivos muito grandes, limita o tamanho
    if (file.size > maxSize) {
      const blob = file.slice(0, maxSize);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content + '\n// ... (arquivo truncado, muito grande)');
      };
      reader.onerror = reject;
      reader.readAsText(blob);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    }
  });
}

/**
 * Lê recursivamente todos os arquivos de um diretório usando File System Access API
 * Otimizado para pastas grandes com processamento em lotes
 */
async function readDirectoryRecursive(
  handle: FileSystemDirectoryHandle,
  basePath: string = '',
  onProgress?: (count: number) => void,
  maxFiles: number = 10000
): Promise<FileSystemFile[]> {
  const files: FileSystemFile[] = [];
  let fileCount = 0;

  async function processEntry(entry: FileSystemHandle, currentPath: string): Promise<void> {
    if (fileCount >= maxFiles) {
      console.warn(`Limite de ${maxFiles} arquivos atingido. Parando leitura.`);
      return;
    }

    if (entry.kind === 'file') {
      try {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        
        // Ignora arquivos muito grandes (>10MB) ou binários
        if (file.size > 10 * 1024 * 1024) {
          console.warn(`Arquivo muito grande ignorado: ${currentPath} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
          return;
        }

        // Verifica se é arquivo de texto
        if (!file.type.startsWith('text/') && !file.name.match(/\.(js|ts|jsx|tsx|sql|pas|dpr|py|json|md|txt|css|html|xml|yaml|yml)$/i)) {
          return; // Ignora arquivos binários
        }

        const content = await readFile(file);
        files.push({
          name: entry.name,
          path: currentPath,
          content,
          handle: fileHandle,
        });
        
        fileCount++;
        if (onProgress && fileCount % 100 === 0) {
          onProgress(fileCount);
        }

        // Yield para UI não travar - mais frequente para muitos arquivos
        if (fileCount % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } catch (error) {
        console.warn(`Erro ao ler arquivo ${currentPath}:`, error);
      }
    } else if (entry.kind === 'directory') {
      const dirHandle = entry as FileSystemDirectoryHandle;
      for await (const [name, subEntry] of dirHandle.entries()) {
        const subPath = currentPath ? `${currentPath}/${name}` : name;
        await processEntry(subEntry, subPath);
        if (fileCount >= maxFiles) break;
      }
    }
  }

  for await (const [name, entry] of handle.entries()) {
    const currentPath = basePath ? `${basePath}/${name}` : name;
    await processEntry(entry, currentPath);
    if (fileCount >= maxFiles) break;
  }

  return files;
}

/**
 * Seleciona uma pasta usando File System Access API
 * Otimizado para pastas grandes
 */
export async function selectFolder(
  onProgress?: (count: number) => void
): Promise<FileSystemFile[] | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API não é suportada neste navegador. Use Chrome, Edge ou outro navegador compatível.');
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'read',
    });

    const files = await readDirectoryRecursive(handle, handle.name, onProgress);
    return files;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // Usuário cancelou a seleção
      return null;
    }
    throw error;
  }
}

/**
 * Converte arquivos de um input file para FileSystemFile[]
 * Otimizado para muitos arquivos
 */
export async function filesFromInput(
  files: FileList,
  onProgress?: (count: number) => void
): Promise<FileSystemFile[]> {
  const result: FileSystemFile[] = [];
  const fileArray = Array.from(files);
  const maxFiles = 10000;

  // Limita quantidade de arquivos
  const filesToProcess = fileArray.slice(0, maxFiles);
  if (fileArray.length > maxFiles) {
    console.warn(`Limite de ${maxFiles} arquivos. Processando apenas os primeiros.`);
  }

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    
    // Ignora arquivos muito grandes ou binários
    if (file.size > 10 * 1024 * 1024) {
      console.warn(`Arquivo muito grande ignorado: ${file.name}`);
      continue;
    }

    if (!file.type.startsWith('text/') && !file.name.match(/\.(js|ts|jsx|tsx|sql|pas|dpr|py|json|md|txt|css|html|xml|yaml|yml)$/i)) {
      continue;
    }

    try {
      const content = await readFile(file);
      result.push({
        name: file.name,
        path: file.webkitRelativePath || file.name,
        content,
      });

      if (onProgress && (i + 1) % 100 === 0) {
        onProgress(i + 1);
      }

      // Yield para UI não travar
      if ((i + 1) % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.warn(`Erro ao ler arquivo ${file.name}:`, error);
    }
  }

  return result;
}

/**
 * Converte FileSystemFile[] para estrutura de FileNode para exibição na árvore
 */
export function filesToFileTree(files: FileSystemFile[]): import('../components/folder/FileTree').FileNode[] {
  type FileNode = import('../components/folder/FileTree').FileNode;
  const tree: Record<string, FileNode & { _children?: Record<string, FileNode> }> = {};
  let fileIndex = 0;

  files.forEach((file) => {
    const parts = file.path.split('/').filter(p => p.length > 0);
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');

      if (!current[part]) {
        if (isLast) {
          // É um arquivo
          const node: FileNode = {
            id: `file-${fileIndex++}`,
            name: part,
            type: 'file',
            path: file.path,
            language: detectLanguage(file.name),
          };
          current[part] = node;
        } else {
          // É uma pasta
          const node: FileNode & { _children?: Record<string, FileNode> } = {
            id: `folder-${path}`,
            name: part,
            type: 'folder',
            path,
            children: [],
            _children: {},
          };
          current[part] = node;
        }
      }

      if (!isLast) {
        const node = current[part];
        if (node.type === 'folder') {
          if (!node._children) {
            node._children = {};
          }
          current = node._children!;
        }
      }
    }
  });

  // Converte o objeto tree em array de FileNode recursivamente
  function convertToArray(obj: Record<string, FileNode & { _children?: Record<string, FileNode> }>): FileNode[] {
    return Object.values(obj).map((node) => {
      const result: FileNode = {
        id: node.id,
        name: node.name,
        type: node.type,
        path: node.path,
        language: node.language,
      };

      if (node.type === 'folder' && node._children) {
        result.children = convertToArray(node._children);
      }

      return result;
    });
  }

  return convertToArray(tree);
}

/**
 * Detecta a linguagem do arquivo pela extensão
 */
function detectLanguage(filename: string): string {
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.sql')) return 'sql';
  if (filename.endsWith('.pas') || filename.endsWith('.dpr')) return 'delphi';
  if (filename.endsWith('.py')) return 'python';
  return 'unknown';
}
