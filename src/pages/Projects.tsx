import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, TrendingUp, AlertTriangle, Shield, CheckCircle2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createProject, getAllProjectsWithStats, type ProjectWithStats } from '@/lib/projects';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectRepo, setNewProjectRepo] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const data = await getAllProjectsWithStats();
      setProjects(data);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      toast.error('Erro ao carregar projetos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Nome do projeto é obrigatório');
      return;
    }

    try {
      await createProject(newProjectName, newProjectDesc || undefined, newProjectRepo || undefined);
      toast.success('Projeto criado com sucesso');
      setIsDialogOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectRepo('');
      loadProjects();
    } catch (error: any) {
      toast.error(`Erro ao criar projeto: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={false} onAiToggle={() => {}} />
      
      <main className="container px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Projetos</h1>
            <p className="text-muted-foreground">
              Gerencie seus projetos e acompanhe métricas
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Projeto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome do Projeto *</Label>
                  <Input
                    id="name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Meu Projeto"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Descrição do projeto..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="repo">URL do Repositório</Label>
                  <Input
                    id="repo"
                    value={newProjectRepo}
                    onChange={(e) => setNewProjectRepo(e.target.value)}
                    placeholder="https://github.com/user/repo"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateProject}>
                  Criar Projeto
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="glass-panel p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando projetos...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum projeto encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie seu primeiro projeto para começar
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="glass-panel p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/projeto/${project.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <FolderOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{project.name}</h3>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {project.repositoryUrl && (
                  <div className="text-xs text-muted-foreground mb-4 truncate">
                    {project.repositoryUrl}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Análises</div>
                    <div className="text-2xl font-bold">{project.totalAnalyses}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Taxa de Aprovação</div>
                    <div className={cn(
                      'text-2xl font-bold',
                      project.passedRate >= 80 ? 'text-status-passed' : 
                      project.passedRate >= 60 ? 'text-status-warning' : 'text-risk-critical'
                    )}>
                      {project.passedRate}%
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-risk-critical" />
                      <span className="text-muted-foreground">Risco</span>
                    </div>
                    <span className={cn(
                      'font-semibold',
                      project.averageRisk >= 70 ? 'text-status-passed' : 'text-risk-critical'
                    )}>
                      {project.averageRisk}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">Qualidade</span>
                    </div>
                    <span className="font-semibold text-primary">
                      {project.averageQuality}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-status-warning" />
                      <span className="text-muted-foreground">Segurança</span>
                    </div>
                    <span className={cn(
                      'font-semibold',
                      project.averageSecurity >= 70 ? 'text-status-passed' : 'text-status-warning'
                    )}>
                      {project.averageSecurity}%
                    </span>
                  </div>
                </div>

                {project.lastAnalysis && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    Última análise: {new Date(project.lastAnalysis).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
