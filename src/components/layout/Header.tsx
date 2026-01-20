import { BarChart, History, Github, GitCompare, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  aiEnabled?: boolean;
  onAiToggle?: (enabled: boolean) => void;
}

export function Header({ aiEnabled, onAiToggle }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div 
            className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => navigate('/')}
          >
            <BarChart className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              QA <span className="text-gradient">FLOW!</span>
            </h1>
            <p className="text-xs text-muted-foreground">Painel de Qualidade de Software</p>
          </div>
          <div className="sm:hidden">
            <h1 className="text-base font-bold tracking-tight">
              QA <span className="text-gradient">FLOW!</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant={location.pathname === '/projetos' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => navigate('/projetos')}
            className="hidden md:flex"
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Projetos
          </Button>
          <Button
            variant={location.pathname === '/git' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => navigate('/git')}
            className="hidden lg:flex"
          >
            <Github className="mr-2 h-4 w-4" />
            Git
          </Button>
          <Button
            variant={location.pathname === '/comparar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => navigate('/comparar')}
            className="hidden lg:flex"
          >
            <GitCompare className="mr-2 h-4 w-4" />
            Comparar
          </Button>
          <Button
            variant={location.pathname === '/historico' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => navigate('/historico')}
          >
            <History className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </Button>
          <Button
            variant={location.pathname === '/heatmap' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => navigate('/heatmap')}
          >
            <BarChart className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Heatmap</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
