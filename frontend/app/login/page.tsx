import { AuthLayout } from "@/features/auth/AuthLayout";
import { LoginForm } from "@/features/auth/AuthForms";

export const metadata = {
  title: "Login — Scripd",
  description: "Sign in to your Scripd reading profile and shelves.",
};

export default function LoginPage() {
  return (
    <AuthLayout
      footerText="Don't have an account?"
      footerLinkText="Sign Up"
      footerLinkHref="/signup"
    >
      <LoginForm />
    </AuthLayout>
  );
}
