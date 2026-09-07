import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-muted-foreground text-sm font-semibold tracking-wide">
        404
      </p>
      <h1 className="text-foreground text-xl font-bold">Page not found</h1>
      <Link href="/" className="text-primary text-sm font-medium underline">
        Back to dashboard
      </Link>
    </div>
  );
}
