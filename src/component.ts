import { AbstractExtras } from "./controls.types";
import { BaseItemConfig } from "./primitives";

export type ComponentBuilder<
  TControl extends TControls,
  TComponent extends TComponents,
  TControls,
  TComponents,
  TExtras = AbstractExtras,
> = (control: TControl, extras?: TExtras) => TComponent;

export type ComponentRegistry<TConfigs extends BaseItemConfig, TControls, TComponents, TExtras = AbstractExtras> = {
  [type in TConfigs["type"]]: ComponentBuilder<TControls, TComponents, TControls, TComponents, TExtras>;
};

export function createComponentBuilder<
  TConfigs extends BaseItemConfig,
  TControls,
  TComponents,
  TExtras = AbstractExtras,
  TComponentRegistry extends ComponentRegistry<TConfigs, TControls, TComponents, TExtras> = ComponentRegistry<
    TConfigs,
    TControls,
    TComponents,
    TExtras
  >,
>(
  registry: TComponentRegistry,
  typeFn: (c: TControls) => TConfigs["type"],
): ComponentBuilder<TControls, TComponents, TControls, TComponents, TExtras> {
  return <TConfig extends TConfigs, TControl extends TControls, TComponent extends TComponents>(
    control: TControl,
    extras?: TExtras,
  ): TComponent => {
    const method = getComponentRegistryMethod<
      TConfig,
      TControl,
      TComponent,
      TConfigs,
      TControls,
      TComponents,
      TExtras,
      TComponentRegistry
    >(control, registry, typeFn);
    if (!method) {
      const type = typeFn(control);
      throw new Error(`No registry method for ${type}`);
    }
    return method(control, extras);
  };
}

function getComponentRegistryMethod<
  TConfig extends TConfigs,
  TControl extends TControls,
  TComponent extends TComponents,
  TConfigs extends BaseItemConfig,
  TControls,
  TComponents,
  TExtras = AbstractExtras,
  TComponentRegistry extends ComponentRegistry<TConfigs, TControls, TComponents, TExtras> = ComponentRegistry<
    TConfigs,
    TControls,
    TComponents,
    TExtras
  >,
>(
  control: TControls,
  registry: TComponentRegistry,
  typeFn: (c: TControls) => TConfig["type"],
): ComponentBuilder<TControl, TComponent, TControls, TComponents, TExtras> | null {
  return (registry as any)[typeFn(control)]?.bind(registry) ?? null;
}
