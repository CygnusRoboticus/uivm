import { AbstractExtras } from "./controls.types";
import { FuzzyExecutableRegistry } from "./executable";
import { BaseItemConfig } from "./primitives";
import { Bundle } from "./visitor";

export type ComponentBuilder<
  TConfig extends TConfigs,
  TControl extends TControls,
  TComponent extends TComponents,
  TConfigs extends BaseItemConfig,
  TControls,
  TComponents,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  TExtras = AbstractExtras
> = (bundle: Bundle<TConfig, TControl, TConfigs, TControls, TRegistry>, extras?: TExtras) => TComponent;

export type ComponentRegistry<
  TConfigs extends BaseItemConfig,
  TControls,
  TComponents,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  TExtras = AbstractExtras
> = {
  [type in TConfigs["type"]]: ComponentBuilder<
    TConfigs extends { type: type } ? TConfigs : never,
    TControls,
    TComponents,
    TConfigs,
    TControls,
    TComponents,
    TRegistry,
    TExtras
  >;
};

export function createComponentBuilder<
  TConfigs extends BaseItemConfig,
  TControls,
  TComponents,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  TExtras = AbstractExtras,
  TComponentRegistry extends ComponentRegistry<
    TConfigs,
    TControls,
    TComponents,
    TRegistry,
    TExtras
  > = ComponentRegistry<TConfigs, TControls, TComponents, TRegistry, TExtras>
>(
  registry: TComponentRegistry,
): ComponentBuilder<TConfigs, TControls, TComponents, TConfigs, TControls, TComponents, TRegistry, TExtras> {
  return <TConfig extends TConfigs, TControl extends TControls, TComponent extends TComponents>(
    bundle: Bundle<TConfig, TControl, TConfigs, TControls, TRegistry>,
    extras?: TExtras,
  ): TComponent => {
    const method = getComponentRegistryMethod<
      TConfig,
      TControl,
      TComponent,
      TConfigs,
      TControls,
      TComponents,
      TRegistry,
      TExtras,
      TComponentRegistry
    >(bundle.config, registry);
    if (!method) {
      throw new Error(`No registry method for ${bundle.config.type}`);
    }
    return method(bundle, extras);
  };
}

function getComponentRegistryMethod<
  TConfig extends TConfigs,
  TControl extends TControls,
  TComponent extends TComponents,
  TConfigs extends BaseItemConfig,
  TControls,
  TComponents,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  TExtras = AbstractExtras,
  TComponentRegistry extends ComponentRegistry<
    TConfigs,
    TControls,
    TComponents,
    TRegistry,
    TExtras
  > = ComponentRegistry<TConfigs, TControls, TComponents, TRegistry, TExtras>
>(
  config: TConfigs,
  registry: TComponentRegistry,
): ComponentBuilder<TConfig, TControl, TComponent, TConfigs, TControls, TComponents, TRegistry, TExtras> | null {
  return (registry as any)[config.type]?.bind(registry) ?? null;
}
