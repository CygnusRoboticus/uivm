import { ComponentBuilder, ComponentRegistry } from "./component.types";
import { AbstractExtras } from "./controls.types";
import { BaseItemConfig } from "./primitives";

export function createComponentBuilder<
  TConfig extends BaseItemConfig,
  TRegistry extends ComponentRegistry<TConfig, TExtras>,
  TExtras = AbstractExtras
>(registry: TRegistry) {
  return <TControl>(config: TConfig, extras: TExtras) => {
    const method = getComponentRegistryMethod<TConfig, TControl, TRegistry, TExtras>(config, registry);
    return method?.(config, registry, extras) ?? null;
  };
}

function getComponentRegistryMethod<
  TConfig extends BaseItemConfig,
  TControl,
  TRegistry extends ComponentRegistry<TConfig, TExtras>,
  TExtras = AbstractExtras
>(config: TConfig, registry: TRegistry): ComponentBuilder<TConfig, TConfig, TControl, TRegistry, TExtras> | null {
  return (registry as any)[config.type]?.bind(registry) ?? null;
}
