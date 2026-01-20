/**
 * Processador em lotes para análise de arquivos grandes
 * Processa arquivos em chunks para não travar a UI
 */

export interface BatchProcessorOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  onProgress?: (progress: number, current: number, total: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

export class BatchProcessor<T, R> {
  private items: T[] = [];
  private results: R[] = [];
  private currentIndex = 0;
  private isPaused = false;
  private isCancelled = false;
  private processor: (item: T, index: number) => Promise<R> | R;
  private options: Required<BatchProcessorOptions>;

  constructor(
    processor: (item: T, index: number) => Promise<R> | R,
    options: BatchProcessorOptions = {}
  ) {
    this.processor = processor;
    this.options = {
      batchSize: options.batchSize || 10,
      delayBetweenBatches: options.delayBetweenBatches || 50,
      onProgress: options.onProgress || (() => {}),
      onPause: options.onPause || (() => {}),
      onResume: options.onResume || (() => {}),
      onCancel: options.onCancel || (() => {}),
    };
  }

  async process(items: T[]): Promise<R[]> {
    this.items = items;
    this.results = [];
    this.currentIndex = 0;
    this.isPaused = false;
    this.isCancelled = false;

    while (this.currentIndex < this.items.length && !this.isCancelled) {
      if (this.isPaused) {
        await this.waitForResume();
        if (this.isCancelled) break;
      }

      const batch = this.items.slice(
        this.currentIndex,
        this.currentIndex + this.options.batchSize
      );

      // Processa o lote
      for (let i = 0; i < batch.length; i++) {
        if (this.isCancelled) break;
        
        const item = batch[i];
        const result = await this.processor(item, this.currentIndex + i);
        this.results.push(result);
        this.currentIndex++;

        // Atualiza progresso
        const progress = (this.currentIndex / this.items.length) * 100;
        this.options.onProgress(progress, this.currentIndex, this.items.length);
      }

      // Delay entre lotes para não travar a UI
      // Delay maior para muitos arquivos
      if (this.currentIndex < this.items.length && !this.isCancelled) {
        const delay = this.items.length > 1000 ? 50 : this.options.delayBetweenBatches;
        await this.delay(delay);
      }
    }

    return this.results;
  }

  pause() {
    this.isPaused = true;
    this.options.onPause();
  }

  resume() {
    this.isPaused = false;
    this.options.onResume();
  }

  cancel() {
    this.isCancelled = true;
    this.isPaused = false;
    this.options.onCancel();
  }

  private async waitForResume(): Promise<void> {
    while (this.isPaused && !this.isCancelled) {
      await this.delay(100);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getProgress(): { current: number; total: number; percentage: number } {
    return {
      current: this.currentIndex,
      total: this.items.length,
      percentage: this.items.length > 0 ? (this.currentIndex / this.items.length) * 100 : 0,
    };
  }
}
