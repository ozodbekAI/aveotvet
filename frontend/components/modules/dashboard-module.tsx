"use client"

import { useMemo, useState } from "react"
import { RefreshCw, Star } from "lucide-react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  RadialBarChart,
  RadialBar,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

type PeriodKey = "14d" | "7d" | "30d"

const lineData14d = [
  { d: "26.12", v: 0 },
  { d: "27.12", v: 0 },
  { d: "28.12", v: 0 },
  { d: "29.12", v: 0 },
  { d: "30.12", v: 0 },
  { d: "31.12", v: 0 },
  { d: "01.01", v: 0 },
  { d: "02.01", v: 0 },
  { d: "03.01", v: 0 },
  { d: "04.01", v: 0 },
  { d: "05.01", v: 0 },
  { d: "06.01", v: 4 },
  { d: "07.01", v: 15 },
  { d: "08.01", v: 13 },
  { d: "09.01", v: 0 },
  { d: "10.01", v: 0 },
]

const topPositive = [
  { title: "Костюм твидовый с юбкой миди и жакетом", brand: "Avemod", count: 4 },
  { title: "Пиджак в стиле кимоно с рукавами-кейп", brand: "Avemod", count: 3 },
  { title: "Костюм-двойка с контрастным кантом для офиса", brand: "Avemod", count: 2 },
  { title: "Костюм с двубортным жакетом и брюками клеш", brand: "Avemod", count: 2 },
  { title: "Костюм двойка приталенная блузка и брюки для офиса", brand: "Avemod", count: 2 },
]

const topNegative = [
  { title: "Платье с запахом и поясом", brand: "Avemod", count: 2 },
  { title: "Жакет укороченный классический", brand: "Avemod", count: 2 },
  { title: "Брюки прямые базовые", brand: "Avemod", count: 1 },
]

function fmtPeriodLabel(p: PeriodKey) {
  if (p === "7d") return "Последние 7 дней"
  if (p === "30d") return "Последние 30 дней"
  return "Последние 14 дней"
}

export default function DashboardModule() {
  const [activeTab, setActiveTab] = useState<"feedbacks" | "questions" | "chats">("feedbacks")
  const [period, setPeriod] = useState<PeriodKey>("14d")
  const [topTab, setTopTab] = useState<"pos" | "neg">("pos")

  const kpis = useMemo(() => {
    // Hozircha static. Keyin endpoint bo‘lsa shu yerga bog‘laymiz.
    return {
      total: 31,
      pending: 31,
      unanswered: 31,
      answered: 0,
      avgRating: 4.2,
      positiveShare: 78, // %
    }
  }, [])

  const gaugeData = useMemo(() => [{ name: "pos", value: kpis.positiveShare, fill: "hsl(var(--primary))" }], [kpis])

  const topList = topTab === "pos" ? topPositive : topNegative

  return (
    <div className="space-y-6">
      {/* Top bar (static) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-2xl font-bold text-foreground">Главная</div>

          <div className="flex items-center gap-2">
            <Select value="all" onValueChange={() => {}}>
              <SelectTrigger className="w-[180px] bg-card border-border">
                <SelectValue placeholder="Все магазины" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Все магазины</SelectItem>
                <SelectItem value="current">Текущий магазин</SelectItem>
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[200px] bg-card border-border">
                <SelectValue placeholder="Период" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="7d">{fmtPeriodLabel("7d")}</SelectItem>
                <SelectItem value="14d">{fmtPeriodLabel("14d")}</SelectItem>
                <SelectItem value="30d">{fmtPeriodLabel("30d")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={() => {}} className="bg-primary hover:bg-primary/90">
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить данные
        </Button>
      </div>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="w-full bg-muted">
          <TabsTrigger value="feedbacks" className="flex-1">
            Отзывы
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex-1">
            Вопросы
          </TabsTrigger>
          <TabsTrigger value="chats" className="flex-1">
            Чаты
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedbacks" className="space-y-6">
          {/* KPI + Gauge + Premium/Token */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Сводка</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">Всего поступило</div>
                    <div className="text-3xl font-bold text-primary mt-1">{kpis.total}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">Ожидают публикации</div>
                    <div className="text-3xl font-bold text-foreground mt-1">{kpis.pending}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">Неотвеченные отзывы</div>
                    </div>
                    <div className="flex items-end justify-between mt-1">
                      <div className="text-3xl font-bold text-foreground">{kpis.unanswered}</div>
                      <div className="text-xs text-muted-foreground">100%</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">Отвеченные отзывы</div>
                    <div className="text-3xl font-bold text-foreground mt-1">{kpis.answered}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Средний рейтинг отзывов</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-end gap-2 mb-2">
                  <Star className="h-4 w-4 text-primary" />
                  <div className="text-2xl font-bold text-foreground">{kpis.avgRating.toFixed(1)}</div>
                </div>

                <div className="h-[170px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      innerRadius="70%"
                      outerRadius="100%"
                      data={gaugeData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar dataKey="value" cornerRadius={999} />
                      <Tooltip />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-center -mt-10">
                  <div className="text-3xl font-bold text-primary">{kpis.positiveShare}%</div>
                  <div className="text-xs text-muted-foreground">Положительных отзывов</div>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-1 space-y-6">
              <Card className="border-border overflow-hidden">
                <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
                  <div className="text-sm opacity-90">Премиум-подписка</div>
                  <div className="text-3xl font-bold mt-1">Активирована</div>
                  <div className="text-xs opacity-80 mt-2">до 20 января 2026 г.</div>
                </div>
              </Card>

              <Card className="border-border overflow-hidden">
                <div className="p-6 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
                  <div className="text-sm opacity-90">Баланс токенов</div>
                  <div className="flex items-end gap-2 mt-2">
                    <div className="text-4xl font-bold">126</div>
                    <div className="text-sm opacity-80 pb-1">токенов</div>
                  </div>
                  <div className="text-xs opacity-75 mt-1">3 токена в день (~42 дня)</div>

                  <Button className="mt-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    + Пополнить
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Line chart + Top products */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Динамика изменений <span className="text-primary">отзывов</span>
                </CardTitle>
                <div className="text-xs text-muted-foreground">{fmtPeriodLabel(period)}</div>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData14d} margin={{ left: 4, right: 12, top: 10, bottom: 0 }}>
                      <XAxis dataKey="d" tickMargin={8} />
                      <YAxis tickMargin={8} />
                      <Tooltip />
                      <Line type="monotone" dataKey="v" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-xs text-muted-foreground mt-3">
                  Текущий период: 26.12 — 10.01
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Топ товаров по отзывам</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={topTab} onValueChange={(v) => setTopTab(v as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="pos" className="flex-1">
                      Положительные
                    </TabsTrigger>
                    <TabsTrigger value="neg" className="flex-1">
                      Отрицательные
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-4 space-y-3">
                    {topList.map((it, idx) => (
                      <div key={idx} className="rounded-xl bg-muted/40 border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                              {it.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{it.brand}</div>
                          </div>
                          <div className="text-xl font-bold text-primary">{it.count}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Tabs>

                <Separator className="my-4" />
                <div className="text-xs text-muted-foreground">
                  Сейчас блок статический. Когда появится endpoint — подключим реальные данные.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Other tabs: temporarily static placeholders */}
        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Вопросы</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Этот раздел на dashboard пока статический (как заглушка). Основной функционал — в /questions.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chats">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Чаты</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Этот раздел на dashboard пока статический (как заглушка). Основной функционал — в /chat.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
