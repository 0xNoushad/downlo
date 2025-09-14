import { ModeToggle } from "./mode-toggle";
import { Download } from "lucide-react";

export const Navbar = () => {
  return (
    <nav className="flex sticky top-0 left-0 right-0 border-b border-dashed z-50">
      <div className="flex gap-2 justify-between max-w-4xl mx-auto w-full p-4 lg:px-6 border-x border-dashed bg-background items-center">
        <div className="flex items-center gap-2">
          <Download className="w-6 h-6" />
          <span className="font-medium">Downlo</span>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </nav>
  );
};