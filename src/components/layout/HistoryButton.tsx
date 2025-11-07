"use client";

import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { toast } from "sonner";

export function HistoryButton() {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        toast.info("Version history coming soon!");
      }}
    >
      <History className="h-4 w-4 mr-1" />
      History
    </Button>
  );
}
