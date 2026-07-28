import { AppShell } from "@/components/app-shell";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  return <AppShell view="watch" watchId={id} />;
}
