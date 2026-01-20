"use client";

import * as React from "react";
import {
  AlertTriangle,
  Link2,
  Star,
  Trash2,
  Plus,
  X,
  Sparkles,
} from "lucide-react";

import { getSettings, updateSettings, getShop, getToneOptions, getShopBrands } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReplyMode = "manual" | "semi" | "auto";

type SignatureType = "review" | "question" | "chat";

type SignatureItem = {
  text: string;
  type: SignatureType;
  brand: string; // e.g. "all" or specific
  created_at?: string;
};

type Settings = {
  shop_id: number;

  // Master run switch
  automation_enabled?: boolean;

  // Eski fieldlar (legacy, lekin backend kutadi)
  auto_sync?: boolean;
  reply_mode?: string;
  auto_draft?: boolean;
  auto_publish?: boolean;
  auto_draft_limit_per_sync?: number;
  min_rating_to_autopublish?: number;
  language?: string;
  tone?: string;
  signature?: string | null;
  
  // Keywords va templates
  blacklist_keywords?: any[];
  whitelist_keywords?: any[];
  templates?: Record<string, any>;
  
  // Chat eski fieldlar
  chat_enabled?: boolean;
  chat_auto_reply?: boolean;

  // Reviews - rating-based workflow
  rating_mode_map: Record<string, ReplyMode>;

  // Questions
  questions_reply_mode: ReplyMode;
  questions_auto_draft: boolean;
  questions_auto_publish: boolean;

  // Signatures
  signatures: Array<string | SignatureItem>;

  // Config (yangi strukturali)
  config: Record<string, any>;
};

const FALLBACK_TONE_OPTIONS: Array<{ value: string; label: string; hint?: string }> = [
  { value: "none", label: "Без тональности", hint: "Настройка по умолчанию. Тональность отключена." },
  { value: "business", label: "Деловая", hint: "Подходит для официальных ответов." },
  { value: "joking", label: "Шутливая", hint: "Разряжает обстановку." },
  { value: "serious", label: "Серьёзная", hint: "Подходит для извинений, важных заявлений." },
  { value: "supportive", label: "Ободряющая", hint: "Хороша для ответов на жалобы или неуверенные вопросы." },
  { value: "caring", label: "Заботливая", hint: "Уместна в сервисных ответах, поддержке." },
  { value: "fun", label: "Весёлая", hint: "Поднимает настроение, подходит для брендов с неформальным стилем." },
  { value: "friendly", label: "Дружелюбная", hint: "Создаёт ощущение личного контакта." },
  { value: "chatty", label: "Болтливая", hint: "Подходит для неформального общения." },
  { value: "respectful", label: "Уважительная", hint: "Универсальна для любых ситуаций." },
  { value: "poetic", label: "Поэтическая", hint: "Запоминается, создаёт художественный образ." },
  { value: "dramatic", label: "Драматическая", hint: "Запоминается, хороша для творческих ответов." },
  { value: "scientific", label: "Научная", hint: "Хороша для сложных продуктов, медицины." },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-current" />
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
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
    return Boolean(v);
  }
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
  }
  return null;
}

function normalizeConfigForApi(cfg: any) {
  const out: any = cfg && typeof cfg === "object" ? JSON.parse(JSON.stringify(cfg)) : {};

  // Advanced settings
  const adv: any = out.advanced && typeof out.advanced === "object" ? out.advanced : {};
  
  // Address format normalization
  const rawAf = adv.address_format;
  if (rawAf !== undefined) {
    if (rawAf && typeof rawAf === "object" && "value" in rawAf) {
      adv.address_format = rawAf.value;
    }
    if (typeof adv.address_format === "string") {
      const v = adv.address_format.trim().toLowerCase();
      const aliases: Record<string, string> = {
        vy: "vy_caps",
        vycaps: "vy_caps",
        "vy-caps": "vy_caps",
        vy_upper: "vy_caps",
        vyupper: "vy_caps",
        vy_cap: "vy_caps",
        vy_lowercase: "vy_lower",
        vylower: "vy_lower",
        "vy-lower": "vy_lower",
        "вы": "vy_lower",
        "ты": "ty",
      };
      adv.address_format = aliases[v] ?? v;
    }
    // Agar qiymat noto'g'ri bo'lsa, o'chirish
    if (!["vy_caps", "vy_lower", "ty"].includes(adv.address_format)) {
      delete adv.address_format;
    }
  }

  // Boolean fields - faqat agar qiymat berilgan bo'lsa
  for (const k of ["use_buyer_name", "mention_product_name", "emoji_enabled", "photo_reaction_enabled"]) {
    if (k in adv) {
      const b = coerceBool(adv[k]);
      if (b !== null) {
        adv[k] = b;
      } else {
        delete adv[k]; // Noto'g'ri qiymatni o'chirish
      }
    }
  }

  // Agar advanced bo'sh bo'lsa, uni qo'shmaslik
  if (Object.keys(adv).length > 0) {
    out.advanced = adv;
  }

  // Chat settings
  const chat: any = out.chat && typeof out.chat === "object" ? out.chat : {};
  for (const k of ["confirm_send", "confirm_ai_insert"]) {
    if (k in chat) {
      const b = coerceBool(chat[k]);
      if (b !== null) {
        chat[k] = b;
      } else {
        delete chat[k];
      }
    }
  }
  if (Object.keys(chat).length > 0) {
    out.chat = chat;
  }

  // Recommendations
  const rec: any = out.recommendations && typeof out.recommendations === "object" ? out.recommendations : {};
  if ("enabled" in rec) {
    const b = coerceBool(rec.enabled);
    if (b !== null) {
      rec.enabled = b;
    } else {
      delete rec.enabled;
    }
  }
  if (Object.keys(rec).length > 0) {
    out.recommendations = rec;
  }

  return out;
}

function normalizeSignature(x: string | SignatureItem): SignatureItem {
  if (typeof x === "string") {
    return { text: x, type: "review", brand: "all" };
  }
  return {
    text: x.text,
    type: x.type || "review",
    brand: x.brand || "all",
    created_at: x.created_at,
  };
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

export default function SettingsModule({ shopId }: { shopId: number | null }) {
  const [shopName, setShopName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [toneOptions, setToneOptions] = React.useState(FALLBACK_TONE_OPTIONS);

  React.useEffect(() => {
    let mounted = true;
    ;(async () => {
      try {
        const opts = await getToneOptions();
        if (mounted && Array.isArray(opts) && opts.length) setToneOptions(opts);
      } catch {
        // keep fallback
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const [error, setError] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState<Settings | null>(null);

  // Brands (from WB analytics via backend)
  const [brands, setBrands] = React.useState<string[]>([]);

  // Signature UI state
  const [signatureOpen, setSignatureOpen] = React.useState(false);
  const [sigType, setSigType] = React.useState<SignatureType>("review");
  const [sigBrand, setSigBrand] = React.useState<string>("all");
  const [sigText, setSigText] = React.useState<string>("");
  const [filterType, setFilterType] = React.useState<string>("all");
  const [filterBrand, setFilterBrand] = React.useState<string>("all");

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

      // Normalize brand list (unique + sorted, keep deterministic)
      const rawBrands = Array.isArray(br?.data) ? br.data : [];
      const uniq = Array.from(
        new Map(rawBrands.filter((x) => typeof x === "string" && x.trim()).map((x) => [x.trim().toLowerCase(), x.trim()])).values()
      );
      uniq.sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));
      setBrands(uniq);

      // Map lowercased brand -> canonical brand (from WB)
      const brandMap = new Map<string, string>(uniq.map((b) => [b.toLowerCase(), b]));
      
      // Barcha fieldlarni normalize qilish
      const normalized: Settings = {
        ...s,
        shop_id: s.shop_id,
        
        // Eski fieldlar
        auto_sync: s.auto_sync ?? true,
        reply_mode: s.reply_mode ?? "semi",
        auto_draft: s.auto_draft ?? true,
        auto_publish: s.auto_publish ?? false,
        auto_draft_limit_per_sync:
          typeof (s as any).auto_draft_limit_per_sync === "number" ? (s as any).auto_draft_limit_per_sync : 0,
        min_rating_to_autopublish: s.min_rating_to_autopublish ?? 4,
        language: s.language ?? "ru",
        tone: s.tone ?? "polite",
        signature: s.signature ?? null,
        
        blacklist_keywords: s.blacklist_keywords ?? [],
        whitelist_keywords: s.whitelist_keywords ?? [],
        templates: s.templates ?? {},
        
        chat_enabled: s.chat_enabled ?? true,
        chat_auto_reply: s.chat_auto_reply ?? false,
        
        // Rating workflow
        rating_mode_map: s.rating_mode_map || { 
          "1": "manual", 
          "2": "manual", 
          "3": "semi", 
          "4": "auto", 
          "5": "auto" 
        },
        
        // Questions workflow
        questions_reply_mode: s.questions_reply_mode || "manual",
        questions_auto_draft: coerceBool(s.questions_auto_draft) ?? false,
        questions_auto_publish: coerceBool(s.questions_auto_publish) ?? false,
        
        // Signatures
        // Normalize existing signature brands so old values like "avemod" become "Avemod"
        signatures: Array.isArray(s.signatures)
          ? (s.signatures as any[]).map((it) => {
              if (typeof it === "string") return it;
              if (it && typeof it === "object") {
                const rawBrand = typeof it.brand === "string" ? it.brand.trim() : "all";
                if (rawBrand && rawBrand !== "all") {
                  const canon = brandMap.get(rawBrand.toLowerCase());
                  return { ...it, brand: canon ?? rawBrand };
                }
              }
              return it;
            })
          : [],
        
        // Config
        config: s.config || {},
      };
      
      setDraft(normalized);
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
      const normalizedConfig = normalizeConfigForApi(draft.config);
      
      // BARCHA fieldlarni yuborish (backend schema bilan mos)
      const payload = {
        // Auto-sync va asosiy sozlamalar (eski, lekin backend kutadi)
        auto_sync: draft.auto_sync ?? true,
        reply_mode: draft.reply_mode ?? "semi",
        auto_draft: draft.auto_draft ?? true,
        auto_publish: draft.auto_publish ?? false,
        auto_draft_limit_per_sync: draft.auto_draft_limit_per_sync ?? 0,
        
        // Rating-based workflow
        rating_mode_map: draft.rating_mode_map,
        min_rating_to_autopublish: draft.min_rating_to_autopublish ?? 4,
        
        // Language & tone (eski fieldlar)
        language: draft.language ?? "ru",
        tone: draft.tone ?? "polite",
        signature: draft.signature ?? null,
        
        // Signatures (yangi)
        signatures: draft.signatures,
        
        // Keywords
        blacklist_keywords: draft.blacklist_keywords ?? [],
        whitelist_keywords: draft.whitelist_keywords ?? [],
        templates: draft.templates ?? {},
        
        // Chat settings (eski)
        chat_enabled: draft.chat_enabled ?? true,
        chat_auto_reply: draft.chat_auto_reply ?? false,
        
        // Questions workflow
        questions_reply_mode: draft.questions_reply_mode,
        questions_auto_draft: draft.questions_auto_draft,
        questions_auto_publish: draft.questions_auto_publish,
        
        // Config (advanced, chat, recommendations)
        config: normalizedConfig,
      };
      
      console.log("=== SENDING ===", payload);
      
      const response = await updateSettings(shopId, payload);
      
      console.log("=== RESPONSE ===", response);
      
      await refresh();
    } catch (e: any) {
      console.error("Save error details:", e);
      setError(e?.message || "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  }, [shopId, draft, refresh]);

  const shopLabel = shopName ?? (shopId ? `#${shopId}` : "—");

  if (!shopId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Сначала выберите магазин.</CardContent>
      </Card>
    );
  }

  const cfg = draft?.config || {};
  const adv = getNested(cfg, ["advanced"], {} as any);
  const chats = getNested(cfg, ["chat"], {} as any);
  const recs = getNested(cfg, ["recommendations"], {} as any);

  // Backward compatible: older configs used "vy". Backend expects vy_caps|vy_lower|ty.
  const addressFormatRaw = getNested<string>(adv, ["address_format"], "vy_caps");
  const addressFormat = addressFormatRaw === "vy" ? "vy_caps" : addressFormatRaw;
  const useBuyerName = Boolean(getNested(adv, ["use_buyer_name"], false));
  const mentionProduct = Boolean(getNested(adv, ["mention_product_name"], false));
  const answerLength = getNested<string>(adv, ["answer_length"], "default");
  const emojiEnabled = Boolean(getNested(adv, ["emoji_enabled"], false));
  const photoReactionEnabled = Boolean(getNested(adv, ["photo_reaction_enabled"], false));
  const deliveryMethod = getNested<string | null>(adv, ["delivery_method"], null);
  const stopWords = getNested<string[]>(adv, ["stop_words"], []);
  const tov = getNested<any>(adv, ["tone_of_voice"], {});
  const tonePositive = getNested<string>(tov, ["positive"], "none");
  const toneNeutral = getNested<string>(tov, ["neutral"], "none");
  const toneNegative = getNested<string>(tov, ["negative"], "none");
  const toneQuestion = getNested<string>(tov, ["question"], "none");

  const confirmSend = Boolean(getNested(chats, ["confirm_send"], true));
  const confirmAiInsert = Boolean(getNested(chats, ["confirm_ai_insert"], true));
  const recommendEnabled = Boolean(getNested(recs, ["enabled"], false));

  const allSignatures = (draft?.signatures || []).map(normalizeSignature);
  const filteredSignatures = allSignatures.filter((s) => {
    const typeOk = filterType === "all" ? true : s.type === filterType;
    const brandOk = filterBrand === "all" ? true : s.brand === filterBrand;
    return typeOk && brandOk;
  });

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

  const setRecsCfg = (path: string[], value: any) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextConfig = setNested(prev.config || {}, ["recommendations", ...path], value);
      return { ...prev, config: nextConfig };
    });
  };

  const setTone = (bucket: "positive" | "neutral" | "negative" | "question", value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextConfig = setNested(prev.config || {}, ["advanced", "tone_of_voice"], {
        ...(getNested(prev.config || {}, ["advanced", "tone_of_voice"], {} as any) || {}),
        [bucket]: value,
      });
      return { ...prev, config: nextConfig };
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
    const item: SignatureItem = {
      text,
      type: sigType,
      brand: sigBrand || "all",
      created_at: new Date().toISOString(),
    };
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, signatures: [...(prev.signatures || []), item] };
    });
    setSigText("");
    setSignatureOpen(false);
  };

  const removeSignatureAt = (indexInFiltered: number) => {
    // Need to remove the actual instance (by position) from original array.
    const target = filteredSignatures[indexInFiltered];
    setDraft((prev) => {
      if (!prev) return prev;
      const normalized = (prev.signatures || []).map(normalizeSignature);
      const idx = normalized.findIndex(
        (s) => s.text === target.text && s.type === target.type && s.brand === target.brand && s.created_at === target.created_at,
      );
      if (idx === -1) return prev;
      const next = [...(prev.signatures || [])];
      next.splice(idx, 1);
      return { ...prev, signatures: next };
    });
  };

  const tabTriggerClass =
    "rounded-none border-b-2 border-transparent px-2 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground";

  const cardToggle = (title: string, description: string, checked: boolean, onCheckedChange: (v: boolean) => void) => (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Магазин «{shopLabel}»</h1>
          <p className="text-sm text-muted-foreground">Wildberries · Подключен через ЛК Wildberries</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" className="gap-2" disabled>
            <Link2 className="h-4 w-4" />
            Настройки подключения
          </Button>
          <Button variant="ghost" size="icon" disabled title="Удалить магазин (пока недоступно)">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={refresh} disabled={loading || saving}>
            Обновить
          </Button>
          <Button onClick={save} disabled={loading || saving || !draft}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!draft && loading && <div className="text-sm text-muted-foreground">Загрузка…</div>}

      {/* Tabs */}
      <Tabs defaultValue="reviews" className="space-y-6">
        <TabsList className="w-full justify-start gap-6 border-b bg-transparent p-0">
          <TabsTrigger className={tabTriggerClass} value="reviews">
            Режим ответов на отзывы
          </TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="recommendations">
            Рекомендации
          </TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="signature">
            Подпись к ответу
          </TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="questions">
            Режим ответов на вопросы
          </TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="advanced">
            Расширенные настройки
          </TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="ai">
            Обучение ИИ
          </TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="chats">
            Чаты
          </TabsTrigger>
        </TabsList>

        {/* Reviews */}
        <TabsContent value="reviews" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Синхронизация и лимиты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Старт автогенерации черновиков (Старт/Стоп)</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Управляет только автогенерацией черновиков по отзывам. Синхронизация отзывов/карточек и другие функции продолжают работать независимо.
                  </div>
                </div>
                <Switch
                  checked={Boolean(draft?.automation_enabled)}
                  onCheckedChange={(v) => {
                    if (v) {
                      const ok = window.confirm(
                        "Перед запуском убедитесь, что настройки магазина заполнены корректно (токен WB, язык, тон, подписи и лимиты). Продолжить?"
                      )
                      if (!ok) return
                    }
                    setDraft((prev) => (prev ? { ...prev, automation_enabled: v } : prev))
                  }}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Автосинхронизация</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Рекомендуется держать включённой. Система будет периодически забирать новые отзывы и вопросы.
                  </div>
                </div>
                <Switch
                  checked={Boolean(draft?.auto_sync)}
                  onCheckedChange={(v) => setDraft((prev) => (prev ? { ...prev, auto_sync: v } : prev))}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">Автогенерация черновиков</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Если включено, ответы будут создаваться автоматически и попадать в «Черновики».
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(draft?.auto_draft)}
                      onCheckedChange={(v) => setDraft((prev) => (prev ? { ...prev, auto_draft: v } : prev))}
                    />
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">Автопубликация</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Если включено, ответы могут публиковаться автоматически (в зависимости от оценки).
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(draft?.auto_publish)}
                      onCheckedChange={(v) => setDraft((prev) => (prev ? { ...prev, auto_publish: v } : prev))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Лимит автогенерации за 1 синхронизацию</Label>
                  <Input
                    type="number"
                    min={0}
                    max={5000}
                    value={draft?.auto_draft_limit_per_sync ?? 0}
                    onChange={(e) => {
                      const raw = e.target.value
                      const n = raw === "" ? 0 : Number.parseInt(raw, 10)
                      const v = Number.isFinite(n) ? Math.max(0, Math.min(5000, n)) : 0
                      setDraft((prev) => (prev ? { ...prev, auto_draft_limit_per_sync: v } : prev))
                    }}
                  />
                  <div className="text-xs text-muted-foreground">
                    0 — без ограничений. Пример: 30 — сгенерировать максимум 30 ответов за один цикл.
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Минимальная оценка для автопубликации</Label>
                  <Select
                    value={String(draft?.min_rating_to_autopublish ?? 4)}
                    onValueChange={(v) => setDraft((prev) => (prev ? { ...prev, min_rating_to_autopublish: Number(v) } : prev))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    Например, 4 — публиковать автоматически только отзывы с оценкой 4–5.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Режим ответов на отзывы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Выберите режим автогенерации ответов на поступающие отзывы.</p>
              {draft ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((r) => {
                    const key = String(r);
                    const current = (draft.rating_mode_map?.[key] === "auto" ? "auto" : "semi") as "semi" | "auto";
                    return (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <Stars count={r} />
                        <SegmentedControl
                          value={current}
                          onValueChange={(v) =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    rating_mode_map: { ...(prev.rating_mode_map || {}), [key]: v },
                                  }
                                : prev,
                            )
                          }
                          options={[
                            { value: "semi", label: "Полуавтоматический" },
                            { value: "auto", label: "Автоматический" },
                          ]}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Загрузка…</div>
              )}
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Режимы влияют на то, будет ли ответ требовать подтверждение или отправляться автоматически.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations" className="space-y-6">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4" />
              <div>
                <div className="text-sm font-medium">Воспользуйтесь автозаполнением</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Включите продвинутые рекомендации и выберите автоматическое заполнение. Нейросеть сама подберёт товары
                  из каталога вашего магазина.
                </div>
              </div>
            </div>
          </div>

          {cardToggle(
            "Рекомендовать товары",
            "При включенной настройке в ответе рекомендуются товары",
            recommendEnabled,
            (v) => setRecsCfg(["enabled"], v),
          )}
        </TabsContent>

        {/* Signature */}
        <TabsContent value="signature" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Подпись к ответу</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Вы можете задать свой вариант шаблона подписи, который будет добавляться к каждому сгенерированному ответу.
                При добавлении нескольких вариантов — в ответ подставится одна из них, выбранная случайным образом.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Тип ответа" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Тип ответа</SelectItem>
                      <SelectItem value="review">Отзыв</SelectItem>
                      <SelectItem value="question">Вопрос</SelectItem>
                      <SelectItem value="chat">Чат</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterBrand} onValueChange={setFilterBrand}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Все бренды" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все бренды</SelectItem>
                      {brands.length ? (
                        brands.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__none" disabled>
                          Нет брендов (проверьте WB-токен)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button className="gap-2" onClick={() => setSignatureOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Добавить подпись
                </Button>
              </div>

              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Подписи</TableHead>
                      <TableHead>Тип ответа</TableHead>
                      <TableHead className="text-right">Дата создания</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSignatures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-sm text-muted-foreground">
                          Подписей пока нет.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSignatures.map((s, i) => (
                        <TableRow key={`${s.type}-${s.brand}-${s.created_at}-${i}`}>
                          <TableCell className="whitespace-normal">
                            <div className="font-medium">{s.brand === "all" ? "" : s.brand}</div>
                            <div className="text-sm text-muted-foreground">{s.text}</div>
                          </TableCell>
                          <TableCell>
                            {s.type === "review" ? "Отзыв" : s.type === "question" ? "Вопрос" : "Чат"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{prettyDate(s.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSignatureAt(i)}
                              title="Удалить"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
                <div className="flex items-center justify-between">
                  <SheetTitle>Новая подпись</SheetTitle>
                  <Button variant="ghost" size="icon" onClick={() => setSignatureOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Выберите тип ответа</Label>
                    <Select value={sigType} onValueChange={(v) => setSigType(v as SignatureType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Тип ответа" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="review">Отзыв</SelectItem>
                        <SelectItem value="question">Вопрос</SelectItem>
                        <SelectItem value="chat">Чат</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Выберите бренд</Label>
                    <Select value={sigBrand} onValueChange={setSigBrand}>
                      <SelectTrigger>
                        <SelectValue placeholder="Для всех брендов" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Для всех брендов</SelectItem>
                        {brands.length ? (
                          brands.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__none" disabled>
                            Нет брендов (проверьте WB-токен)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Введите текст подписи</Label>
                  <div className="relative">
                    <Textarea
                      value={sigText}
                      onChange={(e) => setSigText(e.target.value)}
                      rows={10}
                      placeholder='Введите свой вариант шаблона подписи в этом поле, например: "С уважением, команда бренда!"'
                    />
                    <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">{sigText.length}/300</div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={addSignature} className="gap-2" disabled={!sigText.trim() || sigText.trim().length > 300}>
                    Сохранить
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* Questions */}
        <TabsContent value="questions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Режим ответов на вопросы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Выберите режим автогенерации ответов на поступающие вопросы.</p>

              <RadioGroup
                value={draft?.questions_reply_mode || "manual"}
                onValueChange={(v) => setQuestionsMode(v as ReplyMode)}
                className="space-y-3"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
                  <RadioGroupItem value="manual" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Отключен</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Ответы не предлагаются автоматически. Вы можете просматривать поступающие вопросы и отвечать вручную.
                    </div>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
                  <RadioGroupItem value="semi" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Полуавтоматический</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Полный контроль: ИИ автоматически предлагает ответ, а вы редактируете при необходимости.
                    </div>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
                  <RadioGroupItem value="auto" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Автоматический</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Экономит ваше время: ИИ сам формулирует и отправляет ответы. Всё работает автоматически.
                    </div>
                  </div>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Расширенные настройки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border p-4">
                <div className="text-sm font-medium">Формат обращения</div>
                <div className="mt-1 text-xs text-muted-foreground">Употребления в ответах обращения на Вы, Вас, Вам или т.п.</div>
                <RadioGroup
                  value={addressFormat}
                  onValueChange={(v) => setAdvanced(["address_format"], v)}
                  className="mt-4 space-y-2"
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <RadioGroupItem value="vy_caps" />
                    <span className="text-sm">Обращение на «Вы»</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <RadioGroupItem value="vy_lower" />
                    <span className="text-sm">Обращение на «вы»</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <RadioGroupItem value="ty" />
                    <span className="text-sm">Обращение на «ты»</span>
                  </label>
                </RadioGroup>
              </div>

              {cardToggle(
                "Обращение по имени",
                "Употребление в ответе обращения к покупателю по имени из его профиля",
                useBuyerName,
                (v) => setAdvanced(["use_buyer_name"], v),
              )}

              {cardToggle(
                "Упоминание названия товара в ответе",
                "Употребление в ответе названия товара из его карточки",
                mentionProduct,
                (v) => setAdvanced(["mention_product_name"], v),
              )}

              <div className="rounded-xl border p-4">
                <div className="text-sm font-medium">Длина ответа</div>
                <div className="mt-1 text-xs text-muted-foreground">Настройка количества текста в сгенерированном ответе</div>
                <RadioGroup value={answerLength} onValueChange={(v) => setAdvanced(["answer_length"], v)} className="mt-4 space-y-2">
                  <label className="flex cursor-pointer items-center gap-3">
                    <RadioGroupItem value="short" />
                    <span className="text-sm">Краткий ответ</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <RadioGroupItem value="default" />
                    <span className="text-sm">По умолчанию</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <RadioGroupItem value="long" />
                    <span className="text-sm">Развёрнутый ответ</span>
                  </label>
                </RadioGroup>
              </div>

              {cardToggle(
                "Эмодзи в ответах",
                "Использование эмодзи в ответах на отзывы и вопросы. Эмодзи подбираются автоматически",
                emojiEnabled,
                (v) => setAdvanced(["emoji_enabled"], v),
              )}

              {cardToggle(
                "Реакция на фото",
                "Благодарить покупателей за приложенные фотографии в отзывах",
                photoReactionEnabled,
                (v) => setAdvanced(["photo_reaction_enabled"], v),
              )}

              <div className="rounded-xl border p-4">
                <div className="text-sm font-medium">Способ доставки</div>
                <div className="mt-1 text-xs text-muted-foreground">Выбранный способ доставки влияет на ответы ИИ</div>
                <div className="mt-3">
                  <Select value={deliveryMethod || "none"} onValueChange={(v) => setAdvanced(["delivery_method"], v === "none" ? null : v)}>
                    <SelectTrigger>
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
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">Tone of voice</div>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs">NEW</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Выбранные тональности будут влиять на стиль ответов</div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Для положительных отзывов</Label>
                    <Select value={tonePositive} onValueChange={(v) => setTone("positive", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {toneOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Для нейтральных отзывов</Label>
                    <Select value={toneNeutral} onValueChange={(v) => setTone("neutral", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {toneOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Для отрицательных отзывов</Label>
                    <Select value={toneNegative} onValueChange={(v) => setTone("negative", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {toneOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Для вопросов</Label>
                    <Select value={toneQuestion} onValueChange={(v) => setTone("question", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {toneOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button variant="link" className="h-auto p-0 text-primary">
                    Посмотреть примеры тональностей
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm font-medium">Стоп-слова</div>
                <div className="mt-1 text-xs text-muted-foreground">Слова/фразы, которые нельзя использовать в ответах</div>
                <Textarea
                  className="mt-3"
                  rows={4}
                  value={stopWords.join("\n")}
                  onChange={(e) => setAdvanced(["stop_words"], e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
                  placeholder="Каждое стоп-слово — с новой строки"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Обучение ИИ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Раздел зарезервирован под будущее: примеры, доп. инструкции и обучение на ваших ответах.
              </p>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Сейчас в API нет отдельного эндпоинта, поэтому это заглушка.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chats */}
        <TabsContent value="chats" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Чаты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cardToggle(
                "Подтверждение отправки сообщения в чат",
                "Если настройка включена, то при каждой отправке сообщения в чат будет появляться окно подтверждения",
                confirmSend,
                (v) => setChatCfg(["confirm_send"], v),
              )}

              {cardToggle(
                "Подтверждение вставки рекомендации ИИ в чат",
                "Если настройка включена, перед вставкой рекомендации ИИ в текстовое поле будет появляться окно подтверждения",
                confirmAiInsert,
                (v) => setChatCfg(["confirm_ai_insert"], v),
              )}
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
