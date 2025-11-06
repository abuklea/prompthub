import { AuthForm } from "@/features/auth/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="font-extrabold tracking-tighter text-2xl mb-2">
          PromptHub
        </h1>
        <p className="text-sm text-muted-foreground">
          Your centralized AI prompt repository
        </p>
      </div>
      <AuthForm />
    </div>
  );
}
