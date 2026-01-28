import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>
        {message && (
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            {message}
          </div>
        )}
        <LoginForm redirectTo={next} />
      </div>
    </div>
  );
}
