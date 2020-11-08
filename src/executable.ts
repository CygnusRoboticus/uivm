import { FieldControl, ItemControl } from "./controls";
import {
  AbstractHints,
  AbstractExtras,
  Executor,
  Messages,
  ObservableExecutor,
  Trigger,
  Validator,
} from "./controls.types";
import { SearchResolver } from "./search.types";
import { BaseItemConfig } from "./primitives";
import { Spread, WithOptional } from "./typing.utils";

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

export interface ExecutableDefinitionDefault {
  name: string;
  params?: Record<string, unknown>;
}

export type HinterDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints, TExtras>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<TRegistry["hints"], ObservableExecutor<TControl, boolean>>;
export type ExtraDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints, TExtras>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = {
  [key in keyof TExtras]?: ExecutableDefinition<TRegistry["extras"], ObservableExecutor<TControl, TExtras[key]>>;
};
export type MessagerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints, TExtras>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<TRegistry["messagers"], ObservableExecutor<TControl, Messages | null>>;
export type TriggerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints, TExtras>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<TRegistry["triggers"], Trigger<TControl>>;
export type ValidatorDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints, TExtras>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<TRegistry["validators"], Executor<TControl, Messages | null>>;
export type SearchDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TControl extends ItemControl<THints, TExtras>,
  TValue,
  TParams extends object,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<TRegistry["search"], SearchResolver<TControl, TValue, TParams, THints, TExtras>>;

// The executable format services are expected to return
export type Executable<
  TConfig extends BaseItemConfig,
  TControl extends ItemControl<THints, TExtras>,
  TParams,
  TValue = unknown,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = (config: TConfig, c: TControl, params: TParams, ...args: any[]) => TValue;

// Registry definitions, fuzzy is used for mixed services where only some properties return the expected type
export interface ExecutableRegistry<
  TConfig extends BaseItemConfig,
  TItemControl extends ItemControl<THints, TExtras>,
  TFieldControl extends FieldControl<any, THints, TExtras>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> {
  hints: ExecutableService<TConfig, TItemControl, ObservableExecutor<TItemControl, boolean>, THints, TExtras>;
  extras: ExecutableService<TConfig, TItemControl, unknown, THints, TExtras>;
  messagers: ExecutableService<TConfig, TItemControl, Validator<TItemControl>, THints, TExtras>;
  search: ExecutableService<
    TConfig,
    TItemControl,
    SearchResolver<TItemControl, any, any, THints, TExtras>,
    THints,
    TExtras
  >;
  triggers: ExecutableService<TConfig, TFieldControl, Executor<TFieldControl, void>, THints, TExtras>;
  validators: ExecutableService<TConfig, TFieldControl, Validator<TFieldControl>, THints, TExtras>;
}

export interface FuzzyExecutableRegistry<
  THints = {},
  TTriggers = {},
  TMessagers = {},
  TValidators = {},
  TSearches = {}
> {
  hints: FuzzyExecutableService<THints, ObservableExecutor<any, boolean>>;
  extras: FuzzyExecutableService<TMessagers, ObservableExecutor<any, any>>;
  messagers: FuzzyExecutableService<TMessagers, Validator<any>>;
  search: FuzzyExecutableService<TSearches, SearchResolver<any, any, any, any, any>>;
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
  TControl extends ItemControl<THints, TExtras>,
  TValue,
  THints extends AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> {
  [name: string]: Executable<TConfig, TControl, any, TValue, THints, TExtras>;
}

type FuzzyExecutableService<TService = {}, TValue = unknown> =
  | {
      [k in keyof TService]: TService[k] extends Executable<
        infer TConfig,
        infer TControl,
        infer TParams,
        TValue,
        // hints on a control are unimportant from this side
        any,
        any
      >
        ? TConfig extends BaseItemConfig
          ? TControl extends ItemControl<infer THints, infer TExtras>
            ? Executable<TConfig, TControl, TParams, TValue, THints, TExtras>
            : never
          : never
        : never;
    }
  | {};
