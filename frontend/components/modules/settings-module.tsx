"use client";

import * as React from "react";
import { AlertTriangle, Star } from "lucide-react";

// The settings screen is driven by the selected shopId (passed from the page).
import { getSettings, updateSettings, getShop } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented-control";

type ReplyMode = "manual" | "semi" | "auto";

type Settings = {
  shop_id: number;

  auto_sync: boolean;
  reply_mode: ReplyMode;
  auto_draft: boolean;
  auto_publish: boolean;
  rating_mode_map: Record<string, ReplyMode>;
  min_rating_to_autopublish: number;

  language: string;
  tone: string;
  signature: string | null;
  signatures: string[];

  blacklist_keywords: string[];
  whitelist_keywords: string[];

  templates: Record<string, string>;

  chat_enabled: boolean;
  chat_auto_reply: boolean;

  questions_reply_mode: ReplyMode;
  questions_auto_draft: boolean;
  questions_auto_publish: boolean;

  config: Record<string, unknown>;
};

function normalizeMode(v: unknown): "semi" | "auto" {
  return v === "auto" ? "auto" : "semi";
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-current" />
      ))}
    </div>
  );
}

export function SettingsModule({ shopId }: { shopId: number | null }) {

  const [shopName, setShopName] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [draft, setDraft] = React.useState<Settings | null>(null);

  const refresh = React.useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, shop] = await Promise.all([
        getSettings(shopId) as Promise<Settings>,
        getShop(shopId).catch(() => null as any),
      ]);
      setShopName(shop?.name ?? null);
      setSettings(s);
      setDraft(s);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const save = React.useCallback(async () => {
    if (!shopId || !draft) return;
    setSaving(true);
    setError(null);
    try {
      // Send only updatable fields; backend accepts partial updates.
      await updateSettings(shopId, {
        auto_sync: draft.auto_sync,
        reply_mode: draft.reply_mode,
        auto_draft: draft.auto_draft,
        auto_publish: draft.auto_publish,
        rating_mode_map: draft.rating_mode_map,
        min_rating_to_autopublish: draft.min_rating_to_autopublish,
        language: draft.language,
        tone: draft.tone,
        signature: draft.signature,
        signatures: draft.signatures,
        blacklist_keywords: draft.blacklist_keywords,
        whitelist_keywords: draft.whitelist_keywords,
        templates: draft.templates,
        chat_enabled: draft.chat_enabled,
        chat_auto_reply: draft.chat_auto_reply,
        questions_reply_mode: draft.questions_reply_mode,
        questions_auto_draft: draft.questions_auto_draft,
        questions_auto_publish: draft.questions_auto_publish,
        config: draft.config,
      });
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  }, [shopId, draft, refresh]);

  const shopLabel = shopName ?? (shopId ? `#${shopId}` : "");

  const settingsReady = Boolean(
    draft &&
      draft.language &&
      draft.tone &&
      (draft.signature !== null ? true : true)
  );

  if (!shopId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Сначала выберите магазин.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Магазин «{shopLabel || "—"}»</h1>
            <p className="text-sm text-muted-foreground">Wildberries · Подключен через ЛК Wildberries</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading || saving}>
              Обновить
            </Button>
            <Button onClick={save} disabled={loading || saving || !draft}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </div>

        {!settingsReady && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Настройка магазина не завершена, ответы могут не генерироваться.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <Tabs defaultValue="feedbacks" className="space-y-4">
        <TabsList className="w-full justify-start overflow-auto">
          <TabsTrigger value="feedbacks">Режим ответов на отзывы</TabsTrigger>
          <TabsTrigger value="recommendations">Рекомендации</TabsTrigger>
          <TabsTrigger value="signature">Подпись к ответу</TabsTrigger>
          <TabsTrigger value="questions">Режим ответов на вопросы</TabsTrigger>
          <TabsTrigger value="advanced">Расширенные настройки</TabsTrigger>
          <TabsTrigger value="ai">Обучение ИИ</TabsTrigger>
          <TabsTrigger value="chats">Чаты</TabsTrigger>
        </TabsList>

        <TabsContent value="feedbacks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Режим ответов на отзывы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Выберите режим автогенерации ответов на поступающие отзывы.
              </p>

              {draft ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((r) => {
                    const key = String(r);
                    const current = normalizeMode(draft.rating_mode_map?.[key]);

                    return (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <Stars count={r} />

                        <SegmentedControl
                          value={current}
                          onValueChange={(v) =>
                            setDraft((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                rating_mode_map: {
                                  ...prev.rating_mode_map,
                                  [key]: v,
                                },
                              };
                            })
                          }
                          options={[
                            { value: "semi", label: "Полуавтоматический" },
                            { value: "auto", label: "Автоматический" },
                          ]}
                        />
                      </div>
                    );
                  })}

                  <div className="pt-2">
                    <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
                      Продолжить
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Загрузка…</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Базовые параметры</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Автосинхронизация</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={Boolean(draft?.auto_sync)}
                    onCheckedChange={(v) => setDraft((p) => (p ? { ...p, auto_sync: v } : p))}
                  />
                  <span className="text-sm text-muted-foreground">Автоматически подтягивать новые отзывы</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Минимальная оценка для автопубликации</Label>
                <Select
                  value={String(draft?.min_rating_to_autopublish ?? 5)}
                  onValueChange={(v) => setDraft((p) => (p ? { ...p, min_rating_to_autopublish: Number(v) } : p))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r}+
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Рекомендации</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Раздел будет добавлен позже (логика рекомендаций зависит от аналитики по товарам и отзывам).
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signature" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Подпись к ответу</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Подпись по умолчанию</Label>
                <Textarea
                  value={draft?.signature || ""}
                  onChange={(e) => setDraft((p) => (p ? { ...p, signature: e.target.value } : p))}
                  rows={3}
                  placeholder="Например: С уважением, команда магазина"
                />
                <p className="text-xs text-muted-foreground">
                  Подпись автоматически добавляется в конец ответа (если включено в шаблоне/настройках генерации).
                </p>
              </div>

              <div className="space-y-2">
                <Label>Список подписей</Label>
                <Textarea
                  value={(draft?.signatures || []).join("\n")}
                  onChange={(e) =>
                    setDraft((p) =>
                      p
                        ? {
                            ...p,
                            signatures: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : p
                    )
                  }
                  rows={4}
                  placeholder="Каждая подпись — с новой строки"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Режим ответов на вопросы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Режим</Label>
                    <SegmentedControl
                      value={normalizeMode(draft.questions_reply_mode)}
                      onValueChange={(v) => setDraft((p) => (p ? { ...p, questions_reply_mode: v } : p))}
                      options={[
                        { value: "semi", label: "Полуавтоматический" },
                        { value: "auto", label: "Автоматический" },
                      ]}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Авточерновик</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={Boolean(draft.questions_auto_draft)}
                          onCheckedChange={(v) => setDraft((p) => (p ? { ...p, questions_auto_draft: v } : p))}
                        />
                        <span className="text-sm text-muted-foreground">Создавать черновики автоматически</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Автопубликация</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={Boolean(draft.questions_auto_publish)}
                          onCheckedChange={(v) => setDraft((p) => (p ? { ...p, questions_auto_publish: v } : p))}
                        />
                        <span className="text-sm text-muted-foreground">Публиковать ответы автоматически</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Button onClick={save} disabled={saving}>
                      Сохранить
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Загрузка…</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Расширенные настройки</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Язык</Label>
                <Select value={draft?.language || "ru"} onValueChange={(v) => setDraft((p) => (p ? { ...p, language: v } : p))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите язык" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="uz">O'zbek</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Тон ответов</Label>
                <Select value={draft?.tone || "friendly"} onValueChange={(v) => setDraft((p) => (p ? { ...p, tone: v } : p))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тон" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Дружелюбный</SelectItem>
                    <SelectItem value="neutral">Нейтральный</SelectItem>
                    <SelectItem value="formal">Официальный</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Шаблоны</Label>
                <Textarea
                  value={JSON.stringify(draft?.templates || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || "{}");
                      setDraft((p) => (p ? { ...p, templates: parsed } : p));
                    } catch {
                      // ignore JSON parse errors while typing
                    }
                  }}
                  rows={8}
                  placeholder='{"default": "Спасибо за отзыв…"}'
                />
                <p className="text-xs text-muted-foreground">
                  Формат JSON. Изменения применяются после сохранения.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Ключевые слова (белый список)</Label>
                <Textarea
                  value={(draft?.whitelist_keywords || []).join("\n")}
                  onChange={(e) =>
                    setDraft((p) =>
                      p
                        ? {
                            ...p,
                            whitelist_keywords: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : p
                    )
                  }
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label>Ключевые слова (черный список)</Label>
                <Textarea
                  value={(draft?.blacklist_keywords || []).join("\n")}
                  onChange={(e) =>
                    setDraft((p) =>
                      p
                        ? {
                            ...p,
                            blacklist_keywords: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : p
                    )
                  }
                  rows={6}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Дополнительная конфигурация (config)</Label>
                <Textarea
                  value={JSON.stringify(draft?.config || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || "{}");
                      setDraft((p) => (p ? { ...p, config: parsed } : p));
                    } catch {
                      // ignore JSON parse errors
                    }
                  }}
                  rows={10}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Обучение ИИ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Этот раздел подготовлен как место для будущих настроек обучения (дополнительные инструкции, тональность
                по категориям, примеры ответов и т. п.).
              </p>

              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Сейчас в API нет отдельного эндпоинта для обучения, поэтому раздел отображается как заглушка.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Чаты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Включить чаты</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(draft?.chat_enabled)}
                      onCheckedChange={(v) => setDraft((p) => (p ? { ...p, chat_enabled: v } : p))}
                    />
                    <span className="text-sm text-muted-foreground">Показывать раздел чатов и синхронизировать</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Автоответ в чате</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(draft?.chat_auto_reply)}
                      onCheckedChange={(v) => setDraft((p) => (p ? { ...p, chat_auto_reply: v } : p))}
                    />
                    <span className="text-sm text-muted-foreground">Автоматически предлагать/отправлять ответы</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={save} disabled={saving}>
                  Сохранить
                </Button>
                <Button variant="outline" asChild>
                  <a href="/chat">Открыть чаты</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      )}
    </div>
  );
}

// Default export for pages importing without braces
export default SettingsModule;
