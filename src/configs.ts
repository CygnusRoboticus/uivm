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
    [hint in keyof THints]: readonly HinterDefinition<TRegistry, BaseItemConfig, TControl>[];
  };
  extras?: ExtraDefinition<TRegistry, BaseItemConfig, TControl, TExtras>;
  messagers?: readonly ValidatorDefinition<TRegistry, BaseItemConfig, TControl>[];
}

export interface FieldConfig<
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TControl = any
> extends ItemConfig<TRegistry, THints, TExtras>,
    BaseFieldConfig {
  disablers?: readonly HinterDefinition<TRegistry, BaseFieldConfig, TControl>[];
  triggers?: readonly TriggerDefinition<TRegistry, BaseFieldConfig, TControl>[];
  validators?: readonly ValidatorDefinition<TRegistry, BaseFieldConfig, TControl>[];
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
