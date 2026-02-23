interface GenreCloudProps {
  genres: string[];
}

const SIZES = [
  "text-2xl font-bold",
  "text-xl font-semibold",
  "text-lg font-medium",
  "text-base",
  "text-sm",
  "text-sm",
  "text-xs",
  "text-xs",
];

const COLORS = [
  "text-amber",
  "text-amber-light",
  "text-rose",
  "text-amber-light",
  "text-text",
  "text-text-muted",
  "text-text-muted",
  "text-text-muted",
];

export default function GenreCloud({ genres }: GenreCloudProps) {
  if (!genres.length) {
    return <p className="text-text-muted text-sm">No genre data available</p>;
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 items-center justify-center py-2">
      {genres.map((genre, i) => (
        <span
          key={genre}
          className={`${SIZES[i] || "text-xs"} ${COLORS[i] || "text-text-muted"} transition-all hover:text-amber cursor-default whitespace-nowrap`}
        >
          {genre}
        </span>
      ))}
    </div>
  );
}
