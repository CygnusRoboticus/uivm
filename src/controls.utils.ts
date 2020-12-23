import { combineLatest, of } from "rxjs";
import { ArrayControl, BaseControl, FieldControl, GroupControl, ItemControl } from "./controls";
import { AbstractExtras, AbstractHints, Executor, KeyValueControls, Obj } from "./controls.types";
import { toObservable } from "./utils";

export function findControl<TValue, THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras>(
  control: FieldControl<any, THints, TExtras>,
  path: (string | number)[] | string,
  delimiter = ".",
) {
  if (path == null) {
    return null;
  }

  if (!Array.isArray(path)) {
    path = path.split(delimiter);
  } else if (path.length === 0) {
    return null;
  }
  let found: FieldControl<unknown, THints, TExtras> | null = control;
  path.forEach((name: string | number) => {
    if (found instanceof GroupControl) {
      found = found.controls.hasOwnProperty(name)
        ? (found.controls[name] as FieldControl<unknown, THints, TExtras>)
        : null;
    } else if (found instanceof ArrayControl) {
      found = (found.at(<number>name) as FieldControl<unknown, THints, TExtras>) ?? null;
    } else {
      found = null;
    }
  });
  return found as FieldControl<TValue, THints, TExtras>;
}

export function reduceControls<TValue, THints extends AbstractHints, TExtras>(
  controls: KeyValueControls<TValue, THints, TExtras>,
) {
  return reduceChildren<TValue, TValue, THints, TExtras>(
    controls,
    {} as TValue,
    (acc: TValue, control: FieldControl<TValue[keyof TValue], THints, TExtras>, name: keyof TValue) => {
      acc[name] = control.value;
      return acc;
    },
  );
}

function reduceChildren<T, TValue, THints extends AbstractHints, TExtras>(
  controls: KeyValueControls<TValue, THints, TExtras>,
  initValue: T,
  predicate: Function,
) {
  let res = initValue;
  forEachChild<TValue, THints, TExtras>(controls, (control, name) => {
    res = predicate(res, control, name);
  });
  return res;
}

function forEachChild<TValue extends Obj, THints extends AbstractHints, TExtras>(
  controls: KeyValueControls<TValue, THints, TExtras>,
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

export function extractSources<
  TControl extends ItemControl<THints, TExtras>,
  THints extends AbstractHints,
  TExtras,
  TValue
>(control: TControl, executors: Executor<TControl, TValue>[]) {
  const obs = executors.map(v => toObservable(v(control)));
  return obs.length ? combineLatest(obs) : of([]);
}
