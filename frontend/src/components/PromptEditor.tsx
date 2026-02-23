interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PromptEditor({ value, onChange }: PromptEditorProps) {
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  const isOverLimit = wordCount > 120;

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted/40 resize-none focus:outline-none focus:border-amber transition-colors"
        placeholder="Your music generation prompt..."
      />
      <div className="flex justify-between text-xs text-text-muted">
        <span>Edit the prompt to fine-tune the output</span>
        <span className={isOverLimit ? "text-red-400" : ""}>
          {wordCount}/120 words
        </span>
      </div>
    </div>
  );
}
