import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-screen">
      <LoginForm />
    </div>
  );
}
