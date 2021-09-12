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
  typeFn: (c: TControls) => TConfigs["type"] | undefined,
): ComponentBuilder<TControls, TComponents, TControls, TComponents, TExtras> {
  return <TConfig extends TConfigs, TControl extends TControls, TComponent extends TComponents>(
    control: TControl,
    extras?: TExtras,
  ): TComponent => {
    const type: TConfig["type"] | undefined = typeFn(control);
    const hasMethod = type && typeof registry[type] === "function";
    if (!type || !hasMethod) {
      throw new Error(`No registry method for ${type}`);
    }
    return registry[type](control, extras) as TComponent;
  };
}
