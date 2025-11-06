import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./../styles/globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PromptHub",
  description: "A web application for storing, organizing, and managing AI prompts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
