import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CodeEditor({ value, onChange, placeholder, className }: CodeEditorProps) {
  return (
    <div className={cn('relative', className)}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ''}
        className="code-editor min-h-[400px] resize-none p-4 font-mono text-sm leading-relaxed placeholder:text-muted-foreground/50"
        spellCheck={false}
      />
      <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{value.split('\n').length} lines</span>
        <span>•</span>
        <span>{value.length} chars</span>
      </div>
    </div>
  );
}
