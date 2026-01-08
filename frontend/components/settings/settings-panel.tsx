"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Save, AlertCircle } from "lucide-react"

interface Settings {
  auto_sync: boolean
  reply_mode: string
  auto_draft: boolean
  auto_publish: boolean
  language: string
  tone: string
  signature: string
  min_rating_to_autopublish: number
}

interface SettingsPanelProps {
  shopId: number
  token: string
}

export default function SettingsPanel({ shopId, token }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/settings/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
    } catch (err) {
      console.error("Failed to load settings:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!settings) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/settings/${shopId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        alert("Settings saved successfully!")
        loadSettings()
      }
    } catch (err) {
      console.error("Failed to save settings:", err)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>
  }

  if (!settings) {
    return <div className="p-8 text-center text-muted-foreground">Failed to load settings</div>
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure automation and response templates</p>
      </div>

      <div className="space-y-6">
        {/* Feedback Automation */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Feedback Automation</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <div>
                <p className="font-medium text-foreground">Auto Sync</p>
                <p className="text-sm text-muted-foreground">Automatically sync feedbacks from Wildberries</p>
              </div>
              <input
                type="checkbox"
                checked={settings.auto_sync}
                onChange={(e) => setSettings({ ...settings, auto_sync: e.target.checked })}
                className="w-5 h-5"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <div>
                <p className="font-medium text-foreground">Auto Draft</p>
                <p className="text-sm text-muted-foreground">Generate draft responses automatically</p>
              </div>
              <input
                type="checkbox"
                checked={settings.auto_draft}
                onChange={(e) => setSettings({ ...settings, auto_draft: e.target.checked })}
                className="w-5 h-5"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <div>
                <p className="font-medium text-foreground">Auto Publish</p>
                <p className="text-sm text-muted-foreground">Publish responses automatically</p>
              </div>
              <input
                type="checkbox"
                checked={settings.auto_publish}
                onChange={(e) => setSettings({ ...settings, auto_publish: e.target.checked })}
                className="w-5 h-5"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Reply Mode</label>
              <select
                value={settings.reply_mode}
                onChange={(e) => setSettings({ ...settings, reply_mode: e.target.value })}
                className="w-full mt-2 px-3 py-2 bg-input border border-border rounded-md text-foreground"
              >
                <option value="manual">Manual</option>
                <option value="semi">Semi-Auto</option>
                <option value="auto">Fully Auto</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Min Rating to Auto-Publish</label>
              <Input
                type="number"
                min="1"
                max="5"
                value={settings.min_rating_to_autopublish}
                onChange={(e) =>
                  setSettings({ ...settings, min_rating_to_autopublish: Number.parseInt(e.target.value) })
                }
                className="mt-2"
              />
            </div>
          </div>
        </Card>

        {/* Content Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Response Content</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Language</label>
              <select
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="w-full mt-2 px-3 py-2 bg-input border border-border rounded-md text-foreground"
              >
                <option value="en">English</option>
                <option value="ru">Russian</option>
                <option value="uz">Uzbek</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Tone</label>
              <select
                value={settings.tone}
                onChange={(e) => setSettings({ ...settings, tone: e.target.value })}
                className="w-full mt-2 px-3 py-2 bg-input border border-border rounded-md text-foreground"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="formal">Formal</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Signature</label>
              <Textarea
                value={settings.signature}
                onChange={(e) => setSettings({ ...settings, signature: e.target.value })}
                placeholder="Add your signature to responses"
                className="mt-2 min-h-24"
              />
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex gap-2">
          <Button onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>

          <div className="flex items-center gap-2 text-sm text-yellow-600 ml-auto">
            <AlertCircle className="w-4 h-4" />
            Changes may affect automation behavior
          </div>
        </div>
      </div>
    </div>
  )
}
