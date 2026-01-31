import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Shield, Zap, TrendingUp, Play, RotateCcw, FolderOpen, Upload, CheckCircle, X, FileCode, Pause, Square, Sparkles, BarChart } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { QualityGate } from '@/components/dashboard/QualityGate';
import { CodeEditor } from '@/components/dashboard/CodeEditor';
import { FindingsList } from '@/components/dashboard/FindingsList';
import { ExportButton } from '@/components/export/ExportButton';
import { FileTree, FileNode } from '@/components/folder/FileTree';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { analyzeCode } from '@/lib/analyzer';
import { analyzeCodeWithAIEnhanced } from '@/lib/analyzer-enhanced';
import { buildFileRiskMatrixItems } from '@/lib/risk-matrix';
import { selectFolder, filesFromInput, filesToFileTree, isFileSystemAccessSupported, type FileSystemFile } from '@/lib/file-system';
import { db } from '@/lib/database';
import { AnalysisResult } from '@/types/qa';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BatchProcessor } from '@/lib/batch-processor';


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

// Tipos de arquivo suportados
const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.sql', '.pas', '.dpr', '.py'];

function isSupportedFile(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

export default function Index() {
  const navigate = useNavigate();
  const [aiEnabled, setAiEnabled] = useState(false);
  const [code, setCode] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Seleção de pasta
  const [projectStructure, setProjectStructure] = useState<FileNode[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');
  const [folderAnalysisResults, setFolderAnalysisResults] = useState<FileResult[]>([]);
  const [isAnalyzingFolder, setIsAnalyzingFolder] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [folderProgress, setFolderProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchProcessorRef = useRef<BatchProcessor<string, FileResult> | null>(null);

  const allFilePaths = useMemo(() => getAllFilePaths(projectStructure), [projectStructure]);
  const supportedFilePaths = useMemo(() => {
    const paths = getAllFilePaths(projectStructure);
    return paths.filter(path => {
      const filename = path.split('/').pop() || '';
      return isSupportedFile(filename);
    });
  }, [projectStructure]);

  const riskMatrixItems = useMemo(() => {
    const allResults: AnalysisResult[] = [];
    
    // Adiciona resultado de análise manual se existir
    if (analysisResult && analysisResult.filename) {
      allResults.push(analysisResult);
    }
    
    // Adiciona resultados de análise de pasta
    if (folderAnalysisResults.length > 0) {
      allResults.push(...folderAnalysisResults.map(fr => fr.result));
    }
    
    return buildFileRiskMatrixItems(allResults);
  }, [analysisResult, folderAnalysisResults]);

  const handleAnalyze = async () => {
    if (!code.trim()) {
      toast.error('Insira um código para analisar');
      return;
    }

    setIsAnalyzing(true);
    
    // Simulate analysis delay for UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsAnalyzing(true);
    try {
      // Usa análise com IA se disponível, senão usa análise estática
      const result = await analyzeCodeWithAIEnhanced(code);
      setAnalysisResult(result);
    } catch (error) {
      // Fallback para análise estática se IA falhar
      const result = analyzeCode(code);
      setAnalysisResult(result);
    } finally {
      setIsAnalyzing(false);
    }
    
    // Salva no banco de dados (inclui actionable e code quando vêm da IA)
    try {
      await db.saveAnalysis({
        id: result.id,
        timestamp: result.timestamp,
        filename: result.filename,
        language: result.language,
        scores: result.scores,
        findings: result.findings,
        passed: result.passed,
        ...(result.code !== undefined && { code: result.code }),
        ...((result as { actionable?: unknown }).actionable !== undefined && { actionable: (result as { actionable?: unknown }).actionable }),
      });
    } catch (error) {
      console.error('Erro ao salvar análise:', error);
    }
    
    if (result.passed) {
      toast.success('Análise concluída - Quality Gate aprovado!');
    } else {
      toast.warning('Análise concluída - Quality Gate reprovado');
    }
  };

  const handleReset = () => {
    setCode('');
    setAnalysisResult(null);
    toast.info('Análise limpa');
  };


  // Calcula scores agregados (análise manual ou pasta)
  const displayScores = useMemo(() => {
    if (folderAnalysisResults.length > 0) {
      // Agrega scores de todos os arquivos analisados
      const totals = folderAnalysisResults.reduce(
        (acc, { result }) => ({
          risk: acc.risk + result.scores.risk,
          quality: acc.quality + result.scores.quality,
          security: acc.security + result.scores.security,
          improvements: acc.improvements + result.scores.improvements,
        }),
        { risk: 0, quality: 0, security: 0, improvements: 0 }
      );
      
      return {
        risk: Math.round(totals.risk / folderAnalysisResults.length),
        quality: Math.round(totals.quality / folderAnalysisResults.length),
        security: Math.round(totals.security / folderAnalysisResults.length),
        improvements: totals.improvements,
      };
    }
    
    return analysisResult?.scores || { risk: 0, quality: 0, security: 0, improvements: 0 };
  }, [analysisResult, folderAnalysisResults]);

  const displayPassed = useMemo(() => {
    if (folderAnalysisResults.length > 0) {
      return folderAnalysisResults.every(({ result }) => result.passed);
    }
    return analysisResult?.passed ?? true;
  }, [analysisResult, folderAnalysisResults]);

  const handleOpenDetails = (tab: 'risk' | 'quality' | 'security' | 'improvements') => {
    // Se há resultados de pasta, cria um resultado agregado
    if (folderAnalysisResults.length > 0) {
      const aggregatedResult: AnalysisResult = {
        id: `folder-${Date.now()}`,
        timestamp: new Date(),
        filename: `Análise de Pasta (${folderAnalysisResults.length} arquivos)`,
        code: '',
        language: 'mixed',
        scores: displayScores,
        findings: folderAnalysisResults.flatMap(fr => 
          fr.result.findings.map(f => ({ ...f, id: `${fr.path}-${f.id}` }))
        ),
        passed: displayPassed,
      };
      
      navigate('/analise', {
        state: {
          analysisResult: aggregatedResult,
          initialTab: tab,
        },
      });
      return;
    }
    
    if (!analysisResult) return;
    navigate('/analise', {
      state: {
        analysisResult,
        initialTab: tab,
      },
    });
  };

  // Funções do modo pasta
  const handleSelectFolder = async () => {
    try {
      if (isFileSystemAccessSupported()) {
        const files = await selectFolder();
        if (!files || files.length === 0) {
          return;
        }

        const tree = filesToFileTree(files);
        setProjectStructure(tree);

        // Carrega conteúdos em lotes para não travar
        // Ajusta batch size baseado na quantidade de arquivos
        const contents: Record<string, string> = {};
        const batchSize = files.length > 5000 ? 50 : files.length > 1000 ? 100 : 200;
        
        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          batch.forEach(file => {
            contents[file.path] = file.content;
          });
          
          // Yield para UI - mais frequente para muitos arquivos
          if (i % 25 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        setFileContents(contents);

        if (files.length > 0) {
          const firstPath = files[0].path;
          const folderName = firstPath.split('/')[0];
          setSelectedFolderName(folderName);
        }

        toast.success(`${files.length} arquivo(s) carregado(s)`);
        
        // Limpa seleção ao carregar nova pasta
        setSelectedFiles(new Set());
      } else {
        fileInputRef.current?.click();
      }
    } catch (error: any) {
      if (error.message?.includes('não é suportada')) {
        toast.error('Seu navegador não suporta seleção de pasta. Use Chrome ou Edge.');
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
      let fileCount = 0;
      const fileSystemFiles = await filesFromInput(files, (count) => {
        fileCount = count;
        if (count % 500 === 0) {
          toast.info(`Carregando arquivos... ${count} encontrados`);
        }
      });
      
      toast.info(`Processando ${fileSystemFiles.length} arquivos...`);
      
      const tree = filesToFileTree(fileSystemFiles);
      setProjectStructure(tree);

      // Carrega conteúdos em lotes
      // Ajusta batch size baseado na quantidade de arquivos
      const contents: Record<string, string> = {};
      const batchSize = fileSystemFiles.length > 5000 ? 50 : fileSystemFiles.length > 1000 ? 100 : 200;
      
      for (let i = 0; i < fileSystemFiles.length; i += batchSize) {
        const batch = fileSystemFiles.slice(i, i + batchSize);
        batch.forEach(file => {
          contents[file.path] = file.content;
        });
        
        // Yield para UI - mais frequente para muitos arquivos
        if (i % 25 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      setFileContents(contents);

      if (fileSystemFiles.length > 0) {
        const firstPath = fileSystemFiles[0].path;
        const folderName = firstPath.split('/')[0];
        setSelectedFolderName(folderName);
      }

      toast.success(`${fileSystemFiles.length} arquivo(s) carregado(s)`);
      
      // Limpa seleção ao carregar nova pasta
      setSelectedFiles(new Set());
    } catch (error: any) {
      toast.error(`Erro ao ler arquivos: ${error.message}`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyzeFolder = async () => {
    const filesToAnalyze = Array.from(selectedFiles);

    if (filesToAnalyze.length === 0) {
      toast.error('Selecione pelo menos um arquivo para analisar');
      return;
    }

    setIsAnalyzingFolder(true);
    setIsPaused(false);
    setFolderProgress(0);
    setFolderAnalysisResults([]);
    setCurrentFileIndex(0);
    setTotalFiles(filesToAnalyze.length);

    // Cria processador em lotes
    // Ajusta batch size baseado na quantidade de arquivos
    const batchSize = filesToAnalyze.length > 1000 ? 10 : filesToAnalyze.length > 500 ? 15 : 20;
    const delay = filesToAnalyze.length > 1000 ? 30 : filesToAnalyze.length > 500 ? 20 : 10;
    
    const processor = new BatchProcessor<string, FileResult>(
      async (path: string, index: number) => {
        const content = fileContents[path] || '';
        // Usa análise com IA se disponível
        try {
          const result = await analyzeCodeWithAIEnhanced(content, path);
          return { path, result };
        } catch {
          // Fallback para análise estática
          const result = analyzeCode(content, path);
          return { path, result };
        }
      },
      {
        batchSize, // Ajusta dinamicamente
        delayBetweenBatches: delay, // Ajusta dinamicamente
        onProgress: (progress, current, total) => {
          setFolderProgress(progress);
          setCurrentFileIndex(current);
        },
        onPause: () => {
          setIsPaused(true);
          toast.info('Análise pausada');
        },
        onResume: () => {
          setIsPaused(false);
          toast.info('Análise retomada');
        },
        onCancel: () => {
          setIsAnalyzingFolder(false);
          setIsPaused(false);
          toast.warning('Análise cancelada');
        },
      }
    );

    batchProcessorRef.current = processor;

    try {
      const results = await processor.process(filesToAnalyze);

      if (!processor['isCancelled']) {
        setFolderAnalysisResults(results);
        
        // Salva cada análise no banco de dados em lotes
        try {
          const saveBatch = new BatchProcessor<FileResult, void>(
            async ({ result }) => {
              await db.saveAnalysis({
                id: result.id,
                timestamp: result.timestamp,
                filename: result.filename,
                language: result.language,
                scores: result.scores,
                findings: result.findings,
                passed: result.passed,
                ...(result.code !== undefined && { code: result.code }),
                ...((result as { actionable?: unknown }).actionable !== undefined && { actionable: (result as { actionable?: unknown }).actionable }),
              });
            },
            { batchSize: 50 }
          );
          await saveBatch.process(results);
        } catch (error) {
          console.error('Erro ao salvar análises:', error);
        }
        
        const passedCount = results.filter(r => r.result.passed).length;
        toast.success(`Análise concluída: ${passedCount}/${results.length} arquivos passaram`);
      }
    } catch (error) {
      console.error('Erro na análise:', error);
      toast.error('Erro ao analisar arquivos');
    } finally {
      setIsAnalyzingFolder(false);
      setIsPaused(false);
      batchProcessorRef.current = null;
    }
  };

  const handlePauseAnalysis = () => {
    if (batchProcessorRef.current) {
      if (isPaused) {
        batchProcessorRef.current.resume();
      } else {
        batchProcessorRef.current.pause();
      }
    }
  };

  const handleCancelAnalysis = () => {
    if (batchProcessorRef.current) {
      batchProcessorRef.current.cancel();
      setFolderAnalysisResults([]);
      setFolderProgress(0);
      setCurrentFileIndex(0);
      setTotalFiles(0);
    }
  };

  const handleSelectAll = () => {
    setSelectedFiles(new Set(supportedFilePaths));
  };

  const handleClearSelection = () => {
    setSelectedFiles(new Set());
  };

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={aiEnabled} onAiToggle={setAiEnabled} />
      
      <main className="container px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        {/* Quality Gate Banner */}
        {(analysisResult || folderAnalysisResults.length > 0) && (
          <div className="mb-6 sm:mb-8">
            <QualityGate 
              passed={displayPassed} 
              riskScore={displayScores.risk}
              securityScore={displayScores.security}
            />
          </div>
        )}

        {/* Metrics Cards */}
        <div className="mb-6 sm:mb-8 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Pontuação de Risco"
            value={displayScores.risk}
            subtitle="Nível geral de risco do código"
            icon={AlertTriangle}
            variant="risk"
            onClick={(analysisResult || folderAnalysisResults.length > 0) ? () => handleOpenDetails('risk') : undefined}
          />
          <MetricCard
            title="Pontuação de Qualidade"
            value={displayScores.quality}
            subtitle="Avaliação da qualidade do código"
            icon={TrendingUp}
            variant="quality"
            onClick={(analysisResult || folderAnalysisResults.length > 0) ? () => handleOpenDetails('quality') : undefined}
          />
          <MetricCard
            title="Pontuação de Segurança"
            value={displayScores.security}
            subtitle="Vulnerabilidades de segurança"
            icon={Shield}
            variant="security"
            onClick={(analysisResult || folderAnalysisResults.length > 0) ? () => handleOpenDetails('security') : undefined}
          />
          <MetricCard
            title="Melhorias"
            value={`${displayScores.improvements}`}
            subtitle="Sugestões de melhoria"
            icon={Zap}
            variant="improvements"
            onClick={(analysisResult || folderAnalysisResults.length > 0) ? () => handleOpenDetails('improvements') : undefined}
          />
        </div>

        {/* Analysis Section */}
        <div className="glass-panel p-4 sm:p-6">
          <Tabs defaultValue="manual" className="w-full">
            <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <TabsList className="bg-secondary/50 flex-wrap">
                  <TabsTrigger value="manual" className="text-xs sm:text-sm">Análise Manual</TabsTrigger>
                  <TabsTrigger value="folder" className="text-xs sm:text-sm">Selecionar Pasta</TabsTrigger>
                  <TabsTrigger value="results" disabled={!analysisResult && folderAnalysisResults.length === 0} className="text-xs sm:text-sm">
                    Resultados {analysisResult && `(${analysisResult.findings.length})`}
                    {folderAnalysisResults.length > 0 && ` (${folderAnalysisResults.length})`}
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
                <ExportButton 
                  result={
                    folderAnalysisResults.length > 0
                      ? {
                          id: `folder-${Date.now()}`,
                          timestamp: new Date(),
                          filename: `Análise de Pasta (${folderAnalysisResults.length} arquivos)`,
                          code: '',
                          language: 'mixed',
                          scores: displayScores,
                          findings: folderAnalysisResults.flatMap(fr => 
                            fr.result.findings.map(f => ({ ...f, id: `${fr.path}-${f.id}` }))
                          ),
                          passed: displayPassed,
                        }
                      : analysisResult
                  } 
                />
                <Button 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing || !code.trim()}
                  className="min-w-[120px]"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Analisar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <TabsContent value="manual" className="mt-0">
              <div className="space-y-4">
                <CodeEditor 
                  value={code}
                  onChange={setCode}
                  placeholder="Cole seu código aqui para análise...

Suportado: JavaScript, SQL, Delphi/Pascal, Python

O analisador detecta:
• Vulnerabilidades de segurança (SQL Injection, credenciais fixas)
• Problemas de qualidade (console.log, blocos catch vazios)
• Sugestões de melhoria (padrões async/await)"
                />
              </div>
            </TabsContent>

            <TabsContent value="folder" className="mt-0">
              <div className="space-y-6">
                {/* Descrição explicativa */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Como funciona:</strong> Use as bolinhas (checkboxes) para selecionar os arquivos que deseja analisar. 
                    Se você selecionar a pasta inteira (bolinha da pasta raiz), todos os arquivos suportados serão analisados. 
                    Se selecionar apenas arquivos específicos, apenas esses arquivos serão analisados.
                  </p>
                </div>

                {/* Seleção de pasta */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Selecionar pasta do projeto</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedFolderName 
                          ? `Pasta selecionada: ${selectedFolderName}` 
                          : 'Escolha uma pasta do seu computador'}
                      </p>
                    </div>
                    <Button onClick={handleSelectFolder} variant="default" size="sm">
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
                </div>

                {/* Árvore de arquivos */}
                {projectStructure.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {selectedFiles.size} de {supportedFilePaths.length} arquivos selecionados
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

                    <div className="max-h-[300px] sm:max-h-[400px] overflow-auto border rounded-lg p-2 bg-muted/30">
                      <FileTree
                        nodes={projectStructure}
                        selectedFiles={selectedFiles}
                        onSelectionChange={setSelectedFiles}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4 border-2 border-dashed border-border rounded-lg">
                    <FolderOpen className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <h4 className="text-sm font-medium mb-1">Nenhuma pasta selecionada</h4>
                      <p className="text-xs text-muted-foreground">
                        Clique no botão acima para selecionar uma pasta
                      </p>
                      {!isFileSystemAccessSupported() && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                          ⚠️ Use Chrome ou Edge para melhor experiência
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Progresso da análise */}
                {isAnalyzingFolder && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <FileCode className="h-5 w-5 text-primary animate-pulse" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {isPaused ? 'Análise pausada' : 'Analisando arquivos...'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {currentFileIndex} de {totalFiles} arquivos ({Math.round(folderProgress)}% concluído)
                        </p>
                      </div>
                    </div>
                    <Progress value={folderProgress} className="h-2" />
                  </div>
                )}

                {/* Botão de análise */}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button 
                    onClick={handleAnalyzeFolder} 
                    disabled={isAnalyzingFolder || selectedFiles.size === 0 || projectStructure.length === 0}
                    className="min-w-[150px]"
                  >
                    {isAnalyzingFolder ? (
                      <>
                        <span className="animate-spin mr-2">⟳</span>
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Analisar </span>
                        {selectedFiles.size} arquivo(s)
                      </>
                    )}
                  </Button>
                  
                  {/* Botão para gerar heatmap */}
                  {(folderAnalysisResults.length > 0 || riskMatrixItems.length > 0) && (
                    <Button
                      variant="default"
                      onClick={() => navigate('/heatmap')}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <BarChart className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Gerar </span>
                      Heatmap
                    </Button>
                  )}
                  
                  {isAnalyzingFolder && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePauseAnalysis}
                        disabled={!batchProcessorRef.current}
                      >
                        {isPaused ? (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Retomar
                          </>
                        ) : (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pausar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelAnalysis}
                        disabled={!batchProcessorRef.current}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>

                {/* Resultados da análise de pasta */}
                {folderAnalysisResults.length > 0 && (
                  <div className="mt-6 space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Resultados da análise</h4>
                      <div className="text-xs text-muted-foreground">
                        {folderAnalysisResults.filter(r => r.result.passed).length} de {folderAnalysisResults.length} aprovados
                      </div>
                    </div>
                    <div className="grid gap-2 max-h-[300px] overflow-auto">
                      {folderAnalysisResults.map(({ path, result }) => (
                        <div
                          key={path}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border text-sm',
                            result.passed 
                              ? 'border-status-passed/30 bg-status-passed/5' 
                              : 'border-risk-critical/30 bg-risk-critical/5'
                          )}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {result.passed ? (
                              <CheckCircle className="h-4 w-4 text-status-passed flex-shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-risk-critical flex-shrink-0" />
                            )}
                            <span className="font-mono text-xs truncate">{path}</span>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <span className={cn(
                              'text-xs',
                              result.scores.risk >= 70 ? 'text-status-passed' : 'text-risk-critical'
                            )}>
                              Risco: {result.scores.risk}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {result.findings.length} problemas
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>


            <TabsContent value="results" className="mt-0">
              {analysisResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Idioma: <strong className="text-foreground">{analysisResult.language}</strong></span>
                    <span>•</span>
                    <span>Achados: <strong className="text-foreground">{analysisResult.findings.length}</strong></span>
                    <span>•</span>
                    <span>Analisado: <strong className="text-foreground">{analysisResult.timestamp.toLocaleTimeString()}</strong></span>
                  </div>
                  <FindingsList findings={analysisResult.findings} />
                </div>
              )}
              {folderAnalysisResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                    <span>Arquivos analisados: <strong className="text-foreground">{folderAnalysisResults.length}</strong></span>
                    <span className="hidden sm:inline">•</span>
                    <span>Aprovados: <strong className="text-foreground">{folderAnalysisResults.filter(r => r.result.passed).length}</strong></span>
                  </div>
                  <FindingsList findings={folderAnalysisResults.flatMap(fr => fr.result.findings.map(f => ({ ...f, id: `${fr.path}-${f.id}` })))} />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Toggle de IA - Movido para baixo */}
        <div className="mt-6 sm:mt-8 glass-panel p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Análise por IA</h3>
              <p className="text-xs text-muted-foreground">
                A IA está integrada automaticamente em todas as análises. Configure em{' '}
                <button
                  onClick={() => navigate('/configuracoes')}
                  className="text-primary hover:underline"
                >
                  Configurações
                </button>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <Label className="text-sm font-medium">
                Sempre Ativa
              </Label>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
