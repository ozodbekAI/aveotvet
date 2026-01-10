"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Star,
  X,
  ExternalLink,
  User,
  Eye,
  Ruler,
  Palette,
  Calendar,
  Package,
  MessageSquare,
  Camera,
  Video,
} from "lucide-react"
import * as React from "react"

export type FeedbackDetail = {
  wb_id: string
  created_date: string
  product_valuation?: number | null
  user_name?: string | null
  text?: string | null
  pros?: string | null
  cons?: string | null
  was_viewed?: boolean | null
  answer_text?: string | null
  answer_editable?: string | null
  product_details?: any | null
  photo_links?: string[] | null
  video?: any | null
  bables?: string[] | null
  raw?: any | null
}

function fmtDate(d: string) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function safeText(v: any) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v)
  return s.trim() ? s : "—"
}

function getPD(data: FeedbackDetail) {
  return data.product_details || data.raw?.productDetails || null
}

function getBables(data: FeedbackDetail) {
  const a = Array.isArray(data.bables) ? data.bables : null
  const b = Array.isArray(data.raw?.bables) ? data.raw.bables : null
  return a && a.length ? a : b && b.length ? b : []
}

function RatingStars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, value))
  const colors = {
    1: "text-red-500 fill-red-500",
    2: "text-orange-500 fill-orange-500",
    3: "text-yellow-500 fill-yellow-500",
    4: "text-lime-500 fill-lime-500",
    5: "text-green-500 fill-green-500",
  }
  const color = colors[v as keyof typeof colors] || "text-gray-400 fill-gray-400"

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const active = i < v
          return <Star key={i} className={active ? `h-4 w-4 ${color}` : "h-4 w-4 text-gray-300"} />
        })}
      </div>
      <span className="text-sm font-semibold text-gray-700">{v}/5</span>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200">
      {children}
    </span>
  )
}

function StatBadge({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 min-w-0">
      <Icon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-gray-500 whitespace-nowrap">{label}:</span>
        <span className="text-xs font-semibold text-gray-900 truncate">{value}</span>
      </div>
    </div>
  )
}

export default function FeedbackDetailDialog({
  open,
  onOpenChange,
  data,
  loading,
  error,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  data: FeedbackDetail | null
  loading: boolean
  error: string | null
}) {
  const pd = data ? getPD(data) : null
  const bables = data ? getBables(data) : []
  const raw = data?.raw || null

  const productName = pd?.productName || "Товар"
  const brandName = pd?.brandName || ""
  const nmId = pd?.nmId

  const matchingSizeText =
    raw?.matchingSize === "smaller"
      ? "Маломерит"
      : raw?.matchingSize === "bigger"
      ? "Большемерит"
      : raw?.matchingSize === "perfect"
      ? "В размер"
      : "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* KENG modal: gorizontal uchun */}
      <DialogContent
        className="
            p-0 overflow-hidden bg-white max-w-none
            w-[min(1200px,98vw)]
            sm:max-w-none sm:w-[min(1200px,98vw)]
        "
        >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold mb-1 line-clamp-1">{productName}</div>
              <div className="text-xs text-blue-100 flex items-center gap-2">
                {brandName && <span>{brandName}</span>}
                {brandName && nmId && <span>·</span>}
                {nmId && <span>#{nmId}</span>}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0 rounded-lg bg-white/10 hover:bg-white/20 p-1.5 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[78vh] overflow-auto px-5 py-4">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-blue-600 border-r-transparent mb-2"></div>
              <div className="text-sm text-gray-600">Загрузка...</div>
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <div className="text-red-600 font-semibold mb-1">Ошибка</div>
              <div className="text-sm text-gray-600">{error}</div>
            </div>
          ) : !data ? (
            <div className="py-10 text-center text-gray-500 text-sm">Нет данных</div>
          ) : (
            <div className="space-y-4">
              {/* Rating & Link */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <RatingStars value={Number(data.product_valuation || 0)} />
                {nmId && (
                  <a
                    href={`https://www.wildberries.ru/catalog/${nmId}/detail.aspx`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all text-xs font-medium shadow-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Открыть на WB
                  </a>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <StatBadge icon={User} label="Покупатель" value={safeText(data.user_name)} />
                <StatBadge icon={Calendar} label="Дата" value={fmtDate(data.created_date)} />
                <StatBadge icon={Eye} label="Статус" value={data.was_viewed ? "Просмотрен" : "Новый"} />
                <StatBadge icon={Ruler} label="Размер" value={safeText(pd?.size)} />
                <StatBadge icon={Palette} label="Цвет" value={safeText(raw?.color)} />
                <StatBadge icon={Package} label="Посадка" value={matchingSizeText} />
              </div>

              {/* Tags */}
              {bables.length > 0 && (
                <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                  <div className="text-xs font-semibold text-red-800 mb-2">Теги отзыва</div>
                  <div className="flex flex-wrap gap-1.5">
                    {bables.map((t, i) => (
                      <Chip key={`${t}-${i}`}>{t}</Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* MAIN: DOIM GORIZONTAL */}
              <div className="grid grid-cols-12 gap-4 items-start">
                {/* LEFT (7/12) */}
                <div className="col-span-12 lg:col-span-7 min-w-0 space-y-4">
                  {/* Text */}
                  <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
                    <div className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Текст отзыва
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words">
                      {safeText(data.text)}
                    </div>
                  </div>

                  {/* Pros & Cons */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50/50 rounded-xl p-3 border border-green-100">
                      <div className="text-xs font-semibold text-green-900 mb-2">✅ Плюсы</div>
                      <div className="text-xs text-gray-700 leading-relaxed break-words">{safeText(data.pros)}</div>
                    </div>

                    <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                      <div className="text-xs font-semibold text-red-900 mb-2">❌ Минусы</div>
                      <div className="text-xs text-gray-700 leading-relaxed break-words">{safeText(data.cons)}</div>
                    </div>
                  </div>

                  {/* Media (always visible block, even if empty) */}
                  <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100">
                    <div className="text-xs font-semibold text-purple-900 mb-2">Медиа</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Camera className="h-3.5 w-3.5" />
                          <span>Фото:</span>
                        </div>
                        <span className="font-semibold text-gray-900">{data.photo_links?.length || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Video className="h-3.5 w-3.5" />
                          <span>Видео:</span>
                        </div>
                        <span className="font-semibold text-gray-900">{data.video ? "Да" : "Нет"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT (5/12) */}
                <div className="col-span-12 lg:col-span-5 min-w-0 space-y-4">
                  {/* Answer */}
                  <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Ответ продавца
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          data.answer_text ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {data.answer_text ? "Отвечено" : "Нет"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words min-h-[140px]">
                      {safeText(data.answer_text)}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="text-xs font-semibold text-gray-700 mb-2">Информация</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs py-1.5 border-b border-gray-200 gap-3">
                        <span className="text-gray-500 shrink-0">Категория</span>
                        <span className="font-medium text-gray-900 text-right break-words min-w-0">
                          {safeText(raw?.subjectName)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs py-1.5 border-b border-gray-200 gap-3">
                        <span className="text-gray-500 shrink-0">Артикул</span>
                        <span className="font-medium text-gray-900 text-right break-words min-w-0">
                          {safeText(pd?.supplierArticle)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs py-1.5 border-b border-gray-200 gap-3">
                        <span className="text-gray-500 shrink-0">imtId</span>
                        <span className="font-medium text-gray-900 text-right break-words min-w-0">
                          {safeText(pd?.imtId)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs py-1.5 gap-3">
                        <span className="text-gray-500 shrink-0">WB ID</span>
                        <span className="font-mono text-[10px] text-gray-900 text-right break-all min-w-0">
                          {data.wb_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Supplier */}
                  {pd?.supplierName && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <div className="text-xs font-semibold text-slate-700 mb-1.5">🏢 Поставщик</div>
                      <div className="text-xs text-slate-600 leading-relaxed break-words">{pd.supplierName}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
