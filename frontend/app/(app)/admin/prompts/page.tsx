"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import {
  getMe,
  adminGetPrompts,
  adminUpdatePrompts,
  adminListTones,
  adminCreateTone,
  adminUpdateTone,
  adminDeleteTone,
} from "@/lib/api"

type UiOption = { value: string; label: string; hint?: string | null }

type PromptBundle = {
  review_instructions_template: string
  question_instructions_template: string
  chat_instructions_template: string

  // Dynamic UI options for shop settings
  address_format_options: UiOption[]
  address_format_map: Record<string, string>
  answer_length_options: UiOption[]
  answer_length_map: Record<string, string>

  // Emoji rules
  emoji_rule_map: Record<string, string>
}

type Tone = {
  id: number
  code: string
  label: string
  hint?: string | null
  instruction?: string | null
  sort_order: number
  is_active: boolean
}

const DEFAULT_ADDRESS_FORMAT_OPTIONS: UiOption[] = [
  { value: "vy_caps", label: "Вы (с большой буквы)", hint: "Вежливое обращение: Вы/Ваш/Вам" },
  { value: "vy_lower", label: "вы (с маленькой буквы)", hint: "Вежливое обращение: вы/ваш/вам" },
  { value: "ty", label: "ты", hint: "Неформальное обращение: ты/твой" },
]

const DEFAULT_ANSWER_LENGTH_OPTIONS: UiOption[] = [
  { value: "short", label: "Коротко", hint: "1–2 предложения" },
  { value: "default", label: "По умолчанию", hint: "Обычная длина ответа" },
  { value: "long", label: "Развернуто", hint: "До ~5 предложений при необходимости" },
]

function normalizeUiOption(x: any): UiOption {
  const value = typeof x?.value === "string" ? x.value.trim() : ""
  const label = typeof x?.label === "string" ? x.label.trim() : ""
  const hint = typeof x?.hint === "string" ? x.hint.trim() : ""
  return {
    value: value.slice(0, 64),
    label: (label || value || "").slice(0, 120),
    hint: hint ? hint.slice(0, 220) : null,
  }
}

function ensureBundle(b: any): PromptBundle {
  const addressOptsRaw = Array.isArray(b?.address_format_options) ? b.address_format_options : DEFAULT_ADDRESS_FORMAT_OPTIONS
  const answerOptsRaw = Array.isArray(b?.answer_length_options) ? b.answer_length_options : DEFAULT_ANSWER_LENGTH_OPTIONS

  const address_format_options = addressOptsRaw.map(normalizeUiOption).filter((o) => o.value && o.label)
  const answer_length_options = answerOptsRaw.map(normalizeUiOption).filter((o) => o.value && o.label)

  return {
    review_instructions_template: String(b?.review_instructions_template || ""),
    question_instructions_template: String(b?.question_instructions_template || ""),
    chat_instructions_template: String(b?.chat_instructions_template || ""),

    address_format_options: address_format_options.length ? address_format_options : DEFAULT_ADDRESS_FORMAT_OPTIONS,
    address_format_map: (b?.address_format_map && typeof b.address_format_map === "object" ? b.address_format_map : {}) as Record<string, string>,

    answer_length_options: answer_length_options.length ? answer_length_options : DEFAULT_ANSWER_LENGTH_OPTIONS,
    answer_length_map: (b?.answer_length_map && typeof b.answer_length_map === "object" ? b.answer_length_map : {}) as Record<string, string>,

    emoji_rule_map: (b?.emoji_rule_map && typeof b.emoji_rule_map === "object" ? b.emoji_rule_map : {}) as Record<string, string>,
  }
}

function ToneDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: Partial<Tone> | null
  onSave: (payload: any) => Promise<void>
}) {
  const [code, setCode] = React.useState(initial?.code || "")
  const [label, setLabel] = React.useState(initial?.label || "")
  const [hint, setHint] = React.useState(initial?.hint || "")
  const [instruction, setInstruction] = React.useState(initial?.instruction || "")
  const [sortOrder, setSortOrder] = React.useState<number>(typeof initial?.sort_order === "number" ? initial!.sort_order : 0)
  const [isActive, setIsActive] = React.useState<boolean>(initial?.is_active ?? true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setCode(initial?.code || "")
    setLabel(initial?.label || "")
    setHint((initial?.hint as any) || "")
    setInstruction((initial?.instruction as any) || "")
    setSortOrder(typeof initial?.sort_order === "number" ? initial!.sort_order : 0)
    setIsActive(initial?.is_active ?? true)
    setError(null)
  }, [initial, open])

  const isEdit = Boolean(initial && typeof initial.id === "number")

  const submit = async () => {
    setError(null)
    if (!label.trim()) {
      setError("Укажите название")
      return
    }
    if (!isEdit && !code.trim()) {
      setError("Укажите code")
      return
    }
    try {
      setSaving(true)
      await onSave({
        code: code.trim(),
        label: label.trim(),
        hint: hint.trim() ? hint.trim() : null,
        instruction: instruction.trim() ? instruction.trim() : null,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        is_active: isActive,
      })
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Изменить тональность" : "Добавить тональность"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-foreground">Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isEdit}
              placeholder="friendly"
              className="mt-2 bg-input border-border text-foreground"
            />
            <div className="text-xs text-muted-foreground mt-1">Хранится в настройках магазина как значение tone.</div>
          </div>

          <div>
            <Label className="text-foreground">Название</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Дружелюбная"
              className="mt-2 bg-input border-border text-foreground"
            />
          </div>

          <div className="col-span-2">
            <Label className="text-foreground">Подсказка</Label>
            <Input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Короткое описание для UI"
              className="mt-2 bg-input border-border text-foreground"
            />
          </div>

          <div className="col-span-2">
            <Label className="text-foreground">Инструкция для модели</Label>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Например: Friendly tone. Warm, polite, positive."
              className="mt-2 bg-input border-border text-foreground min-h-[120px]"
            />
          </div>

          <div>
            <Label className="text-foreground">Порядок сортировки</Label>
            <Input
              value={String(sortOrder)}
              onChange={(e) => setSortOrder(Number.parseInt(e.target.value || "0", 10))}
              className="mt-2 bg-input border-border text-foreground"
            />
          </div>

          <div className="flex items-end gap-2">
            <Input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-foreground">Активна</span>
          </div>
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="border-border">
            Отмена
          </Button>
          <Button onClick={submit} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OptionsWithRulesEditor({
  title,
  description,
  options,
  rules,
  onChange,
}: {
  title: string
  description?: string
  options: UiOption[]
  rules: Record<string, string>
  onChange: (nextOptions: UiOption[], nextRules: Record<string, string>) => void
}) {
  const setOpt = (idx: number, patch: Partial<UiOption>) => {
    const next = options.map((o, i) => (i === idx ? { ...o, ...patch } : o))
    onChange(next, rules)
  }

  const setValue = (idx: number, nextValueRaw: string) => {
    const nextValue = nextValueRaw.trim().slice(0, 64)
    const prevValue = options[idx]?.value || ""

    const nextOptions = options.map((o, i) => (i === idx ? { ...o, value: nextValue } : o))

    const nextRules = { ...(rules || {}) }
    if (prevValue && prevValue !== nextValue) {
      // migrate rule
      if (nextValue && !(nextValue in nextRules) && prevValue in nextRules) {
        nextRules[nextValue] = nextRules[prevValue]
      }
      delete nextRules[prevValue]
    }

    onChange(nextOptions, nextRules)
  }

  const setRule = (value: string, text: string) => {
    const v = (value || "").trim()
    const nextRules = { ...(rules || {}) }
    if (!v) return
    if (!text.trim()) {
      delete nextRules[v]
    } else {
      nextRules[v] = text
    }
    onChange(options, nextRules)
  }

  const addRow = () => {
    onChange([...options, { value: "", label: "", hint: "" }], rules)
  }

  const removeRow = (idx: number) => {
    const v = options[idx]?.value
    const nextOptions = options.filter((_, i) => i !== idx)
    const nextRules = { ...(rules || {}) }
    if (v) delete nextRules[v]
    onChange(nextOptions, nextRules)
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-foreground">{title}</CardTitle>
          {description ? <div className="text-sm text-muted-foreground mt-1">{description}</div> : null}
        </div>
        <Button onClick={addRow} className="bg-primary hover:bg-primary/90">
          Добавить
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Value</TableHead>
                <TableHead className="min-w-[220px]">Название</TableHead>
                <TableHead className="min-w-[260px]">Подсказка</TableHead>
                <TableHead className="min-w-[340px]">Правило (инструкция)</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(options || []).map((o, idx) => (
                <TableRow key={`${o.value}-${idx}`}>
                  <TableCell>
                    <Input
                      value={o.value}
                      onChange={(e) => setValue(idx, e.target.value)}
                      placeholder="vy_caps"
                      className="bg-input border-border text-foreground"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={o.label}
                      onChange={(e) => setOpt(idx, { label: e.target.value })}
                      placeholder="Вы (с большой буквы)"
                      className="bg-input border-border text-foreground"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={o.hint || ""}
                      onChange={(e) => setOpt(idx, { hint: e.target.value })}
                      placeholder="Короткое описание в UI"
                      className="bg-input border-border text-foreground"
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={o.value ? rules?.[o.value] || "" : ""}
                      onChange={(e) => setRule(o.value, e.target.value)}
                      placeholder="Например: Use formal second-person plural pronouns (Вы/Ваш/Вам)."
                      className="bg-input border-border text-foreground min-h-[90px]"
                      disabled={!o.value}
                    />
                    {!o.value ? <div className="text-xs text-muted-foreground mt-1">Сначала заполните value.</div> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      className="bg-destructive/20 text-destructive hover:bg-destructive/30"
                      onClick={() => removeRow(idx)}
                    >
                      Удалить
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!options || options.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Значения отсутствуют.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminPromptsPage() {
  const [allowed, setAllowed] = React.useState<boolean | null>(null)
  const [bundle, setBundle] = React.useState<PromptBundle | null>(null)
  const [tones, setTones] = React.useState<Tone[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [toneOpen, setToneOpen] = React.useState(false)
  const [editingTone, setEditingTone] = React.useState<Tone | null>(null)

  const refresh = React.useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const me = await getMe()
      const isAdmin = me?.role === "super_admin"
      setAllowed(isAdmin)
      if (!isAdmin) return

      const [b, t] = await Promise.all([adminGetPrompts(), adminListTones()])
      setBundle(ensureBundle(b))
      setTones(Array.isArray(t) ? t : [])
    } catch (e: any) {
      setError(e?.message || "Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const saveBundle = async () => {
    if (!bundle) return
    setSaving(true)
    setError(null)
    try {
      await adminUpdatePrompts(bundle)
      await refresh()
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  const upsertTone = async (payload: any) => {
    if (editingTone?.id) {
      await adminUpdateTone(editingTone.id, {
        label: payload.label,
        hint: payload.hint,
        instruction: payload.instruction,
        sort_order: payload.sort_order,
        is_active: payload.is_active,
      })
    } else {
      await adminCreateTone(payload)
    }
    await refresh()
  }

  const removeTone = async (toneId: number) => {
    setError(null)
    try {
      await adminDeleteTone(toneId)
      await refresh()
    } catch (e: any) {
      setError(e?.message || "Не удалось удалить")
    }
  }

  if (allowed === false) {
    return (
      <div className="max-w-3xl">
        <div className="text-2xl font-bold text-foreground">Доступ запрещён</div>
        <div className="text-sm text-muted-foreground mt-2">Раздел доступен только главному администратору.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-foreground">Админ: промпты</div>
          <div className="text-sm text-muted-foreground">
            Глобальные шаблоны, тональности и UI-параметры (общие для всех магазинов).
          </div>
        </div>
        <Button onClick={saveBundle} disabled={saving || loading || !bundle} className="bg-primary hover:bg-primary/90">
          {saving ? "Сохранение…" : "Сохранить всё"}
        </Button>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Шаблоны инструкций</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-foreground">Отзывы</Label>
            <Textarea
              value={bundle?.review_instructions_template || ""}
              onChange={(e) => setBundle((prev) => (prev ? { ...prev, review_instructions_template: e.target.value } : prev))}
              className="mt-2 bg-input border-border text-foreground min-h-[130px]"
              placeholder="Шаблон инструкций для ответов на отзывы"
            />
          </div>
          <div>
            <Label className="text-foreground">Вопросы</Label>
            <Textarea
              value={bundle?.question_instructions_template || ""}
              onChange={(e) => setBundle((prev) => (prev ? { ...prev, question_instructions_template: e.target.value } : prev))}
              className="mt-2 bg-input border-border text-foreground min-h-[130px]"
              placeholder="Шаблон инструкций для ответов на вопросы"
            />
          </div>
          <div>
            <Label className="text-foreground">Чаты</Label>
            <Textarea
              value={bundle?.chat_instructions_template || ""}
              onChange={(e) => setBundle((prev) => (prev ? { ...prev, chat_instructions_template: e.target.value } : prev))}
              className="mt-2 bg-input border-border text-foreground min-h-[130px]"
              placeholder="Шаблон инструкций для ответов в чатах"
            />
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm font-medium text-foreground">Подстановки (переменные)</div>
            <div className="text-sm text-muted-foreground mt-1">
              В шаблонах доступны переменные: <span className="font-mono">{`{{buyer_name}}`}</span>, <span className="font-mono">{`{{product_name}}`}</span>, <span className="font-mono">{`{{brand}}`}</span>, <span className="font-mono">{`{{signature}}`}</span>, <span className="font-mono">{`{{reply_mode_instruction}}`}</span>, <span className="font-mono">{`{{tone_instruction}}`}</span>, <span className="font-mono">{`{{address_format_instruction}}`}</span>, <span className="font-mono">{`{{answer_length_instruction}}`}</span>, <span className="font-mono">{`{{emoji_instruction}}`}</span>.
            </div>
          </div>
        </CardContent>
      </Card>

      <OptionsWithRulesEditor
        title="UI: формат обращения"
        description="Эти значения отображаются в настройках магазина и влияют на инструкцию для генерации."
        options={bundle?.address_format_options || []}
        rules={bundle?.address_format_map || {}}
        onChange={(nextOptions, nextRules) =>
          setBundle((prev) => (prev ? { ...prev, address_format_options: nextOptions, address_format_map: nextRules } : prev))
        }
      />

      <OptionsWithRulesEditor
        title="UI: длина ответа"
        description="Значения для настройки длины ответа. Для каждого value можно задать инструкцию."
        options={bundle?.answer_length_options || []}
        rules={bundle?.answer_length_map || {}}
        onChange={(nextOptions, nextRules) =>
          setBundle((prev) => (prev ? { ...prev, answer_length_options: nextOptions, answer_length_map: nextRules } : prev))
        }
      />

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Эмодзи</CardTitle>
          <div className="text-sm text-muted-foreground mt-1">
            Инструкции для режима эмодзи (используется в настройках магазина как переключатель).
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-foreground">Emoji ON</Label>
            <Textarea
              value={bundle?.emoji_rule_map?.on || ""}
              onChange={(e) =>
                setBundle((prev) =>
                  prev
                    ? { ...prev, emoji_rule_map: { ...(prev.emoji_rule_map || {}), on: e.target.value } }
                    : prev
                )
              }
              className="mt-2 bg-input border-border text-foreground min-h-[120px]"
              placeholder="Например: Add 1–2 relevant emoji naturally, avoid overuse."
            />
          </div>
          <div>
            <Label className="text-foreground">Emoji OFF</Label>
            <Textarea
              value={bundle?.emoji_rule_map?.off || ""}
              onChange={(e) =>
                setBundle((prev) =>
                  prev
                    ? { ...prev, emoji_rule_map: { ...(prev.emoji_rule_map || {}), off: e.target.value } }
                    : prev
                )
              }
              className="mt-2 bg-input border-border text-foreground min-h-[120px]"
              placeholder="Например: Do not use any emoji in the reply."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Тональности</CardTitle>
          <Button
            onClick={() => {
              setEditingTone(null)
              setToneOpen(true)
            }}
            className="bg-primary hover:bg-primary/90"
          >
            Добавить
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-3">
            Эти значения подгружаются в «Настройки» и используются при генерации ответов.
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Активна</TableHead>
                  <TableHead className="min-w-[280px]">Инструкция</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tones || []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{t.label}</div>
                      {t.hint ? <div className="text-xs text-muted-foreground">{t.hint}</div> : null}
                    </TableCell>
                    <TableCell>{t.is_active ? "Да" : "Нет"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(t.instruction || "").slice(0, 120)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        className="border-border"
                        onClick={() => {
                          setEditingTone(t)
                          setToneOpen(true)
                        }}
                      >
                        Изменить
                      </Button>
                      <Button
                        variant="destructive"
                        className="bg-destructive/20 text-destructive hover:bg-destructive/30"
                        onClick={() => removeTone(t.id)}
                      >
                        Удалить
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!tones || tones.length === 0) && !loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Тональности отсутствуют.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ToneDialog open={toneOpen} onOpenChange={setToneOpen} initial={editingTone} onSave={upsertTone} />
    </div>
  )
}
