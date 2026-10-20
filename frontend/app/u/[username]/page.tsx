import { SiteHeader } from "@/components/SiteHeader";
import { ProfilePage } from "@/features/profile/ProfilePage";

export default async function UserProfileRoute({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return (
    <>
      <SiteHeader />
      <ProfilePage username={username} />
    </>
  );
}
