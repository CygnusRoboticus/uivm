import { FieldControl, ItemControl } from "./controls";
import { AbstractHints } from "./controls.types";
import {
  FuzzyExecutableRegistry,
  HinterDefinition,
  MessagerDefinition,
  TriggerDefinition,
  ValidatorDefinition,
} from "./executable";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { FieldDataTypeDefinition } from "./typing";

export interface ItemConfig<TRegistry extends FuzzyExecutableRegistry, THints extends AbstractHints>
  extends BaseItemConfig {
  hints?: {
    [flag in keyof THints]: readonly HinterDefinition<TRegistry, ItemControl<THints>, THints>[];
  };
  messagers?: readonly MessagerDefinition<TRegistry, ItemControl<THints>, THints>[];
}

export interface FieldConfig<TRegistry extends FuzzyExecutableRegistry, THints extends AbstractHints>
  extends ItemConfig<TRegistry, THints>,
    BaseFieldConfig {
  disablers?: readonly HinterDefinition<TRegistry, FieldControl<unknown, THints>, THints>[];
  triggers?: readonly TriggerDefinition<TRegistry, FieldControl<unknown, THints>, THints>[];
  validators?: readonly ValidatorDefinition<TRegistry, FieldControl<unknown, THints>, THints>[];
  dataType?: FieldDataTypeDefinition;
}

export type GroupConfig<
  TConfig extends ItemConfig<TRegistry, THints>,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints
> = ItemConfig<TRegistry, THints> & BaseGroupConfig<TConfig>;
export type ArrayConfig<
  TConfig extends ItemConfig<TRegistry, THints>,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints
> = FieldConfig<TRegistry, THints> & BaseArrayConfig<TConfig>;
