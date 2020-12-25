import { AbstractExtras, Executor, Messages, Trigger, Validator } from "./controls.types";
import { BaseItemConfig } from "./primitives";
import { SearchResolver } from "./search.types";
import { Spread, WithOptional } from "./typing.utils";

// Executable definitions, these are the objects placed on configs
export type ExecutableDefinition<TService, TValue, TConfig extends BaseItemConfig, TControl> = {
  [k in keyof TService]: {
    name: TService[k] extends (config: TConfig, control: TControl, params: any) => TValue ? k : never;
  } & WithOptional<{
    params: TService[k] extends (config: TConfig, control: TControl, params: infer TParams) => TValue ? TParams : never;
  }>;
}[keyof TService];

export interface ExecutableDefinitionDefault {
  name: string;
  params?: Record<string, unknown>;
}

export type HinterDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any
> = ExecutableDefinition<TRegistry["hints"], Executor<TControl, boolean>, TConfig, TControl>;
export type ExtraDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any,
  TExtras = AbstractExtras
> = {
  [key in keyof TExtras]?: ExecutableDefinition<
    TRegistry["extras"],
    Executor<TControl, TExtras[key]>,
    TConfig,
    TControl
  >;
};
export type MessagerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any
> = ExecutableDefinition<TRegistry["validators"], Executor<TControl, Messages | null>, TConfig, TControl>;
export type TriggerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any
> = ExecutableDefinition<TRegistry["triggers"], Trigger<TControl>, TConfig, TControl>;
export type ValidatorDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any
> = ExecutableDefinition<TRegistry["validators"], Executor<TControl, Messages | null>, TConfig, TControl>;
export type SearchDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TOption,
  TValue,
  TParams extends object,
  TConfig extends BaseItemConfig = any,
  TControl = any
> = ExecutableDefinition<TRegistry["search"], SearchResolver<TControl, TOption, TValue, TParams>, TConfig, TControl>;

// The executable format services are expected to return
export type Executable<TConfig extends BaseItemConfig, TControl, TParams, TValue = unknown> = (
  config: TConfig,
  c: TControl,
  params: TParams,
  ...args: any[]
) => TValue;

// Registry definitions, fuzzy is used for mixed services where only some properties return the expected type
export interface ExecutableRegistry<TConfig extends BaseItemConfig, TItemControl, TFieldControl> {
  hints: ExecutableService<TConfig, TItemControl, Executor<TItemControl, boolean>>;
  extras: ExecutableService<TConfig, TItemControl, unknown>;
  search: ExecutableService<TConfig, TItemControl, SearchResolver<TItemControl, any, any, any>>;
  triggers: ExecutableService<TConfig, TFieldControl, Executor<TFieldControl, void>>;
  validators: ExecutableService<TConfig, TFieldControl, Validator<TFieldControl>>;
}

export interface FuzzyExecutableRegistry<
  THints = {},
  TTriggers = {},
  TMessagers = {},
  TValidators = {},
  TSearches = {}
> {
  hints?: FuzzyExecutableService<THints, Executor<any, boolean>>;
  extras?: FuzzyExecutableService<TMessagers, Executor<any, any>>;
  search?: FuzzyExecutableService<TSearches, SearchResolver<any, any, any>>;
  triggers?: FuzzyExecutableService<TTriggers, Trigger<any>>;
  validators?: FuzzyExecutableService<TValidators, Validator<any>>;
}

// Convenience type for partially overriding a registry
export type ExecutableRegistryOverride<
  TRegistry extends FuzzyExecutableRegistry,
  TCustom extends Partial<FuzzyExecutableRegistry>
> = Spread<TRegistry, TCustom>;

export interface ExecutableService<TConfig extends BaseItemConfig, TControl, TValue> {
  [name: string]: Executable<TConfig, TControl, any, TValue>;
}

export type FuzzyExecutableService<TService = {}, TValue = unknown> =
  | {
      [k in keyof TService]: TService[k] extends Executable<infer TConfig, infer TControl, infer TParams, TValue>
        ? TConfig extends BaseItemConfig
          ? Executable<TConfig, TControl, TParams, TValue>
          : never
        : never;
    }
  | {};
