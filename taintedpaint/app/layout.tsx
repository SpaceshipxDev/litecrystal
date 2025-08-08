import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import CommandPalette from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: "Estara",
  description: "Estara Kanban board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans app-bg min-h-screen" suppressHydrationWarning>
        <AppShell>
          {children}
        </AppShell>
        <CommandPalette />
      </body>
    </html>
  );
}
