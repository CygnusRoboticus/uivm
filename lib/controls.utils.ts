import { array as AR, readonlyArray as RAR } from "fp-ts";
import { BehaviorSubject, combineLatest, Observable, of, Subscription } from "rxjs";
import { catchError, distinctUntilChanged, filter, finalize, first, map, switchMap, tap } from "rxjs/operators";
import { ArrayControl, BaseControl, FieldControl, GroupControl, ItemControl, KeyValueControls } from "./controls";
import { AbstractHints, Executor } from "./controls.types";
import { Obj } from "./typing";
import { toObservable } from "./utils";

export function findControl<TValue, THints extends AbstractHints = AbstractHints>(
  control: FieldControl<any, THints>,
  path: (string | number)[] | string,
  delimiter = ".",
) {
  if (path == null) {
    return null;
  }

  if (!Array.isArray(path)) {
    path = path.split(delimiter);
  }
  if (Array.isArray(path) && path.length === 0) return null;
  let found: FieldControl<unknown, THints> | null = control;
  path.forEach((name: string | number) => {
    if (found instanceof GroupControl) {
      found = found.controls.hasOwnProperty(name) ? (found.controls[name] as FieldControl<unknown, THints>) : null;
    } else if (found instanceof ArrayControl) {
      found = (found.at(<number>name) as FieldControl<unknown, THints>) ?? null;
    } else {
      found = null;
    }
  });
  return found as FieldControl<TValue, THints>;
}

export function reduceControls<TValue, THints extends AbstractHints>(controls: KeyValueControls<TValue, THints>) {
  return reduceChildren<TValue, TValue, THints>(
    controls,
    {} as TValue,
    (acc: TValue, control: FieldControl<TValue[keyof TValue], THints>, name: keyof TValue) => {
      acc[name] = control.value;
      return acc;
    },
  );
}

function reduceChildren<T, TValue, THints extends AbstractHints>(
  controls: KeyValueControls<TValue, THints>,
  initValue: T,
  predicate: Function,
) {
  let res = initValue;
  forEachChild<TValue, THints>(controls, (control, name) => {
    res = predicate(res, control, name);
  });
  return res;
}

function forEachChild<TValue extends Obj, THints extends AbstractHints>(
  controls: KeyValueControls<TValue, THints>,
  predicate: (v: typeof controls[typeof k], k: keyof TValue) => void,
) {
  Object.keys(controls).forEach(k => {
    predicate(controls[k as keyof TValue], k);
  });
}

export function traverseParents(control: BaseControl) {
  while (control.parent) {
    control = control.parent;
  }
  return control;
}

export function extractSources<TControl extends ItemControl<THints>, THints extends AbstractHints, TReturn>(
  control: TControl,
  executors: Executor<TControl, TReturn>[],
) {
  const obs = executors.map(v => toObservable(v(control)));
  return obs.length ? combineLatest(obs) : of([]);
}
