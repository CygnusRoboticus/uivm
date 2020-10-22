import { Observable } from "rxjs";
import { Option } from "./configs";
import { AbstractFlags, ItemControl, Messages } from "./controls";

export interface SearchResolver<TValue, TParams extends object> {
  search(subject: Observable<{ search: string; params: TParams }>): Observable<Option<TValue>[]>;
  resolve(value: TValue[], params: TParams): Promise<Option<TValue>[]>;
}

export interface ExecutableRegistry<TFlags = {}, TTriggers = {}, TMessagers = {}, TValidators = {}, TSearches = {}> {
  flags: ExecutableService<TFlags, Observable<boolean>>;
  messagers: ExecutableService<TMessagers, Observable<Messages | null>>;
  search: ExecutableService<TSearches, SearchResolver<unknown, {}>>;
  triggers: ExecutableService<TTriggers, Observable<void>>;
  validators: ExecutableService<TValidators, Observable<Messages | null>>;
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
export type Executable<
  TConfig,
  TControl extends ItemControl<TFlags>,
  TParams,
  TValue = unknown,
  TFlags extends AbstractFlags = AbstractFlags
> = (config: TConfig, control: TControl, configParams: TParams, ...args: any[]) => TValue;

type ExecutableService<TService = {}, TValue = unknown, TFlags extends AbstractFlags = AbstractFlags> =
  | {
      [k in keyof TService]: TService[k] extends (
        config: infer TConfig,
        control: infer TControl,
        params: infer TParams,
      ) => TValue
        ? TControl extends ItemControl<infer TFlags>
          ? Executable<TConfig, TControl, TParams, TValue, TFlags>
          : never
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
    params: TService[k] extends (...args: any) => TValue ? Parameters<TService[k]>[2] : never;
  }>;
}[keyof TService];

export type ExecutableTriggerDefinition<TService, TValue> = {
  [k in keyof TService]: {
    name: TService[k] extends (...args: any) => TValue ? k : never;
  } & WithOptional<{
    params: TService[k] extends (...args: any) => TValue ? Parameters<TService[k]>[1] : never;
  }>;
}[keyof TService];
