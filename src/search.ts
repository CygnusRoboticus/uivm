import { readonlyArray as RAR } from "fp-ts";
import { combineLatest, Observable, of } from "rxjs";
import { bufferTime, debounceTime, filter, groupBy, map, mergeAll, switchMap } from "rxjs/operators";
import { Observableish } from "./controls.types";
import { toObservable } from "./utils";

// Search resolver specific types
export interface OptionSingle<T = unknown> {
  label: string;
  /**
   * Unique identifier for value. Allows comparisons to be made when values are a complex type.
   */
  key?: string;
  value: T;
  disabled?: boolean;
  sublabel?: string;
  icon?: { name: string; color?: string; tooltip?: string };
  help?: string;

  [key: string]: unknown;
}

export interface OptionMulti<T = unknown> {
  label: string;
  /**
   * Unique identifer for group.
   */
  key: string;
  sublabel?: string;
  icon?: { name: string; color?: string; tooltip?: string };
  options: Option<T>[];

  [key: string]: unknown;
}

export type Option<T = unknown> = OptionSingle<T> | OptionMulti<T>;

export interface SearchResolverPagination {
  take: number;
  skip: number;
}

export interface SearchResolver<TControl, TOption, TValue, TParams extends object = any> {
  search(
    search: string,
    control: TControl,
    params: TParams,
    paging: SearchResolverPagination,
  ): Observableish<readonly TOption[]>;
  resolve(value: TValue[], control: TControl, params: TParams): Observableish<readonly TOption[]>;
}

export function isOptionSingle<TValue>(opt: Option<TValue>): opt is OptionSingle<TValue> {
  return !opt.options || !Array.isArray(opt.options);
}

export function isOptionMulti<TValue>(opt: Option<TValue>): opt is OptionMulti<TValue> {
  return Array.isArray(opt.options);
}

export function mergeSearchResolvers<TControl, TOption, TValue, TParams extends object>(
  searchResolvers: SearchResolver<TControl, TOption, TValue, TParams>[],
): SearchResolver<TControl, TOption, TValue, TParams> {
  return {
    search: (s, c, p, p2) =>
      searchResolvers.length
        ? combineLatest(searchResolvers.map(sr => toObservable(sr.search(s, c, p, p2)))).pipe(map(RAR.flatten))
        : of([]),
    resolve: (v, c, p) =>
      searchResolvers.length
        ? combineLatest(searchResolvers.map(sr => toObservable(sr.resolve(v, c, p)))).pipe(map(RAR.flatten))
        : of([]),
  };
}

/**
 * Add a grouping method and a debounce to a source observable. This allows
 * multiple subscribers to share values emitted by this observable based on the
 * `key` property.
 */
export function createSearchObservable<
  TControl,
  TOption,
  TValue,
  TParams extends object,
  TInput extends { search: string; control: TControl; params: TParams; paging: SearchResolverPagination; key: string },
>(
  search$: Observable<TInput>,
  resolversFn: (params: TInput) => SearchResolver<TControl, TOption, TValue, TParams>[],
  delay = 500,
) {
  return search$.pipe(
    groupBy(params => params.key),
    map(group =>
      group.pipe(
        debounceTime(delay),
        switchMap(args => {
          const merged = mergeSearchResolvers(resolversFn(args));
          const { search, control, params, paging } = args;
          return toObservable(merged.search(search, control, params, paging)).pipe(
            map(result => ({ result, ...params })),
          );
        }),
      ),
    ),
    mergeAll(),
  );
}

/**
 * Add a grouping method and a debounce to a source observable. This allows
 * multiple subscribers to share values emitted by this observable based on the
 * `key` property.
 */
export function createResolveObservable<
  TControl,
  TOption,
  TValue,
  TParams extends object,
  TInput extends { values: TValue[]; control: TControl; params: TParams; key: string },
>(
  resolve$: Observable<TInput>,
  resolversFn: (args: TInput) => SearchResolver<TControl, TOption, TValue, TParams>[],
  delay = 500,
) {
  return resolve$.pipe(
    groupBy(args => args.key),
    map(group =>
      group.pipe(
        bufferTime(delay),
        filter(args => !!args.length),
        map(args =>
          args.reduce((acc, p) => ({
            ...p,
            values: acc.values.concat(p.values),
            params: p.params,
            key: p.key,
          })),
        ),
        switchMap(args => {
          const merged = mergeSearchResolvers(resolversFn(args));
          const { values, control, params } = args;
          return toObservable(merged.resolve(values, control, params)).pipe(map(result => ({ result, ...params })));
        }),
      ),
    ),
    mergeAll(),
  );
}
