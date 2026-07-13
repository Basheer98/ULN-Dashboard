export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for does not exist.
        </p>
        <a href="/dashboard" className="link mt-6 inline-block">
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
