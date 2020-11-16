import { FieldControl, ItemControl } from "./controls";
import { AbstractHints, AbstractExtras, Executor, Messages, Trigger, Validator } from "./controls.types";
import { SearchResolver } from "./search.types";
import { BaseItemConfig } from "./primitives";
import { Spread, WithOptional } from "./typing.utils";

// Executable definitions, these are the objects placed on configs
export type ExecutableDefinition<
  TService,
  TValue,
  TConfig extends BaseItemConfig,
  TControl extends ItemControl<THints, TExtras>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = {
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
  TControl extends ItemControl<THints, TExtras> = any,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<TRegistry["hints"], Executor<TControl, boolean>, TConfig, TControl, THints, TExtras>;
export type ExtraDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl extends ItemControl<THints, TExtras> = any,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = {
  [key in keyof TExtras]?: ExecutableDefinition<
    TRegistry["extras"],
    Executor<TControl, TExtras[key]>,
    TConfig,
    TControl,
    THints,
    TExtras
  >;
};
export type MessagerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl extends ItemControl<THints, TExtras> = any,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<
  TRegistry["validators"],
  Executor<TControl, Messages | null>,
  TConfig,
  TControl,
  THints,
  TExtras
>;
export type TriggerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl extends ItemControl<THints, TExtras> = any,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<TRegistry["triggers"], Trigger<TControl>, TConfig, TControl, THints, TExtras>;
export type ValidatorDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl extends ItemControl<THints, TExtras> = any,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<
  TRegistry["validators"],
  Executor<TControl, Messages | null>,
  TConfig,
  TControl,
  THints,
  TExtras
>;
export type SearchDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TOption,
  TValue,
  TParams extends object,
  TConfig extends BaseItemConfig = any,
  TControl extends ItemControl<THints, TExtras> = any,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> = ExecutableDefinition<
  TRegistry["search"],
  SearchResolver<TControl, TOption, TValue, TParams, THints, TExtras>,
  TConfig,
  TControl,
  THints,
  TExtras
>;

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
  hints: ExecutableService<TConfig, TItemControl, Executor<TItemControl, boolean>, THints, TExtras>;
  extras: ExecutableService<TConfig, TItemControl, unknown, THints, TExtras>;
  search: ExecutableService<
    TConfig,
    TItemControl,
    SearchResolver<TItemControl, any, any, any, THints, TExtras>,
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
  hints?: FuzzyExecutableService<THints, Executor<any, boolean>>;
  extras?: FuzzyExecutableService<TMessagers, Executor<any, any>>;
  search?: FuzzyExecutableService<TSearches, SearchResolver<any, any, any, any, any>>;
  triggers?: FuzzyExecutableService<TTriggers, Trigger<any>>;
  validators?: FuzzyExecutableService<TValidators, Validator<any>>;
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
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> {
  [name: string]: Executable<TConfig, TControl, any, TValue, THints, TExtras>;
}

export type FuzzyExecutableService<TService = {}, TValue = unknown> =
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
