import { BarChart, History, Github, GitCompare, FolderOpen, Settings, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HeaderProps {
  aiEnabled?: boolean;
  onAiToggle?: (enabled: boolean) => void;
}

export function Header({ aiEnabled, onAiToggle }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

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
          {isAuthenticated && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/perfil')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Meu Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => {
                  await logout();
                  navigate('/');
                }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
