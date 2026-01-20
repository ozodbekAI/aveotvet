import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AiAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI настройки</h1>
        <div className="text-sm text-muted-foreground">providers, feature flags, policies</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>В разработке</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Этот экран зарезервирован под admin.ai.* (провайдеры, фича-флаги, политики). Доступ: super_admin.
        </CardContent>
      </Card>
    </div>
  )
}
