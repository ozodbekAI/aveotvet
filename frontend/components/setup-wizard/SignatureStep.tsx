"use client"

import { useState } from "react";
import { Pen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SignatureStepProps {
  signature: string;
  onUpdateSignature: (signature: string) => void;
}

const templates = [
  "С уважением, команда магазина",
  "Ваш магазин {store_name}",
  "Спасибо за покупку! 🙏",
  "Будем рады видеть вас снова!",
  "С наилучшими пожеланиями",
];

export function SignatureStep({ signature, onUpdateSignature }: SignatureStepProps) {
  const [isCustom, setIsCustom] = useState(!templates.includes(signature) && signature !== "");

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Подпись для ответов</h2>
        <p className="text-muted-foreground">
          Как будет заканчиваться каждый ответ на отзыв
        </p>
      </div>

      {/* Готовые шаблоны */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Выберите шаблон</Label>
        <div className="grid grid-cols-1 gap-2">
          {templates.map((template) => (
            <button
              key={template}
              onClick={() => {
                onUpdateSignature(template);
                setIsCustom(false);
              }}
              className={cn(
                "text-left px-4 py-3 rounded-lg border-2 transition-all",
                signature === template && !isCustom
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-muted/30 hover:bg-muted/50"
              )}
            >
              <span className="text-sm">{template}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Разделитель */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">или</span>
        </div>
      </div>

      {/* Своя подпись */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="customSignature" className="text-sm font-medium">
            Своя подпись
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 text-xs"
            onClick={() => {
              setIsCustom(true);
              onUpdateSignature("");
            }}
          >
            <Pen className="h-3 w-3 mr-1" />
            Написать свою
          </Button>
        </div>
        <Textarea
          id="customSignature"
          placeholder="Введите вашу подпись..."
          value={isCustom ? signature : ""}
          onChange={(e) => {
            setIsCustom(true);
            onUpdateSignature(e.target.value);
          }}
          className={cn(
            "min-h-[80px] transition-all",
            isCustom && "border-primary"
          )}
        />
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Используйте {"{store_name}"} для автоподстановки названия магазина
        </p>
      </div>
    </div>
  );
}
