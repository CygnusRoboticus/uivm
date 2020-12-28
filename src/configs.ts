import { FieldControl, ItemControl } from "./controls";
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
  TExtras = AbstractExtras
> extends BaseItemConfig {
  hints?: {
    [hint in keyof THints]: readonly HinterDefinition<TRegistry, any, ItemControl<THints, TExtras>>[];
  };
  extras?: ExtraDefinition<TRegistry, any, ItemControl<THints, TExtras>>;
  messagers?: readonly ValidatorDefinition<TRegistry, any, ItemControl<THints, TExtras>>[];
}

export interface FieldConfig<
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
> extends ItemConfig<TRegistry, THints, TExtras>,
    BaseFieldConfig {
  disablers?: readonly HinterDefinition<TRegistry, any, FieldControl<unknown, THints, TExtras>>[];
  triggers?: readonly TriggerDefinition<TRegistry, any, FieldControl<unknown, THints, TExtras>>[];
  validators?: readonly ValidatorDefinition<TRegistry, any, FieldControl<unknown, THints, TExtras>>[];
}

export type GroupConfig<
  TConfigs extends ItemConfig<TRegistry, THints, TExtras>,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
> = BaseGroupConfig<TConfigs> & ItemConfig<TRegistry, THints, TExtras>;

export type ArrayConfig<
  TConfigs extends ItemConfig<TRegistry, THints, TExtras>,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
> = FieldConfig<TRegistry, THints, TExtras> & BaseArrayConfig<TConfigs>;
