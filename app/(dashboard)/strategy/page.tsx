import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function StrategyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Strategy</h1>
        <p className="text-muted-foreground">
          Plan your content strategy
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Content Strategy</CardTitle>
          <CardDescription>
            Define and manage your content strategies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No strategies defined yet. Create your first strategy to get started
            with content planning.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
