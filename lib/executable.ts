import { BaseControl, FieldControl, ItemControl } from "./controls";
import {
  AbstractHints,
  Executor,
  Messages,
  ObservableExecutor,
  Observableish,
  Trigger,
  Validator,
} from "./controls.types";
import { BaseItemConfig } from "./primitives";
import { Spread, WithOptional } from "./type-utils";

// Executable definitions, these are the objects placed on configs
export type ExecutableDefinition<TService, TValue> = {
  [k in keyof TService]: {
    name: TService[k] extends (config: BaseItemConfig, control: ItemControl, params: {}) => TValue ? k : never;
  } & WithOptional<{
    params: TService[k] extends (config: BaseItemConfig, control: ItemControl, params: {}) => TValue
      ? Parameters<TService[k]>[2]
      : never;
  }>;
}[keyof TService];

export type HinterDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints>,
  THints extends AbstractHints
> = ExecutableDefinition<TRegistry["hints"], ObservableExecutor<TControl, boolean>>;
export type MessagerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints>,
  THints extends AbstractHints
> = ExecutableDefinition<TRegistry["messagers"], ObservableExecutor<TControl, Messages | null>>;
export type TriggerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints>,
  THints extends AbstractHints
> = ExecutableDefinition<TRegistry["triggers"], Trigger<TControl>>;
export type ValidatorDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints>,
  THints extends AbstractHints
> = ExecutableDefinition<TRegistry["validators"], Executor<TControl, Messages | null>>;
export type SearchDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints>,
  TValue,
  TParams extends object,
  THints extends AbstractHints
> = ExecutableDefinition<TRegistry["search"], SearchResolver<TControl, TValue, TParams, THints>>;

// The executable format services are expected to return
export type Executable<
  TConfig extends BaseItemConfig,
  TControl extends ItemControl<THints>,
  TParams,
  TValue = unknown,
  THints extends AbstractHints = AbstractHints
> = (config: TConfig, c: TControl, params: TParams, ...args: any[]) => TValue;

// Registry definitions, fuzzy is used for mixed services where only some properties return the expected type
export interface ExecutableRegistry<
  TConfig extends BaseItemConfig,
  TItemControl extends ItemControl<THints>,
  TFieldControl extends FieldControl<any, THints>,
  THints extends AbstractHints = AbstractHints
> {
  hints: ExecutableService<TConfig, TItemControl, ObservableExecutor<TItemControl, boolean>, THints>;
  messagers: ExecutableService<TConfig, TItemControl, Validator<TItemControl>, THints>;
  search: ExecutableService<TConfig, TItemControl, SearchResolver<TItemControl, any, any, THints>, THints>;
  triggers: ExecutableService<TConfig, TFieldControl, Executor<TFieldControl, void>, THints>;
  validators: ExecutableService<TConfig, TFieldControl, Validator<TFieldControl>, THints>;
}

export interface FuzzyExecutableRegistry<
  THints = {},
  TTriggers = {},
  TMessagers = {},
  TValidators = {},
  TSearches = {}
> {
  hints: FuzzyExecutableService<THints, ObservableExecutor<any, boolean>>;
  messagers: FuzzyExecutableService<TMessagers, Validator<any>>;
  search: FuzzyExecutableService<TSearches, SearchResolver<any, any, any, any>>;
  triggers: FuzzyExecutableService<TTriggers, Trigger<any>>;
  validators: FuzzyExecutableService<TValidators, Validator<any>>;
}

// Convenience type for partially overriding a registry
export type ExecutableRegistryOverride<
  TRegistry extends FuzzyExecutableRegistry,
  TCustom extends Partial<FuzzyExecutableRegistry>
> = Spread<TRegistry, TCustom>;

export interface ExecutableService<
  TConfig extends BaseItemConfig,
  TControl extends ItemControl<THints>,
  TValue,
  THints extends AbstractHints
> {
  [name: string]: Executable<TConfig, TControl, any, TValue, THints>;
}

type FuzzyExecutableService<TService = {}, TValue = unknown> =
  | {
      [k in keyof TService]: TService[k] extends Executable<
        infer TConfig,
        infer TControl,
        infer TParams,
        TValue,
        // hints on a control are unimportant from this side
        any
      >
        ? TConfig extends BaseItemConfig
          ? TControl extends ItemControl<infer THints>
            ? Executable<TConfig, TControl, TParams, TValue, THints>
            : never
          : never
        : never;
    }
  | {};

// Search resolver specific types
export interface OptionSingle<T = unknown> {
  label: string;
  /**
   * Unique identifier for value, useful when value is a complex type
   */
  key?: string;
  value: T;
  disabled?: boolean;
  sublabel?: string;
  icon?: { name: string; color?: string; tooltip?: string };
  help?: string;

  [key: string]: unknown;
}

export interface OptionMulti<T = unknown, U = unknown> {
  label: string;
  /**
   * Value to uniquely identify group; not used in selection.
   */
  key: string;
  icon?: string;
  options: Option<T>[];

  [key: string]: unknown;
}

export type Option<T = unknown> = OptionSingle<T> | OptionMulti<T>;

export interface SearchResolver<
  TControl extends ItemControl<THints>,
  TValue,
  TParams extends object,
  THints extends AbstractHints
> {
  search(search: string, control: TControl, params: TParams): Observableish<readonly Option<TValue>[]>;
  resolve(value: TValue[], control: TControl, params: TParams): Observableish<readonly Option<TValue>[]>;
}
