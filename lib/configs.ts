import { FieldControl, ItemControl } from "./controls";
import { AbstractExtras, AbstractHints } from "./controls.types";
import {
  ExtraDefinition,
  FuzzyExecutableRegistry,
  HinterDefinition,
  MessagerDefinition,
  TriggerDefinition,
  ValidatorDefinition,
} from "./executable";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { FieldDataTypeDefinition } from "./typing";

export interface ItemConfig<
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> extends BaseItemConfig {
  hints?: {
    [hint in keyof THints]: readonly HinterDefinition<TRegistry, ItemControl<THints, TExtras>, THints, TExtras>[];
  };
  extras?: ExtraDefinition<TRegistry, ItemControl<THints, TExtras>, THints, TExtras>;
  messagers?: readonly MessagerDefinition<TRegistry, ItemControl<THints, TExtras>, THints, TExtras>[];
}

export interface FieldConfig<
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> extends ItemConfig<TRegistry, THints, TExtras>,
    BaseFieldConfig {
  disablers?: readonly HinterDefinition<TRegistry, FieldControl<unknown, THints, TExtras>, THints, TExtras>[];
  triggers?: readonly TriggerDefinition<TRegistry, FieldControl<unknown, THints, TExtras>, THints, TExtras>[];
  validators?: readonly ValidatorDefinition<TRegistry, FieldControl<unknown, THints, TExtras>, THints, TExtras>[];
  dataType?: FieldDataTypeDefinition;
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
