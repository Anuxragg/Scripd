import { AuthPage } from "@/features/auth/AuthPage";
import { RegisterForm } from "@/features/auth/AuthForms";

export default function SignUpPage() {
  return (
    <AuthPage
      eyebrow="Start your reading log"
      title="Make room for more good books."
      description="Create a home for the books you finish, the ones you love, and the readers who help you find the next one."
    >
      <RegisterForm />
    </AuthPage>
  );
}
