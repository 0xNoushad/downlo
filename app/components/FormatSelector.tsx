const formats = [
  { id: "best[height<=1080]", label: "1080p", quality: "High" },
  { id: "best[height<=720]", label: "720p", quality: "Medium" },
  { id: "best[height<=480]", label: "480p", quality: "Low" },
  { id: "bestaudio", label: "Audio Only", quality: "MP3" },
];

export function FormatSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border border-dashed overflow-hidden">
      <div className="p-3 border-b border-dashed bg-card">
        <span className="text-sm font-medium">quality</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {formats.map((f) => (
            <button
              key={f.id}
              onClick={() => onChange(f.id)}
              className={`p-3 border border-dashed text-sm transition-colors ${
                selected === f.id
                  ? "bg-foreground text-background"
                  : "bg-background hover:bg-muted"
              }`}
            >
              <div className="font-medium">{f.label}</div>
              <div
                className={`text-xs ${
                  selected === f.id ? "text-background/70" : "text-muted-foreground"
                }`}
              >
                {f.quality}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
