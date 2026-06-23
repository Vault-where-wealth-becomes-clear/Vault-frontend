interface ComingSoonProps {
  title: string;
}

export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="p-7">
      <h1 className="mb-1 font-syne text-2xl font-bold">{title}</h1>
      <p className="text-sm text-vault-muted2">Esta sección todavía no está implementada.</p>
    </div>
  );
}
