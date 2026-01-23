import Link from "next/link"

import {
  ArrowRight,
  BadgeCheck,
  Clock,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function Landing() {
  return (
    <div className="min-h-screen wb-bg-soft relative overflow-hidden">
      {/* soft background ornaments */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <header className="mx-auto max-w-6xl px-4 pt-6 relative">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl wb-accent-bar shadow-md" />
            <div>
              <div className="text-xl font-extrabold wb-gradient-text leading-none">AVEOTVET</div>
              <div className="text-xs text-muted-foreground">Менеджер отзывов для Wildberries</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">Как работает</a>
            <a href="#features" className="hover:text-foreground transition-colors">Возможности</a>
            <a href="#faq" className="hover:text-foreground transition-colors">Вопросы</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-xl">
              <Link href="/login">Войти</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/register">Регистрация</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 relative">
        {/* HERO */}
        <section className="pt-14 md:pt-20" id="how">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full bg-card/70 backdrop-blur">
                  <Clock className="size-3" /> Подключение за 3–5 минут
                </Badge>
                <Badge variant="outline" className="rounded-full bg-card/70 backdrop-blur">
                  <ShieldCheck className="size-3" /> Токен хранится в зашифрованном виде
                </Badge>
                <Badge variant="outline" className="rounded-full bg-card/70 backdrop-blur">
                  <Zap className="size-3" /> Авто и ручной режим
                </Badge>
              </div>

              <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl leading-[1.05]">
                Управляйте отзывами Wildberries
                <span className="block mt-1">
                  <span className="wb-gradient-text">быстро</span> и <span className="wb-gradient-text">без путаницы</span>
                </span>
              </h1>

              <p className="mt-4 text-base text-muted-foreground md:text-lg">
                AVEOTVET — это кабинет для отзывов, вопросов и сообщений WB: вы задаёте правила, а сервис помогает
                отвечать быстрее и держать всё под контролем.
              </p>

              <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 size-4 text-primary" />
                  <span>Раздел «Ожидают ответа»: открыли отзыв — поле ответа сразу в фокусе.</span>
                </div>
                <div className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 size-4 text-primary" />
                  <span>Подписи по брендам: выбираете бренд → задаёте отдельную подпись.</span>
                </div>
                <div className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 size-4 text-primary" />
                  <span>Автоматизация по вашим условиям: черновики, автопубликация, тон и правила.</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="rounded-2xl">
                  <Link href="/start" className="inline-flex items-center gap-2">
                    Начать <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl">
                  <Link href="/login">У меня уже есть аккаунт</Link>
                </Button>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                Нажимая «Начать», вы по шагам добавите магазин и настройки — без сложной регистрации.
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
                  <div className="text-sm font-semibold">Ответы по шаблонам</div>
                  <div className="text-sm text-muted-foreground mt-1">Тон, подписи по брендам, правила публикации.</div>
                </div>
                <div className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
                  <div className="text-sm font-semibold">“Ожидают ответа”</div>
                  <div className="text-sm text-muted-foreground mt-1">Открыли отзыв — сразу пишете ответ, поле в фокусе.</div>
                </div>
              </div>
            </div>

            {/* Right preview cards */}
            <div className="grid gap-4">
              <Card className="rounded-3xl border border-border bg-card/75 p-5 shadow-xl shadow-black/5 backdrop-blur">
                <div className="text-sm font-semibold">Как это работает</div>
                <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <div className="mt-0.5 size-9 rounded-2xl wb-accent-bar grid place-items-center text-white">
                      <Sparkles className="size-4" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">1) Создадим доступ</div>
                      Email + пароль. Без лишних настроек.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-0.5 size-9 rounded-2xl wb-accent-bar opacity-90 grid place-items-center text-white">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">2) Добавим магазин</div>
                      Название + WB Token (обязательно).
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-0.5 size-9 rounded-2xl wb-accent-bar opacity-75 grid place-items-center text-white">
                      <Wand2 className="size-4" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">3) Настроим правила</div>
                      Автопубликация, черновики, тон, подписи.
                    </div>
                  </li>
                </ol>
              </Card>

              <Card className="rounded-3xl border border-border bg-card/75 p-5 shadow-xl shadow-black/5 backdrop-blur">
                <div className="text-sm font-semibold">Что вы увидите в кабинете</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-xs text-muted-foreground">Проблемы</div>
                    <div className="text-sm font-semibold mt-1">Где нужно внимание</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-xs text-muted-foreground">Ожидают ответа</div>
                    <div className="text-sm font-semibold mt-1">Быстрый ввод ответа</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-xs text-muted-foreground">Черновики</div>
                    <div className="text-sm font-semibold mt-1">Проверка перед публикацией</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-xs text-muted-foreground">Автоматизация</div>
                    <div className="text-sm font-semibold mt-1">Работает по настройкам</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="mt-14 md:mt-20" id="features">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold tracking-tight">Возможности</div>
              <div className="mt-2 text-sm text-muted-foreground max-w-2xl">
                Всё, что нужно для ежедневной работы с отзывами WB: быстрое открытие, удобные правила,
                черновики и подписи по брендам.
              </div>
            </div>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href="/start">Начать подключение</Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl wb-accent-bar grid place-items-center text-white">
                  <MessageSquareText className="size-5" />
                </div>
                <div className="text-sm font-semibold">Отзывы, вопросы и чаты</div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Всё в одном кабинете: фильтры, статусы, быстрый переход к нужному отзыву.
              </p>
            </Card>

            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl wb-accent-bar opacity-90 grid place-items-center text-white">
                  <Zap className="size-5" />
                </div>
                <div className="text-sm font-semibold">Автоматизация по правилам</div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Автопубликация, черновики и синхронизация — включайте только то, что вам нужно.
              </p>
            </Card>

            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl wb-accent-bar opacity-80 grid place-items-center text-white">
                  <Wand2 className="size-5" />
                </div>
                <div className="text-sm font-semibold">Тон и шаблоны</div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Выберите тон ответов и подписи по брендам — ответы выглядят аккуратно и единообразно.
              </p>
            </Card>

            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl wb-accent-bar opacity-70 grid place-items-center text-white">
                  <Clock className="size-5" />
                </div>
                <div className="text-sm font-semibold">Быстрый ввод ответа</div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                В «Ожидают ответа» сразу открывается поле ввода — без лишних кликов.
              </p>
            </Card>

            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl wb-accent-bar opacity-60 grid place-items-center text-white">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="text-sm font-semibold">Безопасность токена</div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Токен WB хранится зашифрованным и используется только для доступа к данным вашего магазина.
              </p>
            </Card>

            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl wb-accent-bar opacity-50 grid place-items-center text-white">
                  <Sparkles className="size-5" />
                </div>
                <div className="text-sm font-semibold">Понятная настройка</div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Мастер подключения шаг за шагом: добавили магазин → выбрали правила → нажали «Сохранить».
              </p>
            </Card>
          </div>
        </section>

        {/* FAQ / SUPPORT */}
        <section className="mt-14 md:mt-20" id="faq">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="text-sm font-semibold">Нужен WB Token</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Токен обязателен. Его можно получить в личном кабинете WB. На шаге подключения мы покажем подсказку.
              </p>
            </Card>
            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="text-sm font-semibold">Подписи по брендам</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Подключим бренды из WB и позволим задать отдельную подпись для каждого бренда.
              </p>
            </Card>
            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="text-sm font-semibold">Всегда можно вручную</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Автоматизацию можно выключить. “Открыть” → сразу поле ответа, чтобы не тратить время.
              </p>
            </Card>
          </div>

          <Card className="mt-6 rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
            <div className="text-sm font-semibold">Частые вопросы</div>
            <div className="mt-3">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Я уже зарегистрирован — что будет, если нажму «Начать»?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Если аккаунт уже есть, вы можете просто войти через «Войти». Кнопка «Начать» предназначена для
                    быстрого подключения с нуля.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Какие данные нужны для подключения?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Нужны email + пароль для доступа и WB Token вашего магазина. Токен обязателен, потому что без него
                    нельзя получать отзывы и бренды.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Можно ли выключить автоматизацию?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Да. В настройках вы включаете/выключаете авто-синхронизацию, черновики и автопубликацию.
                    Ручной режим всегда доступен.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>Как работают подписи по брендам?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Мы подтягиваем бренды из WB. Вы выбираете бренд и добавляете подпись — она будет автоматически
                    подставляться в ответы для этого бренда.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </Card>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-lg font-semibold">Готовы начать?</div>
            <Button asChild size="lg" className="rounded-2xl">
              <Link href="/start" className="inline-flex items-center gap-2">
                Начать <ArrowRight className="size-4" />
              </Link>
            </Button>
            <div className="text-xs text-muted-foreground">Нажмите “Начать” — мы проведём вас по шагам.</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/30">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted-foreground flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} AVEOTVET</div>
          <div className="flex items-center gap-4">
            <span>Поддержка: support@aveotvet.com</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
