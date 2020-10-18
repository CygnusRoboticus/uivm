import { Observable } from "rxjs";
import { AbstractFlags, Messages } from "./controls";
import { ExecutableDefinition, ExecutableRegistry } from "./executable";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { FieldDataTypeDefinition } from "./typing";

export interface ItemConfig<
  TRegistry extends ExecutableRegistry = ExecutableRegistry,
  TFlags extends AbstractFlags = AbstractFlags
> extends BaseItemConfig {
  flags?: {
    [flag in keyof TFlags]: readonly ExecutableDefinition<TRegistry["flags"], Observable<boolean>>[];
  };
  triggers?: readonly ExecutableDefinition<TRegistry["triggers"], Observable<void>>[];
  messagers?: readonly ExecutableDefinition<TRegistry["messagers"], Observable<Messages | null>>[];
}

export interface FieldConfig<
  TRegistry extends ExecutableRegistry = ExecutableRegistry,
  TFlags extends AbstractFlags = AbstractFlags
> extends ItemConfig<TRegistry, TFlags>,
    BaseFieldConfig {
  validators?: readonly ExecutableDefinition<TRegistry["validators"], Observable<Messages | null>>[];
  disablers?: readonly ExecutableDefinition<TRegistry["flags"], Observable<boolean>>[];
  dataType?: FieldDataTypeDefinition;
}

export type GroupConfig<
  TConfig extends ItemConfig<TRegistry, TFlags>,
  TRegistry extends ExecutableRegistry = ExecutableRegistry,
  TFlags extends AbstractFlags = AbstractFlags
> = ItemConfig<TRegistry, TFlags> & BaseGroupConfig<TConfig>;

export type ArrayConfig<
  TConfig extends ItemConfig<TRegistry, TFlags>,
  TRegistry extends ExecutableRegistry = ExecutableRegistry,
  TFlags extends AbstractFlags = AbstractFlags
> = FieldConfig<TRegistry, TFlags> & BaseArrayConfig<TConfig>;

export type AnyConfig<
  TConfig extends ItemConfig<TRegistry, TFlags> = never,
  TRegistry extends ExecutableRegistry = ExecutableRegistry,
  TFlags extends AbstractFlags = AbstractFlags
> =
  | TConfig
  | ItemConfig<TRegistry, TFlags>
  | FieldConfig<TRegistry, TFlags>
  | GroupConfig<TConfig, TRegistry, TFlags>
  | ArrayConfig<TConfig, TRegistry, TFlags>;

export type FormConfig<
  TConfig extends ItemConfig<TRegistry, TFlags>,
  TRegistry extends ExecutableRegistry,
  TFlags extends AbstractFlags
> = readonly TConfig[];

export interface OptionSingle<T = unknown> {
  label: string;
  value: T;
  disabled?: boolean;
  sublabel?: string;
  icon?: { name: string; color?: string; tooltip?: string };
  help?: string;
}

export interface OptionMulti<T = unknown, U = unknown> {
  label: string;
  /**
   * Value to uniquely identify group; not used in selection.
   */
  value: U;
  icon?: string;
  options: (Option<T> | string)[];
}

export type Option<T = unknown> = OptionSingle<T> | OptionMulti<T>;
