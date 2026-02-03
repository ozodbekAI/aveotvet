"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Link2,
  Star,
  Trash2,
  Plus,
  X,
  Sparkles,
  Wand2,
  AlertCircle,
  CheckCircle2,
  Zap,
  Eye,
  Hand,
  Check,
  Pencil,
} from "lucide-react";

import { getSettings, updateSettings, getShop, getToneOptions, getShopBrands } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReplyMode = "manual" | "semi" | "auto";
type WorkMode = "autopilot" | "control" | "manual";

type SignatureItem = {
  text: string;
  brand: string;
  created_at?: string;
};

type Settings = {
  shop_id: number;
  automation_enabled?: boolean;
  auto_sync?: boolean;
  reply_mode?: string;
  auto_draft?: boolean;
  auto_publish?: boolean;
  auto_draft_limit_per_sync?: number;
  min_rating_to_autopublish?: number;
  language?: string;
  tone?: string;
  signature?: string | null;
  blacklist_keywords?: any[];
  whitelist_keywords?: any[];
  templates?: Record<string, any>;
  chat_enabled?: boolean;
  chat_auto_reply?: boolean;
  rating_mode_map: Record<string, ReplyMode>;
  questions_reply_mode: ReplyMode;
  questions_auto_draft: boolean;
  questions_auto_publish: boolean;
  signatures: Array<string | SignatureItem>;
  config: Record<string, any>;
};

const FALLBACK_TONE_OPTIONS: Array<{ value: string; label: string; hint?: string | null; example?: string | null }> = [
  { value: "none", label: "Без тональности", hint: "Настройка по умолчанию. Тональность отключена." },
  { value: "business", label: "Деловая", hint: "Подходит для официальных ответов." },
  { value: "friendly", label: "Дружелюбная", hint: "Создаёт ощущение личного контакта." },
  { value: "joking", label: "Шутливая", hint: "Разряжает обстановку." },
  { value: "serious", label: "Серьёзная", hint: "Подходит для извинений, важных заявлений." },
  { value: "supportive", label: "Ободряющая", hint: "Хороша для ответов на жалобы." },
  { value: "caring", label: "Заботливая", hint: "Уместна в сервисных ответах." },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-5 w-5 fill-primary text-primary" />
      ))}
    </div>
  );
}

function getNested<T>(obj: any, path: string[], fallback: T): T {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object" || !(key in cur)) return fallback;
    cur = cur[key];
  }
  return (cur as T) ?? fallback;
}

function setNested(obj: any, path: string[], value: any) {
  const copy = { ...(obj || {}) };
  let cur: any = copy;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    cur[k] = { ...(cur[k] || {}) };
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
  return copy;
}

function coerceBool(v: any): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes"].includes(s)) return true;
    if (["false", "0", "no"].includes(s)) return false;
  }
  return null;
}

function normalizeSignature(x: string | SignatureItem): SignatureItem {
  if (typeof x === "string") {
    return { text: x, brand: "all" };
  }
  return { text: x.text, brand: x.brand || "all", created_at: x.created_at };
}

function prettyDate(x?: string) {
  if (!x) return "—";
  try {
    const d = new Date(x);
    if (Number.isNaN(d.getTime())) return x;
    return d.toLocaleDateString("ru-RU");
  } catch {
    return x;
  }
}

function getWorkMode(ratingMap: Record<string, ReplyMode>): WorkMode {
  const modes = Object.values(ratingMap);
  const allAuto = modes.every((m) => m === "auto");
  const allManual = modes.every((m) => m === "manual");
  if (allAuto) return "autopilot";
  if (allManual) return "manual";
  return "control";
}

function getRatingMapForMode(mode: WorkMode): Record<string, ReplyMode> {
  if (mode === "autopilot") {
    return { "1": "auto", "2": "auto", "3": "auto", "4": "auto", "5": "auto" };
  }
  if (mode === "manual") {
    return { "1": "manual", "2": "manual", "3": "manual", "4": "manual", "5": "manual" };
  }
  return { "1": "semi", "2": "semi", "3": "semi", "4": "auto", "5": "auto" };
}

export default function SettingsModule({ shopId }: { shopId: number | null }) {
  const router = useRouter();
  const [shopName, setShopName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [onboardingDone, setOnboardingDone] = React.useState<boolean | null>(null);
  const [toneOptions, setToneOptions] = React.useState(FALLBACK_TONE_OPTIONS);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Settings | null>(null);
  const [brands, setBrands] = React.useState<string[]>([]);

  const [signatureOpen, setSignatureOpen] = React.useState(false);
  const [sigBrand, setSigBrand] = React.useState<string>("all");
  const [sigText, setSigText] = React.useState<string>("");
  const [filterBrand, setFilterBrand] = React.useState<string>("all");
  const [reviewsSubtab, setReviewsSubtab] = React.useState<"mode" | "recommendations" | "ai">("mode");

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const opts = await getToneOptions();
        if (mounted && Array.isArray(opts) && opts.length) setToneOptions(opts);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const refresh = React.useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, shop, br] = await Promise.all([
        getSettings(shopId) as Promise<Settings>,
        getShop(shopId).catch(() => null as any),
        getShopBrands(shopId).catch(() => ({ data: [] as string[] })),
      ]);
      
      setShopName(shop?.name ?? null);
      const rawBrands = Array.isArray(br?.data) ? br.data : [];
      const uniq = Array.from(new Set(rawBrands.filter((x) => typeof x === "string" && x.trim())));
      uniq.sort((a, b) => a.localeCompare(b, "ru"));
      setBrands(uniq);

      const normalized: Settings = {
        ...s,
        shop_id: s.shop_id,
        auto_sync: s.auto_sync ?? true,
        reply_mode: s.reply_mode ?? "semi",
        auto_draft: s.auto_draft ?? true,
        auto_publish: s.auto_publish ?? false,
        auto_draft_limit_per_sync: typeof s.auto_draft_limit_per_sync === "number" ? s.auto_draft_limit_per_sync : 0,
        min_rating_to_autopublish: s.min_rating_to_autopublish ?? 4,
        language: s.language ?? "ru",
        tone: s.tone ?? "polite",
        signature: s.signature ?? null,
        blacklist_keywords: s.blacklist_keywords ?? [],
        whitelist_keywords: s.whitelist_keywords ?? [],
        templates: s.templates ?? {},
        chat_enabled: s.chat_enabled ?? true,
        chat_auto_reply: s.chat_auto_reply ?? false,
        rating_mode_map: s.rating_mode_map || { "1": "manual", "2": "manual", "3": "semi", "4": "auto", "5": "auto" },
        questions_reply_mode: s.questions_reply_mode || "manual",
        questions_auto_draft: coerceBool(s.questions_auto_draft) ?? false,
        questions_auto_publish: coerceBool(s.questions_auto_publish) ?? false,
        signatures: Array.isArray(s.signatures) ? s.signatures : [],
        config: s.config || {},
      };
      
      setOnboardingDone(Boolean(s.config?.onboarding?.done));
      setDraft(normalized);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const save = React.useCallback(async () => {
    if (!shopId || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        auto_sync: draft.auto_sync ?? true,
        reply_mode: draft.reply_mode ?? "semi",
        auto_draft: draft.auto_draft ?? true,
        auto_publish: draft.auto_publish ?? false,
        auto_draft_limit_per_sync: draft.auto_draft_limit_per_sync ?? 0,
        rating_mode_map: draft.rating_mode_map,
        min_rating_to_autopublish: draft.min_rating_to_autopublish ?? 4,
        language: draft.language ?? "ru",
        tone: draft.tone ?? "polite",
        signature: draft.signature ?? null,
        signatures: draft.signatures,
        blacklist_keywords: draft.blacklist_keywords ?? [],
        whitelist_keywords: draft.whitelist_keywords ?? [],
        templates: draft.templates ?? {},
        chat_enabled: draft.chat_enabled ?? true,
        chat_auto_reply: draft.chat_auto_reply ?? false,
        questions_reply_mode: draft.questions_reply_mode,
        questions_auto_draft: draft.questions_auto_draft,
        questions_auto_publish: draft.questions_auto_publish,
        config: draft.config || {},
      };
      await updateSettings(shopId, payload);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  }, [shopId, draft, refresh]);

  const shopLabel = shopName ?? (shopId ? `#${shopId}` : "—");

  if (!shopId) {
    return (
      <Card>
        <CardHeader><CardTitle>Настройки</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Сначала выберите магазин.</CardContent>
      </Card>
    );
  }

  const cfg = draft?.config || {};
  const adv = getNested(cfg, ["advanced"], {} as any);
  const chats = getNested(cfg, ["chat"], {} as any);
  
  const emojiEnabled = Boolean(getNested(adv, ["emoji_enabled"], false));
  const photoReactionEnabled = Boolean(getNested(adv, ["photo_reaction_enabled"], false));
  const deliveryMethod = getNested<string | null>(adv, ["delivery_method"], null);
  const stopWords = getNested<string[]>(adv, ["stop_words"], []);
  const tov = getNested<any>(adv, ["tone_of_voice"], {});
  const tonePositive = getNested<string>(tov, ["positive"], "none");

  // Style settings
  const addressFormat = getNested<string>(adv, ["address_format"], "vy_caps");
  const answerLength = getNested<string>(adv, ["answer_length"], "default");
  const useCustomerName = Boolean(getNested(adv, ["use_customer_name"], true));
  const useProductName = Boolean(getNested(adv, ["use_product_name"], true));
  const toneNeutral = getNested<string>(tov, ["neutral"], "none");
  const toneNegative = getNested<string>(tov, ["negative"], "none");

  const confirmSend = Boolean(getNested(chats, ["confirm_send"], true));
  const confirmAiInsert = Boolean(getNested(chats, ["confirm_ai_insert"], true));

  const allSignatures = (draft?.signatures || []).map(normalizeSignature);
  const filteredSignatures = filterBrand === "all" 
    ? allSignatures 
    : allSignatures.filter((s) => s.brand === filterBrand);

  const setAdvanced = (path: string[], value: any) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextConfig = setNested(prev.config || {}, ["advanced", ...path], value);
      return { ...prev, config: nextConfig };
    });
  };

  const setChatCfg = (path: string[], value: any) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextConfig = setNested(prev.config || {}, ["chat", ...path], value);
      return { ...prev, config: nextConfig };
    });
  };

  const setTone = (bucket: "positive" | "neutral" | "negative", value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextConfig = setNested(prev.config || {}, ["advanced", "tone_of_voice"], {
        ...(getNested(prev.config || {}, ["advanced", "tone_of_voice"], {} as any) || {}),
        [bucket]: value,
      });
      return { ...prev, config: nextConfig };
    });
  };

  const workMode = draft ? getWorkMode(draft.rating_mode_map) : "control";

  const setWorkMode = (mode: WorkMode) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const newMap = getRatingMapForMode(mode);
      const autoDraft = mode !== "manual";
      const autoPublish = mode === "autopilot";
      return { 
        ...prev, 
        rating_mode_map: newMap,
        auto_draft: autoDraft,
        auto_publish: autoPublish,
        automation_enabled: mode !== "manual",
      };
    });
  };

  const setQuestionsMode = (mode: ReplyMode) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (mode === "manual") {
        return { ...prev, questions_reply_mode: "manual", questions_auto_draft: false, questions_auto_publish: false };
      }
      if (mode === "semi") {
        return { ...prev, questions_reply_mode: "semi", questions_auto_draft: true, questions_auto_publish: false };
      }
      return { ...prev, questions_reply_mode: "auto", questions_auto_draft: true, questions_auto_publish: true };
    });
  };

  const addSignature = () => {
    const text = sigText.trim();
    if (!text) return;
    const item: SignatureItem = { text, brand: sigBrand || "all", created_at: new Date().toISOString() };
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, signatures: [...(prev.signatures || []), item] };
    });
    setSigText("");
    setSignatureOpen(false);
  };

  const removeSignatureAt = (idx: number) => {
    const target = filteredSignatures[idx];
    setDraft((prev) => {
      if (!prev) return prev;
      const normalized = (prev.signatures || []).map(normalizeSignature);
      const i = normalized.findIndex((s) => s.text === target.text && s.brand === target.brand);
      if (i === -1) return prev;
      const next = [...(prev.signatures || [])];
      next.splice(i, 1);
      return { ...prev, signatures: next };
    });
  };

  const tabTriggerClass = "rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground";
  const subtabClass = "px-4 py-2 text-sm font-medium rounded-lg transition-colors";

  const cardToggle = (title: string, description: string, checked: boolean, onCheckedChange: (v: boolean) => void) => (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );

  const questionsMode = draft?.questions_reply_mode || "manual";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Магазин «{shopLabel}»</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">Wildberries</span>
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Подключение активно
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Link2 className="h-4 w-4 mr-2" />
          Настройки подключения
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {onboardingDone === false && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="font-medium text-amber-900 dark:text-amber-100">
                    Завершите настройку для корректной работы
                  </div>
                  <div className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-4 mt-1">
                    <span className="text-muted-foreground">Подключение магазина</span>
                    <span className="text-muted-foreground">Режим работы</span>
                    <span className="text-muted-foreground">Тон ответов</span>
                    <span className="text-muted-foreground">Подпись</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">0%</span>
                <Button variant="outline" onClick={() => router.push("/app/onboarding")}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Запустить мастер
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!draft && loading && <div className="text-sm text-muted-foreground">Загрузка…</div>}

      <Tabs defaultValue="reviews" className="space-y-6">
        <TabsList className="w-full justify-start gap-1 border-b bg-transparent p-0">
          <TabsTrigger className={tabTriggerClass} value="reviews">Отзывы</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="questions">Вопросы</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="chats">Чаты</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="signatures">Подписи</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="style">Стиль ответов</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-6">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1 w-fit">
            <button
              className={`${subtabClass} ${reviewsSubtab === "mode" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setReviewsSubtab("mode")}
            >
              Режим ответов
            </button>
            <button
              className={`${subtabClass} ${reviewsSubtab === "recommendations" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setReviewsSubtab("recommendations")}
            >
              Рекомендации
            </button>
            <button
              className={`${subtabClass} ${reviewsSubtab === "ai" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setReviewsSubtab("ai")}
            >
              Обучение ИИ
            </button>
          </div>

          {reviewsSubtab === "mode" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Режим работы</CardTitle>
                  <p className="text-sm text-muted-foreground">Выберите, как система будет обрабатывать отзывы</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div
                      className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                        workMode === "autopilot" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setWorkMode("autopilot")}
                    >
                      {workMode === "autopilot" && (
                        <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">Автопилот</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">ИИ делает всё сам</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" />Авто-ответы на 4-5★</div>
                        <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" />Черновики для остальных</div>
                        <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" />Авто-публикация</div>
                      </div>
                    </div>

                    <div
                      className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                        workMode === "control" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setWorkMode("control")}
                    >
                      {workMode === "control" && (
                        <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <Eye className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">Контроль</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">Вы проверяете каждый ответ</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" />ИИ создаёт черновики</div>
                        <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" />Вы публикуете вручную</div>
                        <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" />Полный контроль</div>
                      </div>
                    </div>

                    <div
                      className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                        workMode === "manual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setWorkMode("manual")}
                    >
                      {workMode === "manual" && (
                        <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <Hand className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">Ручной</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">Только показ отзывов</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" />Синхронизация отзывов</div>
                        <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" />Генерация по запросу</div>
                        <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" />Без автоматики</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Режим ответов по рейтингу</CardTitle>
                  <p className="text-sm text-muted-foreground">Детальная настройка режима для каждой оценки</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {draft && [5, 4, 3, 2, 1].map((r) => {
                    const key = String(r);
                    const mode = draft.rating_mode_map?.[key] || "semi";
                    const isSemi = mode === "semi" || mode === "manual";
                    const isAuto = mode === "auto";
                    return (
                      <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                        <Stars count={r} />
                        <div className="flex items-center gap-2">
                          <button
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              isSemi ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                            onClick={() => setDraft((prev) => prev ? { ...prev, rating_mode_map: { ...prev.rating_mode_map, [key]: "semi" }} : prev)}
                          >
                            Полуавтомат
                          </button>
                          <button
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              isAuto ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                            onClick={() => setDraft((prev) => prev ? { ...prev, rating_mode_map: { ...prev.rating_mode_map, [key]: "auto" }} : prev)}
                          >
                            Автомат
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}

          {reviewsSubtab === "recommendations" && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Раздел в разработке</h3>
                  <p className="text-sm text-muted-foreground">Здесь будут настройки рекомендаций товаров в ответах</p>
                </div>
              </CardContent>
            </Card>
          )}

          {reviewsSubtab === "ai" && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Раздел в разработке</h3>
                  <p className="text-sm text-muted-foreground">Здесь будет обучение ИИ на ваших ответах</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="questions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Режим работы</CardTitle>
              <p className="text-sm text-muted-foreground">Выберите, как система будет обрабатывать вопросы</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                    questionsMode === "auto" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setQuestionsMode("auto")}
                >
                  {questionsMode === "auto" && (
                    <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Автопилот</span>
                  </div>
                  <p className="text-sm text-muted-foreground">ИИ делает всё сам</p>
                </div>

                <div
                  className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                    questionsMode === "semi" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setQuestionsMode("semi")}
                >
                  {questionsMode === "semi" && (
                    <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Контроль</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Вы проверяете каждый ответ</p>
                </div>

                <div
                  className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                    questionsMode === "manual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setQuestionsMode("manual")}
                >
                  {questionsMode === "manual" && (
                    <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Hand className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Ручной</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Только показ вопросов</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chats" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Режим работы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cardToggle(
                "Подтверждение отправки сообщения в чат",
                "Если настройка включена, при каждой отправке сообщения будет появляться окно подтверждения",
                confirmSend,
                (v) => setChatCfg(["confirm_send"], v),
              )}
              <Separator />
              {cardToggle(
                "Подтверждение вставки рекомендации ИИ",
                "Перед вставкой рекомендации ИИ будет появляться окно подтверждения",
                confirmAiInsert,
                (v) => setChatCfg(["confirm_ai_insert"], v),
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signatures" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Подписи к ответам</CardTitle>
              <p className="text-sm text-muted-foreground">
                Вы можете задать свой вариант шаблона подписи, который будет добавляться к каждому сгенерированному ответу. 
                При добавлении нескольких вариантов — в ответ подставится одна из них, выбранная случайным образом.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Select value={filterBrand} onValueChange={setFilterBrand}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Все бренды" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все бренды</SelectItem>
                    {brands.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Button className="gap-2 bg-primary" onClick={() => setSignatureOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Добавить подпись
                </Button>
              </div>

              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Подписи</TableHead>
                      <TableHead>Бренд</TableHead>
                      <TableHead>Дата создания</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSignatures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Подписей пока нет</TableCell>
                      </TableRow>
                    ) : (
                      filteredSignatures.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell>{s.text}</TableCell>
                          <TableCell>{s.brand === "all" ? "Все бренды" : s.brand}</TableCell>
                          <TableCell className="text-muted-foreground">{prettyDate(s.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => removeSignatureAt(i)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Sheet open={signatureOpen} onOpenChange={setSignatureOpen}>
            <SheetContent side="right" className="w-full sm:max-w-[520px]">
              <SheetHeader>
                <SheetTitle>Новая подпись</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <Label>Выберите бренд</Label>
                  <Select value={sigBrand} onValueChange={setSigBrand}>
                    <SelectTrigger>
                      <SelectValue placeholder="Для всех брендов" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Для всех брендов</SelectItem>
                      {brands.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Текст подписи</Label>
                  <Textarea
                    value={sigText}
                    onChange={(e) => setSigText(e.target.value)}
                    rows={4}
                    placeholder='Например: "С уважением, команда магазина"'
                  />
                </div>
                <Button onClick={addSignature} className="w-full" disabled={!sigText.trim()}>Сохранить</Button>
              </div>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="style" className="space-y-6">
          {/* Формат обращения */}
          <Card>
            <CardHeader>
              <CardTitle>Формат обращения</CardTitle>
              <p className="text-sm text-muted-foreground">Употребление в ответах обращения на Вы, Вас, Вам или т.п.</p>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={addressFormat} 
                onValueChange={(v) => setAdvanced(["address_format"], v)}
                className="space-y-2"
              >
                {[
                  { value: "vy_caps", label: "Обращение на «Вы»", hint: "Вы, Ваш, Вам — с заглавной буквы" },
                  { value: "vy_lower", label: "Обращение на «вы»", hint: "вы, ваш, вам — со строчной буквы" },
                  { value: "ty", label: "Обращение на «ты»", hint: "ты, твой — неформальный стиль" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <RadioGroupItem value={opt.value} />
                    <span className="font-medium">{opt.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Персонализация ответов */}
          <Card>
            <CardHeader>
              <CardTitle>Персонализация ответов</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y">
              {cardToggle(
                "Обращение по имени",
                "Употребление в ответе обращения к покупателю по имени из его профиля",
                useCustomerName,
                (v) => setAdvanced(["use_customer_name"], v),
              )}
              {cardToggle(
                "Упоминание названия товара",
                "Употребление в ответе названия товара из его карточки",
                useProductName,
                (v) => setAdvanced(["use_product_name"], v),
              )}
            </CardContent>
          </Card>

          {/* Длина ответа */}
          <Card>
            <CardHeader>
              <CardTitle>Длина ответа</CardTitle>
              <p className="text-sm text-muted-foreground">Настройка количества текста в сгенерированном ответе</p>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={answerLength} 
                onValueChange={(v) => setAdvanced(["answer_length"], v)}
                className="space-y-2"
              >
                {[
                  { value: "short", label: "Краткий ответ", hint: "1–2 предложения" },
                  { value: "default", label: "По умолчанию", hint: "2–4 предложения" },
                  { value: "long", label: "Развёрнутый ответ", hint: "4–6 предложений" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <RadioGroupItem value={opt.value} />
                    <span className="font-medium">{opt.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Дополнительные опции */}
          <Card>
            <CardHeader>
              <CardTitle>Дополнительные опции</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y">
              {cardToggle(
                "Эмодзи в ответах",
                "Использование эмодзи в ответах на отзывы. Эмодзи подбираются автоматически",
                emojiEnabled,
                (v) => setAdvanced(["emoji_enabled"], v),
              )}
              {cardToggle(
                "Реакция на фото",
                "Благодарить покупателей за приложенные фотографии в отзывах",
                photoReactionEnabled,
                (v) => setAdvanced(["photo_reaction_enabled"], v),
              )}
              <div className="py-4">
                <div className="text-sm font-medium">Способ доставки</div>
                <div className="mt-1 text-sm text-muted-foreground mb-3">Выбранный способ доставки влияет на ответы ИИ</div>
                <Select value={deliveryMethod || "none"} onValueChange={(v) => setAdvanced(["delivery_method"], v === "none" ? null : v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Не выбрано" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не выбрано</SelectItem>
                    <SelectItem value="courier">Курьер</SelectItem>
                    <SelectItem value="pickup">ПВЗ</SelectItem>
                    <SelectItem value="post">Почта</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Tone of voice</CardTitle>
                <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">NEW</span>
              </div>
              <p className="text-sm text-muted-foreground">Выбранные тональности будут влиять на стиль ответов</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Для положительных отзывов</Label>
                <Select value={tonePositive} onValueChange={(v) => setTone("positive", v)}>
                  <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Для нейтральных отзывов</Label>
                <Select value={toneNeutral} onValueChange={(v) => setTone("neutral", v)}>
                  <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Для отрицательных отзывов</Label>
                <Select value={toneNegative} onValueChange={(v) => setTone("negative", v)}>
                  <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="link" className="h-auto p-0 text-primary">Посмотреть примеры тональностей</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Стоп-слова</CardTitle>
              <p className="text-sm text-muted-foreground">Слова/фразы, которые нельзя использовать в ответах</p>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={stopWords.join("\n")}
                onChange={(e) => setAdvanced(["stop_words"], e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
                placeholder="Каждое стоп-слово — с новой строки"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={refresh} disabled={loading || saving}>Отменить</Button>
        <Button onClick={save} disabled={loading || saving || !draft}>{saving ? "Сохранение…" : "Сохранить изменения"}</Button>
      </div>
    </div>
  );
}
