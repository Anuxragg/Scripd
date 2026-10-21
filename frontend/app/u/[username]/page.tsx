import { SiteHeader } from "@/components/SiteHeader";
import { ProfilePage } from "@/features/profile/ProfilePage";

export default async function UserProfileRoute({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return (
    <div className="min-h-screen bg-[#121417] text-[#e0e6ed]">
      <SiteHeader theme="dark" />
      <ProfilePage username={username} />
    </div>
  );
}
