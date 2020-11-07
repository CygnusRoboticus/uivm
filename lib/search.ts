import { combineLatest } from "rxjs";
import { first, map } from "rxjs/operators";
import { ItemControl } from "./controls";
import { AbstractHints } from "./controls.types";
import { SearchResolver } from "./executable";
import { toObservable } from "./utils";
import { readonlyArray as RAR } from "fp-ts";

export function resolverSearch<
  TControl extends ItemControl<THints>,
  TValue,
  TParams extends object,
  THints extends AbstractHints = AbstractHints
>(
  searchResolvers: SearchResolver<TControl, TValue, TParams, THints>[],
  search: string,
  control: TControl,
  params: TParams,
) {
  return combineLatest(searchResolvers.map(sr => toObservable(sr.search(search, control, params)))).pipe(
    map(RAR.flatten),
    first(),
  );
}
