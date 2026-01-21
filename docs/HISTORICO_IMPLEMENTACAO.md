# Sistema de Histórico de Análises - QA FLOW!

## 📋 Visão Geral

Sistema completo de histórico temporal que transforma o QA FLOW! de um scanner pontual em uma plataforma de governança contínua de qualidade e risco.

## 🏗️ Arquitetura

### Entidades Fundamentais

#### Project
```typescript
{
  id: string;
  name: string;
  provider: 'manual' | 'github' | 'gitea';
  repositoryUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Analysis (Imutável)
```typescript
{
  id: string;
  projectId: string;
  timestamp: Date;
  branch?: string;
  commitHash?: string;
  mode: 'manual' | 'folder' | 'repo' | 'ci';
  riskScore: number;
  qualityScore: number;
  securityScore: number;
  improvementScore: number;
  qualityGate: 'PASS' | 'FAIL';
  // ... métricas agregadas
}
```

**REGRA DE OURO**: Análises nunca são atualizadas, apenas criadas.

#### Finding (Com Fingerprint)
```typescript
{
  id: string;
  analysisId: string;
  type: 'quality' | 'security' | 'improvement';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line?: number;
  description: string;
  fingerprint: string; // Hash lógico para rastreamento temporal
}
```

## 🔍 Funcionalidades Implementadas

### 1. Sistema de Comparação (Diff)

**Arquivo**: `src/lib/history-comparison.ts`

- Compara duas análises e identifica:
  - ✅ Novos problemas
  - ✅ Problemas resolvidos
  - ✅ Problemas persistentes
  - ✅ Mudanças de severidade
  - ✅ Deltas de score

**Funções principais**:
- `compareAnalyses()`: Compara duas análises específicas
- `compareWithPreviousAnalysis()`: Compara com a análise anterior automaticamente
- `calculateFindingFingerprint()`: Calcula hash lógico para rastreamento

### 2. Sistema de Tendências

**Arquivo**: `src/lib/history-trends.ts`

- Calcula evolução temporal:
  - ✅ Histórico de risco por arquivo
  - ✅ Tendência geral do projeto
  - ✅ Dados históricos para heatmap
  - ✅ Identificação de arquivos problemáticos

**Funções principais**:
- `getFileRiskHistory()`: Histórico completo de um arquivo
- `getProjectTrend()`: Tendência geral do projeto (30 dias)
- `getHeatmapHistoricalData()`: Dados para heatmap histórico

### 3. Quality Gate com Memória

**Arquivo**: `src/lib/quality-gate-memory.ts`

- Avalia não apenas scores atuais, mas também:
  - ✅ Regressões de risco
  - ✅ Novos findings críticos
  - ✅ Regressões de segurança
  - ✅ Tendências de melhoria/degradação

**Regras implementadas**:
1. Score de risco máximo
2. Score de qualidade mínimo
3. Score de segurança mínimo
4. Findings críticos máximos
5. Findings altos máximos
6. **Regressão de risco** (novo)
7. **Novos findings críticos** (novo)
8. **Regressão de segurança** (novo)

### 4. Interface Timeline (SonarQube-like)

**Arquivo**: `src/pages/HistoryTimeline.tsx`

- Visualização completa:
  - ✅ Timeline de execuções
  - ✅ Filtros por projeto e branch
  - ✅ Comparação com análise anterior
  - ✅ Gráficos de tendência
  - ✅ Indicadores visuais de qualidade

**Rota**: `/timeline`

## 📊 Banco de Dados

### Novas Stores IndexedDB

- `analyses_history`: Análises históricas (imutáveis)
- `findings_history`: Findings com fingerprint

### Índices Criados

- `projectId`: Busca por projeto
- `timestamp`: Ordenação temporal
- `branch`: Filtro por branch
- `mode`: Filtro por modo de análise
- `qualityGate`: Filtro por status
- `fingerprint`: Rastreamento temporal de findings

## 🔄 Fluxo de Dados

### Salvando Análise Histórica

```typescript
import { db } from '@/lib/database';
import { convertToAnalysisHistory } from '@/lib/quality-gate-memory';
import { calculateFindingFingerprint } from '@/lib/history-comparison';

// 1. Converte AnalysisRecord para Analysis
const analysis = convertToAnalysisHistory(record, projectId, 'manual');

// 2. Salva análise
await db.saveAnalysisHistory(analysis);

// 3. Processa e salva findings com fingerprint
const findings = record.findings.map(f => ({
  ...f,
  analysisId: analysis.id,
  fingerprint: calculateFindingFingerprint(f),
}));
await db.saveFindings(findings);
```

### Comparando Análises

```typescript
import { compareAnalyses } from '@/lib/history-comparison';

const comparison = await compareAnalyses(
  baselineAnalysisId,
  currentAnalysisId
);

console.log(comparison.totalNewFindings); // Novos problemas
console.log(comparison.totalResolvedFindings); // Resolvidos
console.log(comparison.riskScoreDelta); // Mudança de risco
```

### Obtendo Tendências

```typescript
import { getProjectTrend, getFileRiskHistory } from '@/lib/history-trends';

// Tendência do projeto (30 dias)
const trend = await getProjectTrend(projectId, 30);
console.log(trend.riskTrend); // 'improving' | 'stable' | 'degrading'

// Histórico de um arquivo
const fileHistory = await getFileRiskHistory('src/auth.js', projectId);
console.log(fileHistory.trend); // Tendência do arquivo
```

## 🎯 Casos de Uso

### 1. Identificar Regressões

```typescript
const comparison = await compareWithPreviousAnalysis(currentAnalysisId);

if (comparison.riskScoreDelta > 10) {
  console.log('⚠️ Regressão detectada!');
  console.log(`Risco aumentou ${comparison.riskScoreDelta}%`);
}
```

### 2. Rastrear Problemas Persistentes

```typescript
const comparison = await compareAnalyses(baselineId, currentId);

console.log(`${comparison.totalPersistentFindings} problemas persistentes`);
comparison.persistentFindings.forEach(f => {
  console.log(`- ${f.file}:${f.line} - ${f.description}`);
});
```

### 3. Monitorar Evolução de Arquivo

```typescript
const history = await getFileRiskHistory('src/auth.js', projectId);

if (history.trend === 'degrading') {
  console.log('⚠️ Arquivo piorando ao longo do tempo');
}
```

## 📈 Heatmap Histórico

O heatmap agora considera dados históricos:

```typescript
import { getHeatmapHistoricalData } from '@/lib/history-trends';

const heatmapData = await getHeatmapHistoricalData(projectId);

heatmapData.forEach(file => {
  console.log(`${file.file}:`);
  console.log(`  Tendência: ${file.trend}`);
  console.log(`  Evolução: ${file.riskEvolution.length} análises`);
  console.log(`  Risco atual: ${file.currentRisk.riskLevel}`);
});
```

## 🚦 Quality Gate Inteligente

```typescript
import { evaluateQualityGateWithMemory } from '@/lib/quality-gate-memory';

const result = await evaluateQualityGateWithMemory(analysis, {
  maxRiskScore: 70,
  failOnRiskIncrease: true,
  riskIncreaseThreshold: 10, // Falha se risco aumentar 10%
  failOnNewCriticalFindings: true,
});

if (!result.passed) {
  console.log('❌ Quality Gate falhou:');
  result.reasons.forEach(reason => console.log(`  - ${reason}`));
}
```

## 🔮 Próximos Passos

- [ ] Integração automática ao salvar análises
- [ ] Dashboard de métricas agregadas
- [ ] Alertas de regressão
- [ ] Exportação de relatórios históricos
- [ ] API REST para histórico
- [ ] Webhooks para análise automática

## 📝 Notas Importantes

1. **Imutabilidade**: Análises nunca são atualizadas, apenas criadas
2. **Fingerprint**: Permite rastrear problemas ao longo do tempo
3. **Contexto**: Branch e commit são essenciais para comparações corretas
4. **Performance**: Índices otimizados para consultas temporais
5. **Compatibilidade**: Sistema mantém compatibilidade com `AnalysisRecord` antigo

## 🎉 Resultado

O QA FLOW! agora é uma plataforma completa de governança contínua capaz de:
- ✅ Auditar o passado
- ✅ Entender o presente
- ✅ Prever tendências futuras
- ✅ Identificar regressões automaticamente
- ✅ Rastrear evolução de qualidade
