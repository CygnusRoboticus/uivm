import { AbstractExtras, AbstractHints } from "./controls.types";
import {
  ExtraDefinition,
  FuzzyExecutableRegistry,
  HinterDefinition,
  TriggerDefinition,
  ValidatorDefinition,
} from "./executable";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";

export interface ItemConfig<
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TControl = any
> extends BaseItemConfig {
  hints?: {
    [hint in keyof THints]: readonly HinterDefinition<TRegistry, any, TControl>[];
  };
  extras?: ExtraDefinition<TRegistry, any, TControl, TExtras>;
  messagers?: readonly ValidatorDefinition<TRegistry, any, TControl>[];
}

export interface FieldConfig<
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TControl = any
> extends ItemConfig<TRegistry, THints, TExtras>,
    BaseFieldConfig {
  disablers?: readonly HinterDefinition<TRegistry, any, TControl>[];
  triggers?: readonly TriggerDefinition<TRegistry, any, TControl>[];
  validators?: readonly ValidatorDefinition<TRegistry, any, TControl>[];
}

export type GroupConfig<
  TConfigs extends ItemConfig<TRegistry, THints, TExtras>,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TControl = any
> = ItemConfig<TRegistry, THints, TExtras, TControl> & BaseGroupConfig<TConfigs>;

export type ArrayConfig<
  TConfigs extends ItemConfig<TRegistry, THints, TExtras>,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TControl = any
> = FieldConfig<TRegistry, THints, TExtras, TControl> & BaseArrayConfig<TConfigs>;
