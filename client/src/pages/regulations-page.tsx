import Navigation from "@/components/layout/navigation";
import RegulationList from "@/components/regulations/regulation-list";
import RegulationForm from "@/components/regulations/regulation-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function RegulationsPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Regulations
            </h1>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Regulation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Regulation</DialogTitle>
                </DialogHeader>
                <RegulationForm onSuccess={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          <RegulationList />
        </div>
      </main>
    </div>
  );
}
