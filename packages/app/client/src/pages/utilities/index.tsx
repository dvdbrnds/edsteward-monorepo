import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegulationViewer } from "../RegulationViewer";
import { Card } from "@/components/ui/card";

export default function UtilitiesPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Utilities</h1>
      
      <Tabs defaultValue="regulations" className="w-full">
        <TabsList>
          <TabsTrigger value="regulations">Regulation Viewer</TabsTrigger>
          {/* Add more tabs here as needed */}
        </TabsList>
        
        <TabsContent value="regulations">
          <Card className="mt-6">
            <RegulationViewer />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
