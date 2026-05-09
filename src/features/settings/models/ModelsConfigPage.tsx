"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Globe,
  ImageIcon,
  KeyRound,
  Loader2,
  PencilLine,
  Plus,
  RefreshCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useModelConfig } from "@/hooks/use-model-config";
import { useModelHealth } from "@/hooks/use-model-health";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  HealthBadgeStatus,
  ModelDomain,
  ModelFormValue,
  ModelHealthState,
  ModelItemConfig,
} from "./types";
import {
  createDefaultFormValue,
  createFormValue,
  getDomainKey,
  getDomainLabel,
  getStrategyOptions,
  sortModelsForDisplay,
} from "./utils";
import {
  getTextVendorPresets,
  getImageVendorPresets,
  type VendorType,
} from "./vendor-presets";

interface DeleteTarget {
  alias: string;
  domain: ModelDomain;
}

interface FormDialogState {
  domain: ModelDomain;
  model: ModelItemConfig | null;
  open: boolean;
}

interface ModelFormDialogProps {
  domain: ModelDomain;
  existingModels: ModelItemConfig[];
  model: ModelItemConfig | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (originalAlias: string | null, value: ModelFormValue) => Promise<void>;
}

function getStrategyLabel(domain: ModelDomain, strategy: string): string {
  return getStrategyOptions(domain).find((option) => option.value === strategy)?.label ?? strategy;
}

function HealthBadge({ state }: { state: ModelHealthState }) {
  const styles: Record<HealthBadgeStatus, string> = {
    untested: "border-border bg-muted text-muted-foreground",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    degraded: "border-amber-200 bg-amber-50 text-amber-700",
    down: "border-destructive/20 bg-destructive/10 text-destructive",
  };

  const labels: Record<HealthBadgeStatus, string> = {
    untested: "未测试",
    ok: "连接正常",
    degraded: "连接不稳定",
    down: "连接失败",
  };

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", styles[state.status])}>
      {labels[state.status]}
      {typeof state.latencyMs === "number" ? <span>{Math.round(state.latencyMs)}ms</span> : null}
    </Badge>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((index) => (
        <Card key={index}>
          <CardHeader className="space-y-3">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            <div className="h-4 w-56 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ domain, onCreate }: { domain: ModelDomain; onCreate: () => void }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-xl">{getDomainLabel(domain)}</CardTitle>
        <CardDescription>当前还没有配置任何{domain === "text" ? "文本" : "图像"}模型。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onCreate}>
          <Plus />
          新增模型
        </Button>
      </CardContent>
    </Card>
  );
}

function getVendorPresets(domain: ModelDomain) {
  return domain === "text" ? getTextVendorPresets() : getImageVendorPresets();
}

function ModelFormDialog({
  domain,
  existingModels,
  model,
  open,
  saving,
  onOpenChange,
  onSubmit,
}: ModelFormDialogProps) {
  const [value, setValue] = useState<ModelFormValue>(createDefaultFormValue(domain));
  const [error, setError] = useState<string>("");

  const vendorPresets = getVendorPresets(domain);
  const currentVendor = value.vendor && value.vendor !== "custom" ? vendorPresets[value.vendor] : null;
  const modelOptions = currentVendor?.models ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");
    setValue(model ? createFormValue(model) : createDefaultFormValue(domain));
  }, [domain, model, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const alias = value.alias.trim();
    const apiKey = value.apiKey.trim();

    if (!alias) {
      setError("请填写模型别名。");
      return;
    }

    if (!value.strategy) {
      setError("请选择模型策略。");
      return;
    }

    if (!apiKey) {
      setError("请填写 API Key。");
      return;
    }

    if (!value.modelName?.trim()) {
      setError("请选择或输入模型名称。");
      return;
    }

    const duplicated = existingModels.some(
      (item) => item.alias === alias && item.alias !== (model?.alias ?? "")
    );

    if (duplicated) {
      setError("当前模型域中已存在相同别名。");
      return;
    }

    setError("");

    try {
      await onSubmit(model?.alias ?? null, {
        ...value,
        alias,
        apiKey,
        endpoint: value.endpoint.trim(),
      });
      onOpenChange(false);
    } catch {
      // Toast is handled in the hook. Keep the dialog open so the user can adjust inputs.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{model ? "编辑模型" : "新增模型"}</DialogTitle>
          <DialogDescription>
            当前配置保存到 `config/models.yaml`，保存后会立即触发热更新。
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="model-alias">模型别名</Label>
            <Input
              id="model-alias"
              placeholder="例如 writer-main"
              value={value.alias}
              onChange={(event) => setValue((current) => ({ ...current, alias: event.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model-strategy">模型策略</Label>
            <Select
              value={value.strategy}
              onValueChange={(strategy) => setValue((current) => ({ ...current, strategy }))}
            >
              <SelectTrigger id="model-strategy">
                <SelectValue placeholder="选择模型策略" />
              </SelectTrigger>
              <SelectContent>
                {getStrategyOptions(domain).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model-vendor">厂商</Label>
            <Select
              value={value.vendor || "custom"}
              onValueChange={(vendor) =>
                setValue((current) => ({
                  ...current,
                  vendor,
                  endpoint: vendor !== "custom" ? vendorPresets[vendor]?.baseUrl || "" : current.endpoint,
                  modelName: "",
                }))
              }
            >
              <SelectTrigger id="model-vendor">
                <SelectValue placeholder="选择厂商" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(vendorPresets).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    {preset.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">自定义</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model-name">模型名称</Label>
            {modelOptions.length > 0 ? (
              <Select
                value={value.modelName}
                onValueChange={(modelName) => setValue((current) => ({ ...current, modelName }))}
              >
                <SelectTrigger id="model-name">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="model-name"
                placeholder="输入模型名称"
                value={value.modelName}
                onChange={(event) =>
                  setValue((current) => ({ ...current, modelName: event.target.value }))
                }
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model-api-key">API Key</Label>
            <Input
              id="model-api-key"
              placeholder="输入 API Key 或环境变量占位符"
              value={value.apiKey}
              onChange={(event) => setValue((current) => ({ ...current, apiKey: event.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model-endpoint">Endpoint</Label>
            <Input
              id="model-endpoint"
              placeholder="可选，例如 https://api.openai.com/v1"
              value={value.endpoint}
              onChange={(event) => setValue((current) => ({ ...current, endpoint: event.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">启用模型</p>
              <p className="text-sm text-muted-foreground">关闭后模型不会参与当前域的可用列表。</p>
            </div>
            <Switch
              checked={value.enabled}
              onCheckedChange={(enabled) => setValue((current) => ({ ...current, enabled }))}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>保存前请先处理以下问题</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Settings2 />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ModelsConfigPage() {
  const { config, error, isLoading, isSaving, refetch, saveModel, deleteModel, toggleModel } =
    useModelConfig();
  const { getHealthState, testHealth, testingKey } = useModelHealth();
  const [activeDomain, setActiveDomain] = useState<ModelDomain>("text");
  const [dialogState, setDialogState] = useState<FormDialogState>({
    domain: "text",
    model: null,
    open: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const domainConfig = config[getDomainKey(activeDomain)];
  const currentModels = useMemo(() => sortModelsForDisplay(domainConfig), [domainConfig]);

  function openCreateDialog(domain: ModelDomain) {
    setDialogState({
      domain,
      model: null,
      open: true,
    });
  }

  function openEditDialog(domain: ModelDomain, model: ModelItemConfig) {
    setDialogState({
      domain,
      model,
      open: true,
    });
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteModel(deleteTarget.domain, deleteTarget.alias);
      setDeleteTarget(null);
    } catch {
      // Toast is handled in the hook.
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="w-full max-w-[220px] flex-shrink-0">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-xl">模型配置</CardTitle>
              <CardDescription>在这里切换模型域，并管理对应的模型列表。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  activeDomain === "text"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-accent"
                )}
                onClick={() => setActiveDomain("text")}
              >
                <Bot className="h-4 w-4" />
                <div>
                  <p className="font-medium">文本模型</p>
                  <p className="text-xs text-muted-foreground">管理生成文案和故事的模型</p>
                </div>
              </button>

              <button
                type="button"
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  activeDomain === "image"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-accent"
                )}
                onClick={() => setActiveDomain("image")}
              >
                <ImageIcon className="h-4 w-4" />
                <div>
                  <p className="font-medium">图像模型</p>
                  <p className="text-xs text-muted-foreground">管理出图和插画渲染的模型</p>
                </div>
              </button>
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight">{getDomainLabel(activeDomain)}</h1>
              <p className="text-sm text-muted-foreground">
                单模型即时保存。基础字段由页面管理，其余参数保留在 YAML 中。
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => refetch()} disabled={isLoading || isSaving}>
                {isLoading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
                刷新配置
              </Button>
              <Button onClick={() => openCreateDialog(activeDomain)} disabled={isLoading}>
                <Plus />
                新增模型
              </Button>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>模型配置加载失败</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{error instanceof Error ? error.message : "请稍后重试。"}</p>
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCcw />
                  重新加载
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? (
            <LoadingState />
          ) : currentModels.length === 0 ? (
            <EmptyState domain={activeDomain} onCreate={() => openCreateDialog(activeDomain)} />
          ) : (
            <div className="space-y-4">
              {currentModels.map((model) => {
                const healthState = getHealthState(activeDomain, model.alias);
                const isTesting = testingKey === `${activeDomain}:${model.alias}`;

                return (
                  <Card key={`${activeDomain}:${model.alias}`}>
                    <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl">{model.alias}</CardTitle>
                          <Badge variant="outline">{getStrategyLabel(activeDomain, model.strategy)}</Badge>
                          <HealthBadge state={healthState} />
                        </div>
                        <CardDescription>
                          {model.enabled ? "当前已启用" : "当前已禁用"}
                          {" · "}
                          {getDomainLabel(activeDomain)}
                          {model.params?.vendor ? ` · ${model.params.vendor}` : ""}
                          {model.params?.model ? ` · ${model.params.model}` : ""}
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                        <span className="text-sm text-muted-foreground">启用</span>
                        <Switch
                          checked={model.enabled}
                          disabled={isSaving}
                          onCheckedChange={(enabled) => {
                            void toggleModel(activeDomain, model.alias, enabled);
                          }}
                        />
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border px-4 py-3">
                          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            Endpoint
                          </div>
                          <p className="break-all text-sm text-muted-foreground">
                            {typeof model.credentials.endpoint === "string" && model.credentials.endpoint
                              ? model.credentials.endpoint
                              : "未配置"}
                          </p>
                        </div>

                        <div className="rounded-lg border px-4 py-3">
                          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                            API Key
                          </div>
                          <p className="break-all text-sm text-muted-foreground">
                            {model.credentials.apiKey || "未配置"}
                          </p>
                        </div>
                      </div>

                      {healthState.reason ? (
                        <p className="text-sm text-muted-foreground">最近一次测试结果：{healthState.reason}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          可在保存后使用“测试连接”验证该模型当前配置是否可用。
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <Button variant="outline" onClick={() => openEditDialog(activeDomain, model)}>
                          <PencilLine />
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          disabled={isTesting}
                          onClick={() => {
                            void testHealth(activeDomain, model.alias);
                          }}
                        >
                          {isTesting ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
                          测试连接
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => setDeleteTarget({ alias: model.alias, domain: activeDomain })}
                        >
                          <Trash2 />
                          删除
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <ModelFormDialog
        domain={dialogState.domain}
        existingModels={config[getDomainKey(dialogState.domain)].items}
        model={dialogState.model}
        open={dialogState.open}
        saving={isSaving}
        onOpenChange={(open) =>
          setDialogState((current) => ({
            ...current,
            open,
          }))
        }
        onSubmit={async (originalAlias, value) => {
          await saveModel(dialogState.domain, originalAlias, value);
        }}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除模型？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后会立即写回 `config/models.yaml` 并触发热更新。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={isSaving} onClick={() => void handleDeleteConfirm()}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Trash2 />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
