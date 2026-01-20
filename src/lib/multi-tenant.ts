/**
 * Sistema Multi-Tenant
 * Suporte para múltiplas organizações/empresas
 */

import { User } from './auth';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  maxUsers: number;
  maxProjects: number;
  createdAt: Date;
  settings: {
    allowPublicProjects: boolean;
    requireApproval: boolean;
    retentionDays: number;
  };
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
}

class MultiTenantManager {
  private currentOrg: Organization | null = null;
  private organizations: Organization[] = [];

  constructor() {
    this.loadOrganizations();
  }

  private loadOrganizations() {
    const saved = localStorage.getItem('organizations');
    if (saved) {
      this.organizations = JSON.parse(saved).map((org: any) => ({
        ...org,
        createdAt: new Date(org.createdAt),
      }));
    }

    const currentOrgId = localStorage.getItem('current_organization_id');
    if (currentOrgId) {
      this.currentOrg = this.organizations.find(o => o.id === currentOrgId) || null;
    }
  }

  private saveOrganizations() {
    localStorage.setItem('organizations', JSON.stringify(this.organizations));
    if (this.currentOrg) {
      localStorage.setItem('current_organization_id', this.currentOrg.id);
    }
  }

  async createOrganization(
    name: string,
    user: User
  ): Promise<Organization> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const org: Organization = {
      id: `org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      slug,
      plan: 'free',
      maxUsers: 5,
      maxProjects: 3,
      createdAt: new Date(),
      settings: {
        allowPublicProjects: false,
        requireApproval: true,
        retentionDays: 90,
      },
    };

    this.organizations.push(org);
    this.saveOrganizations();
    this.setCurrentOrganization(org.id);

    return org;
  }

  getOrganizations(): Organization[] {
    return this.organizations;
  }

  getCurrentOrganization(): Organization | null {
    return this.currentOrg;
  }

  setCurrentOrganization(orgId: string) {
    const org = this.organizations.find(o => o.id === orgId);
    if (org) {
      this.currentOrg = org;
      this.saveOrganizations();
    }
  }

  async updateOrganization(
    orgId: string,
    updates: Partial<Omit<Organization, 'id' | 'createdAt' | 'slug'>>
  ): Promise<Organization> {
    const index = this.organizations.findIndex(o => o.id === orgId);
    if (index >= 0) {
      this.organizations[index] = {
        ...this.organizations[index],
        ...updates,
      };
      this.saveOrganizations();
      
      if (this.currentOrg?.id === orgId) {
        this.currentOrg = this.organizations[index];
      }
      
      return this.organizations[index];
    }
    throw new Error('Organização não encontrada');
  }

  async deleteOrganization(orgId: string) {
    this.organizations = this.organizations.filter(o => o.id !== orgId);
    if (this.currentOrg?.id === orgId) {
      this.currentOrg = null;
      localStorage.removeItem('current_organization_id');
    }
    this.saveOrganizations();
  }

  canCreateProject(): boolean {
    if (!this.currentOrg) return false;
    // Verificar limite de projetos
    return true; // Simplificado
  }

  canAddUser(): boolean {
    if (!this.currentOrg) return false;
    // Verificar limite de usuários
    return true; // Simplificado
  }

  getPlanLimits(plan: Organization['plan']) {
    const limits = {
      free: {
        maxUsers: 5,
        maxProjects: 3,
        maxAnalysesPerMonth: 100,
        features: ['basic-analysis', 'reports'],
      },
      pro: {
        maxUsers: 20,
        maxProjects: 20,
        maxAnalysesPerMonth: 1000,
        features: ['basic-analysis', 'reports', 'git-integration', 'alerts', 'api'],
      },
      enterprise: {
        maxUsers: -1, // Ilimitado
        maxProjects: -1,
        maxAnalysesPerMonth: -1,
        features: ['all'],
      },
    };
    return limits[plan];
  }
}

export const multiTenantManager = new MultiTenantManager();
