import { readonlyArray as RAR } from "fp-ts";
import { combineLatest, Observable, of } from "rxjs";
import { bufferTime, debounceTime, filter, groupBy, map, mergeAll, switchMap } from "rxjs/operators";
import { SearchResolver } from "./search.types";
import { toObservable } from "./utils";

export function mergeSearchResolvers<TControl, TOption, TValue, TParams extends object>(
  searchResolvers: SearchResolver<TControl, TOption, TValue, TParams>[],
): SearchResolver<TControl, TOption, TValue, TParams> {
  return {
    search: (s, c, p) =>
      searchResolvers.length
        ? combineLatest(searchResolvers.map(sr => toObservable(sr.search(s, c, p)))).pipe(map(RAR.flatten))
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
  TInput extends { search: string; control: TControl; params: TParams; key: string }
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
        switchMap(params => {
          const merged = mergeSearchResolvers(resolversFn(params));
          return toObservable(merged.search(params.search, params.control, params.params)).pipe(
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
  TInput extends { values: TValue[]; control: TControl; params: TParams; key: string }
>(
  resolve$: Observable<TInput>,
  resolversFn: (params: TInput) => SearchResolver<TControl, TOption, TValue, TParams>[],
  delay = 500,
) {
  return resolve$.pipe(
    groupBy(params => params.key),
    map(group =>
      group.pipe(
        bufferTime(delay),
        filter(params => !!params.length),
        map(params =>
          params.reduce((acc, p) => ({
            ...p,
            values: acc.values.concat(p.values),
            control: p.control,
            params: p.params,
            key: p.key,
          })),
        ),
        switchMap(params => {
          const merged = mergeSearchResolvers(resolversFn(params));
          return toObservable(merged.resolve(params.values, params.control, params.params)).pipe(
            map(result => ({ result, ...params })),
          );
        }),
      ),
    ),
    mergeAll(),
  );
}
