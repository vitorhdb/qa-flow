/**
 * Sistema de Alertas
 * Configuração de regras e notificações
 */

import { AnalysisResult } from '@/types/qa';

export type AlertChannel = 'email' | 'webhook' | 'slack' | 'teams';

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  channels: AlertChannel[];
  recipients?: string[];
  webhookUrl?: string;
}

export interface AlertCondition {
  metric: 'risk' | 'security' | 'quality' | 'findings' | 'criticalFindings';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: Date;
  analysisId: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  resolved: boolean;
}

const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'critical-security',
    name: 'Vulnerabilidades Críticas de Segurança',
    enabled: true,
    conditions: [
      { metric: 'criticalFindings', operator: 'gt', value: 0 },
    ],
    channels: ['email'],
  },
  {
    id: 'low-security-score',
    name: 'Score de Segurança Baixo',
    enabled: true,
    conditions: [
      { metric: 'security', operator: 'lt', value: 70 },
    ],
    channels: ['email'],
  },
  {
    id: 'high-risk',
    name: 'Risco Elevado',
    enabled: true,
    conditions: [
      { metric: 'risk', operator: 'lt', value: 60 },
    ],
    channels: ['email', 'webhook'],
  },
];

class AlertManager {
  private rules: AlertRule[] = [];
  private alerts: Alert[] = [];

  constructor() {
    this.loadRules();
  }

  private loadRules() {
    const saved = localStorage.getItem('alert_rules');
    if (saved) {
      this.rules = JSON.parse(saved);
    } else {
      this.rules = DEFAULT_RULES;
      this.saveRules();
    }
  }

  private saveRules() {
    localStorage.setItem('alert_rules', JSON.stringify(this.rules));
  }

  getRules(): AlertRule[] {
    return this.rules;
  }

  addRule(rule: AlertRule) {
    this.rules.push(rule);
    this.saveRules();
  }

  updateRule(id: string, updates: Partial<AlertRule>) {
    const index = this.rules.findIndex(r => r.id === id);
    if (index >= 0) {
      this.rules[index] = { ...this.rules[index], ...updates };
      this.saveRules();
    }
  }

  deleteRule(id: string) {
    this.rules = this.rules.filter(r => r.id !== id);
    this.saveRules();
  }

  evaluateAnalysis(result: AnalysisResult): Alert[] {
    const newAlerts: Alert[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      let triggered = false;
      for (const condition of rule.conditions) {
        const value = this.getMetricValue(result, condition.metric);
        triggered = this.evaluateCondition(value, condition.operator, condition.value);
        
        if (!triggered) break;
      }

      if (triggered) {
        const alert: Alert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          timestamp: new Date(),
          analysisId: result.id,
          message: this.generateAlertMessage(rule, result),
          severity: this.determineSeverity(result),
          resolved: false,
        };

        newAlerts.push(alert);
        this.alerts.push(alert);
        this.sendAlert(alert, rule);
      }
    }

    return newAlerts;
  }

  private getMetricValue(result: AnalysisResult, metric: AlertCondition['metric']): number {
    switch (metric) {
      case 'risk':
        return result.scores.risk;
      case 'security':
        return result.scores.security;
      case 'quality':
        return result.scores.quality;
      case 'findings':
        return result.findings.length;
      case 'criticalFindings':
        return result.findings.filter(f => f.severity === 'critical').length;
      default:
        return 0;
    }
  }

  private evaluateCondition(value: number, operator: AlertCondition['operator'], threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      default:
        return false;
    }
  }

  private generateAlertMessage(rule: AlertRule, result: AnalysisResult): string {
    return `Alerta: ${rule.name}. Risco: ${result.scores.risk}%, Segurança: ${result.scores.security}%, Findings: ${result.findings.length}`;
  }

  private determineSeverity(result: AnalysisResult): Alert['severity'] {
    if (result.scores.risk < 40 || result.scores.security < 50) {
      return 'critical';
    }
    if (result.scores.risk < 60 || result.scores.security < 70) {
      return 'error';
    }
    if (result.scores.risk < 70) {
      return 'warning';
    }
    return 'info';
  }

  private async sendAlert(alert: Alert, rule: AlertRule) {
    for (const channel of rule.channels) {
      try {
        if (channel === 'email' && rule.recipients) {
          // Implementar envio de email
          console.log('Enviando email para:', rule.recipients, alert.message);
        } else if (channel === 'webhook' && rule.webhookUrl) {
          await fetch(rule.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert),
          });
        } else if (channel === 'slack' && rule.webhookUrl) {
          await fetch(rule.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 ${alert.ruleName}: ${alert.message}`,
            }),
          });
        }
      } catch (error) {
        console.error(`Erro ao enviar alerta via ${channel}:`, error);
      }
    }
  }

  getAlerts(limit?: number): Alert[] {
    const sorted = this.alerts.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  resolveAlert(id: string) {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.resolved = true;
    }
  }
}

export const alertManager = new AlertManager();
