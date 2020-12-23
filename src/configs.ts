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
  TExtras extends AbstractExtras = AbstractExtras
> extends BaseItemConfig {
  hints?: {
    [hint in keyof THints]: readonly HinterDefinition<TRegistry, any, ItemControl<THints, TExtras>, THints, TExtras>[];
  };
  extras?: ExtraDefinition<TRegistry, any, ItemControl<THints, TExtras>, THints, TExtras>;
  messagers?: readonly ValidatorDefinition<TRegistry, any, ItemControl<THints, TExtras>, THints, TExtras>[];
}

export interface FieldConfig<
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> extends ItemConfig<TRegistry, THints, TExtras>,
    BaseFieldConfig {
  disablers?: readonly HinterDefinition<TRegistry, any, FieldControl<unknown, THints, TExtras>, THints, TExtras>[];
  triggers?: readonly TriggerDefinition<TRegistry, any, FieldControl<unknown, THints, TExtras>, THints, TExtras>[];
  validators?: readonly ValidatorDefinition<TRegistry, any, FieldControl<unknown, THints, TExtras>, THints, TExtras>[];
}

export type GroupConfig<
  TConfig extends ItemConfig<TRegistry, THints, TExtras>,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ItemConfig<TRegistry, THints, TExtras> & BaseGroupConfig<TConfig>;

export type ArrayConfig<
  TConfig extends ItemConfig<TRegistry, THints, TExtras>,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = FieldConfig<TRegistry, THints, TExtras> & BaseArrayConfig<TConfig>;
