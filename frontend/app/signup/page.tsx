import { AuthLayout } from "@/features/auth/AuthLayout";
import { RegisterForm } from "@/features/auth/AuthForms";

export const metadata = {
  title: "Sign Up — Scripd",
  description: "Create an account on Scripd to track your reading and book reviews.",
};

export default function SignUpPage() {
  return (
    <AuthLayout
      footerText="Already have an account?"
      footerLinkText="Log In"
      footerLinkHref="/login"
    >
      <RegisterForm />
    </AuthLayout>
  );
}
