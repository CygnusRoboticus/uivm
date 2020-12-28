import { combineLatest, of } from "rxjs";
import { filter, map, switchMap, tap } from "rxjs/operators";
import { FieldControl, ItemControl } from "./controls";
import { AbstractExtras, Executor, Messages, Trigger, Validator } from "./controls.types";
import { BaseItemConfig } from "./primitives";
import { Option, SearchResolver } from "./search";
import { Spread, WithOptional } from "./typing.utils";
import { isGroupControl } from "./utils";

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

export const BasicRegistry = {
  extras: {
    static(config: BaseItemConfig, control: ItemControl, { value }: { value: unknown }) {
      return (c: ItemControl) => of(value);
    },
  },
  triggers: {
    autofill(
      config: BaseItemConfig,
      control: ItemControl,
      { field, pattern, replace }: { field: string; pattern?: RegExp | string; replace?: string },
    ) {
      const regex = pattern && replace ? (typeof pattern === "string" ? new RegExp(pattern) : pattern) : undefined;
      return (c: FieldControl<unknown>) => {
        return combineLatest([c.root$.pipe(filter(isGroupControl)), c.value$]).pipe(
          tap(([root]) => {
            const dependent = root.get(field);
            if (dependent && c.value) {
              const value = typeof c.value === "string" ? c.value : "";
              dependent.reset(regex && replace ? value.replace(regex, replace) : value);
            }
          }),
          map(() => {}),
        );
      };
    },
    alert(config: BaseItemConfig, control: ItemControl, { message }: { message: string }) {
      return (c: ItemControl) => alert(message);
    },
  },
  hints: {
    static(config: BaseItemConfig, control: ItemControl, { value }: { value: boolean }) {
      return (c: ItemControl) => of(value);
    },
    field(config: BaseItemConfig, control: ItemControl, { field, value }: { field: string; value: unknown }) {
      return (c: ItemControl) => {
        return c.root$.pipe(
          filter(isGroupControl),
          switchMap(root => {
            const dependent = root.get(field);
            if (dependent) {
              return dependent.value$.pipe(
                map(v =>
                  Array.isArray(value)
                    ? !!v == !!value.length
                    : typeof value === "boolean"
                    ? !!v == !!value
                    : v == value,
                ),
              );
            }
            return of(false);
          }),
        );
      };
    },
  },
  validators: {
    static(config: BaseItemConfig, control: ItemControl, { message }: { message: string }) {
      return (c: ItemControl) => of({ static: { message } });
    },
    required(config: BaseItemConfig, control: ItemControl, params?: { message?: string }) {
      return (c: FieldControl<unknown>) => {
        if (c.value === undefined || c.value === null || c.value === "" || (Array.isArray(c.value) && c.value.length)) {
          return { required: { message: params?.message || "Field is required." } };
        }
        return null;
      };
    },
  },
  search: {
    static(config: BaseItemConfig, control: ItemControl, params: { options: readonly Option[] }) {
      return {
        search: (q: string, c: ItemControl, p: object) => params.options,
        resolve: (v: any[], c: ItemControl, p: object) => params.options.filter(o => v.includes(o.value)),
      };
    },
  },
};
