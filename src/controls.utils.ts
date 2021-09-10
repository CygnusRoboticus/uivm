import { combineLatest, of } from "rxjs";
import { IBaseControl, IFieldControl } from "./controls";
import { AbstractExtras, AbstractHints, Executor, KeyValueControls, Obj } from "./controls.types";
import { isArrayControl, isGroupControl, toObservable } from "./utils";

export function findControl<TValue, THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras>(
  control: IFieldControl<any, THints, TExtras>,
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
  let found: IFieldControl<unknown, THints, TExtras> | null = control;
  path.forEach((name: string | number) => {
    if (found && isGroupControl(found)) {
      found = found.controls.hasOwnProperty(name)
        ? (found.controls[name] as IFieldControl<unknown, THints, TExtras>)
        : null;
    } else if (found && isArrayControl(found)) {
      found = (found.controls[parseInt(<string>name)] as unknown as IFieldControl<unknown, THints, TExtras>) ?? null;
    } else {
      found = null;
    }
  });
  return found as IFieldControl<TValue, THints, TExtras>;
}

export function reduceControls<TValue, THints extends AbstractHints, TExtras>(
  controls: KeyValueControls<TValue, THints, TExtras>,
) {
  return reduceChildren<TValue, TValue, THints, TExtras>(
    controls,
    {} as TValue,
    (acc: TValue, control: IFieldControl<TValue[keyof TValue], THints, TExtras>, name: keyof TValue) => {
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

export function traverseParents<TControl extends IBaseControl>(control: TControl) {
  let current: TControl = control;
  const parents: TControl[] = [];
  while (control.parent) {
    parents.push(control.parent as TControl);
    current = control.parent as TControl;
  }
  return parents;
}

export function extractSources<TControl, TValue>(control: TControl, executors: Executor<TControl, TValue>[]) {
  const obs = executors.map(v => toObservable(v(control)));
  return obs.length ? combineLatest(obs) : of([]);
}
