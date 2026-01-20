import { useState, useMemo, useRef } from 'react';
import { FolderOpen, Play, X, FileCode, AlertTriangle, Shield, CheckCircle, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileTree, FileNode } from './FileTree';
import { analyzeCode } from '@/lib/analyzer';
import { AnalysisResult, Finding } from '@/types/qa';
import { FindingsList } from '@/components/dashboard/FindingsList';
import { ExportButton } from '@/components/export/ExportButton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { selectFolder, filesFromInput, filesToFileTree, isFileSystemAccessSupported, type FileSystemFile } from '@/lib/file-system';

interface FolderAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FileResult {
  path: string;
  result: AnalysisResult;
}

function getAllFilePaths(nodes: FileNode[]): string[] {
  return nodes.flatMap(node => {
    if (node.type === 'file') return [node.path];
    return node.children ? getAllFilePaths(node.children) : [];
  });
}

export function FolderAnalysisModal({ open, onOpenChange }: FolderAnalysisModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [currentTab, setCurrentTab] = useState('select');
  const [projectStructure, setProjectStructure] = useState<FileNode[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allFilePaths = useMemo(() => getAllFilePaths(projectStructure), [projectStructure]);

  const handleSelectFolder = async () => {
    try {
      if (isFileSystemAccessSupported()) {
        const files = await selectFolder();
        if (!files || files.length === 0) {
          return;
        }

        // Converte para estrutura de árvore
        const tree = filesToFileTree(files);
        setProjectStructure(tree);

        // Cria mapa de conteúdos
        const contents: Record<string, string> = {};
        files.forEach(file => {
          contents[file.path] = file.content;
        });
        setFileContents(contents);

        // Define o nome da pasta selecionada
        if (files.length > 0) {
          const firstPath = files[0].path;
          const folderName = firstPath.split('/')[0];
          setSelectedFolderName(folderName);
        }

        toast.success(`${files.length} arquivo(s) carregado(s) com sucesso`);
      } else {
        // Fallback: usar input file
        fileInputRef.current?.click();
      }
    } catch (error: any) {
      if (error.message?.includes('não é suportada')) {
        toast.error('Seu navegador não suporta seleção de pasta. Use Chrome ou Edge, ou selecione arquivos manualmente.');
        fileInputRef.current?.click();
      } else if (error.name !== 'AbortError') {
        toast.error(`Erro ao selecionar pasta: ${error.message}`);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileSystemFiles = await filesFromInput(files);
      
      // Converte para estrutura de árvore
      const tree = filesToFileTree(fileSystemFiles);
      setProjectStructure(tree);

      // Cria mapa de conteúdos
      const contents: Record<string, string> = {};
      fileSystemFiles.forEach(file => {
        contents[file.path] = file.content;
      });
      setFileContents(contents);

      // Define o nome da pasta selecionada
      if (fileSystemFiles.length > 0) {
        const firstPath = fileSystemFiles[0].path;
        const folderName = firstPath.split('/')[0];
        setSelectedFolderName(folderName);
      }

      toast.success(`${fileSystemFiles.length} arquivo(s) carregado(s) com sucesso`);
    } catch (error: any) {
      toast.error(`Erro ao ler arquivos: ${error.message}`);
    }

    // Limpa o input para permitir selecionar os mesmos arquivos novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectAll = () => {
    setSelectedFiles(new Set(allFilePaths));
  };

  const handleClearSelection = () => {
    setSelectedFiles(new Set());
  };

  const handleAnalyze = async () => {
    if (selectedFiles.size === 0) {
      toast.error('Selecione pelo menos um arquivo para analisar');
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setFileResults([]);
    setCurrentTab('progress');

    const files = Array.from(selectedFiles);
    const results: FileResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const path = files[i];
      const content = fileContents[path] || '';
      
      // Simulate analysis delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const result = analyzeCode(content, path);
      results.push({ path, result });
      
      setProgress(((i + 1) / files.length) * 100);
    }

    setFileResults(results);
    setIsAnalyzing(false);
    setCurrentTab('results');
    
    const passedCount = results.filter(r => r.result.passed).length;
    if (passedCount === results.length) {
      toast.success(`Análise concluída - Todos os ${results.length} arquivos passaram!`);
    } else {
      toast.warning(`Análise concluída - ${passedCount}/${results.length} arquivos passaram`);
    }
  };

  // Aggregate results
  const aggregatedScores = useMemo(() => {
    if (fileResults.length === 0) return { risk: 0, quality: 0, security: 0, improvements: 0 };
    
    const totals = fileResults.reduce(
      (acc, { result }) => ({
        risk: acc.risk + result.scores.risk,
        quality: acc.quality + result.scores.quality,
        security: acc.security + result.scores.security,
        improvements: acc.improvements + result.scores.improvements,
      }),
      { risk: 0, quality: 0, security: 0, improvements: 0 }
    );

    return {
      risk: Math.round(totals.risk / fileResults.length),
      quality: Math.round(totals.quality / fileResults.length),
      security: Math.round(totals.security / fileResults.length),
      improvements: totals.improvements,
    };
  }, [fileResults]);

  const allFindings = useMemo(() => {
    return fileResults.flatMap(({ path, result }) =>
      result.findings.map(f => ({ ...f, id: `${path}-${f.id}`, path }))
    );
  }, [fileResults]);

  const passedCount = fileResults.filter(r => r.result.passed).length;
  const overallPassed = fileResults.length > 0 && passedCount === fileResults.length;

  // Create aggregated result for export
  const aggregatedResult: AnalysisResult | null = fileResults.length > 0 ? {
    id: `folder-${Date.now()}`,
    timestamp: new Date(),
    filename: `Folder Analysis (${fileResults.length} files)`,
    code: '',
    language: 'mixed',
    scores: aggregatedScores,
    findings: allFindings,
    passed: overallPassed,
  } : null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-status-passed';
    if (score >= 60) return 'text-status-warning';
    return 'text-risk-critical';
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setSelectedFiles(new Set());
      setFileResults([]);
      setProgress(0);
      setCurrentTab('select');
      setProjectStructure([]);
      setFileContents({});
      setSelectedFolderName('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Modo de validação por pasta
          </DialogTitle>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="select">Selecionar arquivos</TabsTrigger>
            <TabsTrigger value="progress" disabled={!isAnalyzing && fileResults.length === 0}>
              Progresso
            </TabsTrigger>
            <TabsTrigger value="results" disabled={fileResults.length === 0}>
              Resultados ({fileResults.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="mb-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium mb-1">Selecionar pasta do projeto</h4>
                  <p className="text-xs text-muted-foreground">
                    {selectedFolderName 
                      ? `Pasta selecionada: ${selectedFolderName}` 
                      : 'Escolha uma pasta do seu computador para analisar'}
                  </p>
                </div>
                <Button onClick={handleSelectFolder} variant="default">
                  <Upload className="mr-2 h-4 w-4" />
                  {projectStructure.length > 0 ? 'Trocar pasta' : 'Selecionar pasta'}
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                webkitdirectory=""
                directory=""
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />

              {projectStructure.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {selectedFiles.size} de {allFilePaths.length} arquivos selecionados
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                        Selecionar tudo
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                        Limpar
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex-1 min-h-0 overflow-auto">
              {projectStructure.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4 border-2 border-dashed border-border rounded-lg">
                  <FolderOpen className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <h4 className="text-sm font-medium mb-1">Nenhuma pasta selecionada</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Clique no botão acima para selecionar uma pasta do seu computador
                    </p>
                    {!isFileSystemAccessSupported() && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                        ⚠️ Seu navegador não suporta seleção direta de pasta. Use Chrome ou Edge para melhor experiência.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <FileTree
                  nodes={projectStructure}
                  selectedFiles={selectedFiles}
                  onSelectionChange={setSelectedFiles}
                />
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAnalyze} disabled={selectedFiles.size === 0}>
                <Play className="mr-2 h-4 w-4" />
                Analisar {selectedFiles.size} arquivos
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="progress" className="flex-1 flex flex-col items-center justify-center mt-4">
            <div className="w-full max-w-md space-y-6 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileCode className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Analisando arquivos...</h3>
                <p className="text-sm text-muted-foreground">
                  {Math.round(progress)}% concluído ({Math.round((progress / 100) * selectedFiles.size)} de {selectedFiles.size} arquivos)
                </p>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </TabsContent>

          <TabsContent value="results" className="flex-1 flex flex-col min-h-0 mt-4 overflow-auto">
            {/* Aggregated Summary */}
            <div className={cn(
              'rounded-xl border-2 p-4 mb-4',
              overallPassed 
                ? 'border-status-passed bg-status-passed/5' 
                : 'border-risk-critical bg-risk-critical/5'
            )}>
              <div className="flex items-center gap-3 mb-4">
                {overallPassed ? (
                  <CheckCircle className="h-6 w-6 text-status-passed" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-risk-critical" />
                )}
                <div>
                  <h3 className={cn(
                    'font-bold',
                    overallPassed ? 'text-status-passed' : 'text-risk-critical'
                  )}>
                    {overallPassed ? 'TODOS OS ARQUIVOS APROVADOS' : 'QUALITY GATE REPROVADO'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {passedCount} de {fileResults.length} arquivos aprovados
                  </p>
                </div>
                <div className="ml-auto">
                  <ExportButton result={aggregatedResult} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className={cn('text-2xl font-bold', getScoreColor(aggregatedScores.risk))}>
                    {aggregatedScores.risk}%
                  </div>
                  <div className="text-xs text-muted-foreground">Risco médio</div>
                </div>
                <div className="text-center">
                  <div className={cn('text-2xl font-bold', getScoreColor(aggregatedScores.quality))}>
                    {aggregatedScores.quality}%
                  </div>
                  <div className="text-xs text-muted-foreground">Qualidade média</div>
                </div>
                <div className="text-center">
                  <div className={cn('text-2xl font-bold', getScoreColor(aggregatedScores.security))}>
                    {aggregatedScores.security}%
                  </div>
                  <div className="text-xs text-muted-foreground">Segurança média</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {aggregatedScores.improvements}
                  </div>
                  <div className="text-xs text-muted-foreground">Total de problemas</div>
                </div>
              </div>
            </div>

            {/* File Results */}
            <div className="space-y-2 mb-4">
              <h4 className="font-medium text-sm text-muted-foreground">Resultados por arquivo</h4>
              <div className="grid gap-2">
                {fileResults.map(({ path, result }) => (
                  <div
                    key={path}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      result.passed ? 'border-status-passed/30 bg-status-passed/5' : 'border-risk-critical/30 bg-risk-critical/5'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {result.passed ? (
                        <CheckCircle className="h-4 w-4 text-status-passed" />
                      ) : (
                        <X className="h-4 w-4 text-risk-critical" />
                      )}
                      <span className="font-mono text-sm">{path}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={getScoreColor(result.scores.risk)}>
                        {result.scores.risk}%
                      </span>
                      <span className="text-muted-foreground">
                        {result.findings.length} problemas
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* All Findings */}
            {allFindings.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Todos os achados</h4>
                <FindingsList findings={allFindings} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
