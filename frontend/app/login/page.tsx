import { AuthPage } from "@/features/auth/AuthPage";
import { LoginForm } from "@/features/auth/AuthForms";

export default function LoginPage() {
  return (
    <AuthPage
      eyebrow="Welcome back"
      title="Find your place in the story."
      description="Pick up where your reading life left off. Your shelves, notes, and favorite readers are waiting."
    >
      <LoginForm />
    </AuthPage>
  );
}
