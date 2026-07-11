import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto max-w-[800px] px-4 py-12">
      <h1 className="mb-2 text-3xl">Omnia GUI</h1>
      <p className="mb-8 text-muted-foreground">
        Configuration and gameplay interface for the Omnia simulation engine.
      </p>
      <div className="flex gap-4">
        <Link href="/play" className="flex-1 no-underline">
          <Card className="transition-[border-color,box-shadow] duration-150 hover:border-blue-600 hover:shadow-[0_2px_8px_rgba(37,99,235,0.1)]">
            <CardHeader>
              <CardTitle>Play</CardTitle>
              <CardDescription>
                Start a simulation and interact with NPCs
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/config" className="flex-1 no-underline">
          <Card className="transition-[border-color,box-shadow] duration-150 hover:border-blue-600 hover:shadow-[0_2px_8px_rgba(37,99,235,0.1)]">
            <CardHeader>
              <CardTitle>Config</CardTitle>
              <CardDescription>
                Check environment, API keys, and available scenarios
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </main>
  );
}
