import { combineLatest, Observable, of } from "rxjs";
import { bufferTime, debounceTime, filter, groupBy, map, mergeAll, share, switchMap } from "rxjs/operators";
import { ItemControl } from "./controls";
import { AbstractExtras, AbstractHints } from "./controls.types";
import { SearchResolver } from "./search.types";
import { toObservable } from "./utils";
import { readonlyArray as RAR } from "fp-ts";

export function mergeSearchResolvers<
  TControl extends ItemControl<THints, TExtras>,
  TValue,
  TParams extends object,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
>(
  searchResolvers: SearchResolver<TControl, TValue, TParams, THints, TExtras>[],
): SearchResolver<TControl, TValue, TParams, THints, TExtras> {
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
  TControl extends ItemControl<THints, TExtras>,
  TValue,
  TParams extends object,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
>(
  searchResolvers: SearchResolver<TControl, TValue, TParams, THints, TExtras>[],
  search$: Observable<{ search: string; control: TControl; params: TParams; key: string }>,
  delay = 500,
) {
  const merged = mergeSearchResolvers(searchResolvers);
  return search$.pipe(
    groupBy(params => params.key),
    map(group =>
      group.pipe(
        debounceTime(delay),
        switchMap(params => merged.search(params.search, params.control, params.params)),
      ),
    ),
    mergeAll(),
    share(),
  );
}

/**
 * Add a grouping method and a debounce to a source observable. This allows
 * multiple subscribers to share values emitted by this observable based on the
 * `key` property.
 */
export function createResolveObservable<
  TControl extends ItemControl<THints, TExtras>,
  TValue,
  TParams extends object,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
>(
  searchResolvers: SearchResolver<TControl, TValue, TParams, THints, TExtras>[],
  resolve$: Observable<{ values: TValue[]; control: TControl; params: TParams; key: string }>,
  delay = 500,
) {
  const merged = mergeSearchResolvers(searchResolvers);
  return resolve$.pipe(
    groupBy(params => params.key),
    map(group =>
      group.pipe(
        bufferTime(delay),
        filter(params => !!params.length),
        map(params =>
          params.reduce((acc, p) => ({
            values: acc.values.concat(p.values),
            control: p.control,
            params: p.params,
            key: p.key,
          })),
        ),
        switchMap(params => merged.resolve(params.values, params.control, params.params)),
      ),
    ),
    mergeAll(),
    share(),
  );
}
