import { taskEither as TE } from "fp-ts";
import { Observable } from "rxjs";
import { AnyConfig, DynaOption, DynaOptionSingle } from "./configs";

export interface SearchResolver<TValue = unknown, TParams = any> {
  search: (subject: Observable<{ search: string; params: TParams }>) => Observable<DynaOption<TValue>[]>;
  resolve: (subject: Observable<{ value: TValue[]; opts: TParams }>) => Promise<DynaOptionSingle<TValue>[]>;
}

export type Validator<TValue = unknown, TErrors = unknown> = (value: TValue) => TErrors | null;
export type AsyncValidator<TValue = unknown, TErrors = unknown> = (value: TValue) => Observable<TErrors | null>;

export interface ExecutableRegistry<
  TFlags extends ExecutableService<TFlags, Observable<boolean>> = {},
  TTriggers extends ExecutableTriggerService<TTriggers, Observable<void>> = {},
  TValidators extends ExecutableService<TValidators, Validator> = {},
  TAsyncValidators extends ExecutableService<TValidators, AsyncValidator> = {},
  TSearches extends ExecutableService<TSearches, SearchResolver> = {}
> {
  flags: TFlags;
  triggers: TTriggers;
  validators: TValidators;
  asyncValidators: TAsyncValidators;
  search: TSearches;
}

type KeysOfType<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T];
type RequiredKeys<T> = Exclude<KeysOfType<T, Exclude<T[keyof T], undefined>>, undefined>;
type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>;
// Common properties from L and R with undefined in R[K] replaced by type in L[K]
type SpreadProperties<L, R, K extends keyof L & keyof R> = { [P in K]: L[P] | Exclude<R[P], undefined> };
type Id<T> = { [K in keyof T]: T[K] };

// Type of { ...L, ...R }
type Spread<L, R> = Id<
  Pick<L, Exclude<keyof L, keyof R>> &
    // Properties in R with types that exclude undefined
    Pick<R, Exclude<keyof R, OptionalKeys<R>>> &
    // Properties in R, with types that include undefined, that don't exist in L
    Pick<R, Exclude<OptionalKeys<R>, keyof L>> &
    // Properties in R, with types that include undefined, that exist in L
    SpreadProperties<L, R, OptionalKeys<R> & keyof L>
>;

export type ExecutableRegistryOverride<
  TRegistry extends ExecutableRegistry,
  TCustom extends Partial<ExecutableRegistry>
> = Spread<TRegistry, TCustom>;

/**
 * Dynaform Executable type. This does not need to be implemented, it is exported for reference.
 */
export type Executable<TConfig = AnyConfig, TParams = undefined, TValue = unknown> = (
  config: TConfig,
  params: TParams,
  ...args: any[]
) => TValue;

/**
 * Dynaform ExecutableTrigger type. This does not need to be implemented, it is exported for reference.
 */
export type ExecutableTrigger<TConfig = AnyConfig, TParams = undefined, TValue = unknown> = (
  config: TConfig,
  params: TParams,
  subject: Observable<void>,
  ...args: any[]
) => TValue;

type ExecutableService<TService = {}, TValue = unknown> =
  | {
      [k in keyof TService]: TService[k] extends (config: infer T, params: infer U, ...args: any[]) => TValue
        ? Executable<T, U, TValue>
        : never;
    }
  | {};

type ExecutableTriggerService<TService = {}, TValue = unknown> =
  | {
      [k in keyof TService]: TService[k] extends (
        config: infer T,
        params: infer U,
        subject: Observable<void>,
        ...args: any[]
      ) => TValue
        ? ExecutableTrigger<T, U, TValue>
        : never;
    }
  | {};

// This could be codegolf'd into more generic types, but meh
// @see https://github.com/microsoft/TypeScript/issues/28339
// @see https://github.com/Microsoft/TypeScript/issues/25760
type WithOptional<T> = Pick<T, RequiredKeys<T>> & Partial<Pick<T, OptionalKeys<T>>>;

export type ExecutableDefinition<TService, TValue> = {
  [k in keyof TService]: {
    name: TService[k] extends (...args: any) => TValue ? k : never;
  } & WithOptional<{
    params: TService[k] extends (...args: any) => TValue ? Parameters<TService[k]>[1] : never;
  }>;
}[keyof TService];

export type ExecutableTriggerDefinition<TService, TValue> = {
  [k in keyof TService]: {
    name: TService[k] extends (...args: any) => TValue ? k : never;
  } & WithOptional<{
    params: TService[k] extends (...args: any) => TValue ? Parameters<TService[k]>[1] : never;
  }>;
}[keyof TService];
