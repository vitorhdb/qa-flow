/**
 * Página de Perfil do Usuário
 * Permite editar informações pessoais e foto de perfil
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Building, Globe, FileText, Camera, Save, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { getUserById, updateUser, type User as UserType } from '@/lib/auth';
import { toast } from 'sonner';

export default function Profile() {
  const navigate = useNavigate();
  const { user: currentUser, refreshSession } = useAuth();
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, [currentUser]);

  const loadUser = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      setIsLoading(true);
      const userData = await getUserById(currentUser.id);
      if (userData) {
        setUser(userData);
        setAvatarPreview(userData.avatar || null);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast.error('Erro ao carregar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valida tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Valida tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    // Cria preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsSaving(true);
      
      // Atualiza avatar se houver preview
      const updatedUser: UserType = {
        ...user,
        avatar: avatarPreview || user.avatar,
      };

      await updateUser(updatedUser);
      await refreshSession();
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
      toast.error(`Erro ao salvar perfil: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    loadUser();
    setAvatarPreview(user?.avatar || null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Usuário não encontrado</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8" />
            Meu Perfil
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas informações pessoais e preferências
          </p>
        </div>

        <form onSubmit={handleSave}>
          <div className="space-y-6">
            {/* Foto de Perfil */}
            <Card>
              <CardHeader>
                <CardTitle>Foto de Perfil</CardTitle>
                <CardDescription>
                  Clique na foto para alterar. Formatos aceitos: JPG, PNG, GIF (máx. 5MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarPreview || undefined} alt={user.name} />
                      <AvatarFallback className="text-2xl">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="avatar-upload"
                      className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                    >
                      <Camera className="h-4 w-4" />
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Provedor: {user.provider === 'email' ? 'Email' : user.provider === 'github' ? 'GitHub' : 'Google'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>
                  Seus dados pessoais e de contato
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        value={user.name}
                        onChange={(e) => setUser({ ...user, name: e.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={user.email}
                        disabled
                        className="pl-10 bg-muted"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(00) 00000-0000"
                        value={user.phone || ''}
                        onChange={(e) => setUser({ ...user, phone: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="company"
                        placeholder="Nome da empresa"
                        value={user.company || ''}
                        onChange={(e) => setUser({ ...user, company: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://seu-site.com"
                        value={user.website || ''}
                        onChange={(e) => setUser({ ...user, website: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Biografia</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="bio"
                      placeholder="Conte um pouco sobre você..."
                      value={user.bio || ''}
                      onChange={(e) => setUser({ ...user, bio: e.target.value })}
                      className="pl-10 min-h-[100px]"
                      maxLength={500}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user.bio?.length || 0}/500 caracteres
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card>
              <CardHeader>
                <CardTitle>Endereço</CardTitle>
                <CardDescription>
                  Informações de localização
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      placeholder="Rua, número, complemento"
                      value={user.address || ''}
                      onChange={(e) => setUser({ ...user, address: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      placeholder="Cidade"
                      value={user.city || ''}
                      onChange={(e) => setUser({ ...user, city: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      placeholder="Estado"
                      value={user.state || ''}
                      onChange={(e) => setUser({ ...user, state: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zipCode">CEP</Label>
                    <Input
                      id="zipCode"
                      placeholder="00000-000"
                      value={user.zipCode || ''}
                      onChange={(e) => setUser({ ...user, zipCode: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    placeholder="Brasil"
                    value={user.country || ''}
                    onChange={(e) => setUser({ ...user, country: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Botões de Ação */}
            <div className="flex items-center justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
