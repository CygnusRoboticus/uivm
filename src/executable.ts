import { combineLatest, of } from "rxjs";
import { delay, filter, map, switchMap, tap } from "rxjs/operators";
import { AbstractExtras, Executor, IItemControl, Messages, Trigger, Validator } from "./controls.types";
import { findControl } from "./controls.utils";
import { BaseItemConfig } from "./primitives";
import { Option, SearchResolver } from "./search";
import { Spread } from "./typing.utils";
import { isFieldControl, isGroupControl, notNullish } from "./utils";

// Executable definitions, these are the objects placed on configs
export type ExecutableDefinition<TService, TValue, TConfig extends BaseItemConfig, TControl> = {
  [k in keyof TService]: {
    name: TService[k] extends (config: TConfig, control: TControl, params: any) => TValue ? k : never;
  } & {
    params?: TService[k] extends (config: TConfig, control: TControl, params: infer TParams) => TValue
      ? TParams
      : never;
  };
}[keyof TService];
export type SearchExecutableDefinition<TService, TValue, TConfig extends BaseItemConfig, TControl> = {
  [k in keyof TService]: {
    name: TService[k] extends (config: TConfig, control: TControl, params: any) => TValue ? k : never;
  } & {
    paging?: { take: number };
    params?: TService[k] extends (config: TConfig, control: TControl, params: infer TParams) => TValue
      ? TParams
      : never;
  };
}[keyof TService];

export interface ExecutableDefinitionDefault {
  name: string;
  params?: Record<string, unknown>;
}

export type HinterDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any,
> =
  | ExecutableDefinition<TRegistry["hints"], Executor<TControl, boolean>, TConfig, TControl>
  | Executor<TControl, boolean>;
export type ExtraDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any,
  TExtras = AbstractExtras,
> = {
  [key in keyof TExtras]?:
    | ExecutableDefinition<TRegistry["extras"], Executor<TControl, TExtras[key]>, TConfig, TControl>
    | Executor<TControl, TExtras[key]>;
};
export type MessagerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any,
> =
  | ExecutableDefinition<TRegistry["validators"], Executor<TControl, Messages | null>, TConfig, TControl>
  | Executor<TControl, Messages | null>;
export type TriggerDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any,
> = ExecutableDefinition<TRegistry["triggers"], Trigger<TControl>, TConfig, TControl> | Trigger<TControl>;
export type ValidatorDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig = any,
  TControl = any,
> =
  | ExecutableDefinition<TRegistry["validators"], Executor<TControl, Messages | null>, TConfig, TControl>
  | Executor<TControl, Messages | null>;
export type SearchDefinition<
  TRegistry extends FuzzyExecutableRegistry,
  TOption,
  TValue,
  TParams extends object,
  TConfig extends BaseItemConfig = any,
  TControl = any,
> =
  | SearchExecutableDefinition<
      TRegistry["search"],
      SearchResolver<TControl, TOption, TValue, TParams>,
      TConfig,
      TControl
    >
  | SearchResolver<TControl, TOption, TValue, TParams>;

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
  TSearches = {},
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
  TCustom extends Partial<FuzzyExecutableRegistry>,
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

export function isExecutableDefinitionObject<TValue>(
  def: ExecutableDefinitionDefault | TValue,
): def is ExecutableDefinitionDefault {
  return typeof def === "object" && typeof (def as any).name === "string";
}

export class BasicExtrasService<
  TConfig extends BaseItemConfig = BaseItemConfig,
  TControl extends IItemControl<any, any> = IItemControl<any, any>,
> {
  static(config: TConfig, control: TControl, { value }: { value: unknown }) {
    return (c: TControl) => of(value);
  }
}

export class BasicTriggersService<
  TConfig extends BaseItemConfig = BaseItemConfig,
  TControl extends IItemControl<any, any> = IItemControl<any, any>,
> {
  autofill(
    config: TConfig,
    control: TControl,
    { field, pattern, replace }: { field: string; pattern?: RegExp | string; replace?: string },
  ) {
    const regex = pattern && replace ? (typeof pattern === "string" ? new RegExp(pattern) : pattern) : undefined;
    return (c: TControl) => {
      if (isFieldControl(c)) {
        return combineLatest([c.root$.pipe(filter(notNullish), filter(isGroupControl)), c.value$]).pipe(
          delay(0),
          tap(([root, v]) => {
            const dependent = findControl(root, field);
            if (dependent && v) {
              const value = typeof v === "string" ? v : "";
              dependent.reset(regex && replace ? value.replace(regex, replace) : value);
            }
          }),
          map(() => {}),
        );
      }
      return of().pipe(map(() => {}));
    };
  }
  alert(config: TConfig, control: TControl, { message }: { message: string }) {
    return (c: TControl) => alert(message);
  }
}

export class BasicHintsService<
  TConfig extends BaseItemConfig = BaseItemConfig,
  TControl extends IItemControl<any, any> = IItemControl<any, any>,
> {
  static(config: TConfig, control: TControl, { value }: { value: boolean }) {
    return (c: TControl) => of(value);
  }
  field(config: TConfig, control: TControl, { field, value }: { field: string; value: unknown }) {
    return (c: TControl) => {
      return c.root$.pipe(
        filter(notNullish),
        filter(isGroupControl),
        switchMap(root => {
          const dependent = findControl(root, field);
          if (dependent) {
            return dependent.value$.pipe(
              map(v =>
                Array.isArray(value)
                  ? !!v === !!value.length
                  : typeof value === "boolean"
                  ? !!v === !!value
                  : v === value,
              ),
            );
          }
          return of(false);
        }),
      );
    };
  }
}

export class BasicValidatorsService<
  TConfig extends BaseItemConfig = BaseItemConfig,
  TControl extends IItemControl<any, any> = IItemControl<any, any>,
> {
  static(config: TConfig, control: TControl, { message }: { message: string }) {
    return (c: TControl) => of({ static: { message } });
  }
  required(config: TConfig, control: TControl, params?: { message?: string }) {
    return (c: TControl) => {
      if (
        isFieldControl(c) &&
        (c.value === undefined || c.value === null || c.value === "" || (Array.isArray(c.value) && c.value.length))
      ) {
        return { required: { message: params?.message || "Field is required." } };
      }
      return null;
    };
  }
}

export class BasicSearchService<
  TConfig extends BaseItemConfig = BaseItemConfig,
  TControl extends IItemControl<any, any> = IItemControl<any, any>,
> {
  static<T>(config: TConfig, c: TControl, params: { options: readonly Option<T>[] }) {
    return {
      search: (q: string, c: TControl, p: object) =>
        params.options.filter(o => o.label.search(q) || o.sublabel?.search(q)),
      resolve: (v: any[], c: TControl, p: object) => params.options.filter(o => v.includes(o.value)),
    };
  }
}

export class BasicRegistry<
  TConfig extends BaseItemConfig = BaseItemConfig,
  TControl extends IItemControl<any, any> = IItemControl<any, any>,
> {
  extras = new BasicExtrasService<TConfig, TControl>();
  triggers = new BasicTriggersService<TConfig, TControl>();
  hints = new BasicHintsService<TConfig, TControl>();
  validators = new BasicValidatorsService<TConfig, TControl>();
  search = new BasicSearchService<TConfig, TControl>();
}
