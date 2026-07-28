import { AppShell } from "@/components/app-shell";

type Props = {
  params: Promise<{ address: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { address } = await params;
  return <AppShell view="profile" profileAddress={address} />;
}
