import { AbstractExtras } from "./controls.types";
import { BaseItemConfig } from "./primitives";

export type ComponentBuilder<
  T extends BaseItemConfig,
  TConfig extends BaseItemConfig,
  TControl,
  TRegistry extends ComponentRegistry<TConfig, TExtras>,
  TExtras = AbstractExtras
> = (config: T, registry: TRegistry, extras: TExtras) => TControl;

export type ComponentRegistry<TConfig extends BaseItemConfig, TControl, TExtras = AbstractExtras> = {
  [type in TConfig["type"]]: ComponentBuilder<
    TConfig extends { type: type } ? TConfig : never,
    TConfig,
    TControl,
    ComponentRegistry<TConfig, TExtras>,
    TExtras
  >;
};
