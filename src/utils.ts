import { from, isObservable, Observable, of } from "rxjs";
import { BaseControl, FieldControl, GroupControl } from "./controls";
import { AbstractExtras, AbstractHints } from "./controls.types";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";

export function notNullish<T>(value: T | null | undefined): value is T {
  return !!value;
}

export function isPromise<T>(value: any): value is Promise<T> {
  return value && typeof value.then === "function";
}

export function toObservable<T>(source: T | Promise<T> | Observable<T>) {
  if (isObservable(source) || isPromise(source)) {
    return from(source);
  }
  return of(source);
}

export function isFieldConfig<TConfig extends BaseItemConfig>(
  config: BaseItemConfig,
): config is BaseFieldConfig & TConfig {
  return config && !!(config as any).name;
}
export function isGroupConfig<TConfig extends BaseItemConfig>(
  config: BaseItemConfig,
): config is BaseGroupConfig<TConfig> & TConfig {
  return config && !!(config as any).fields;
}
export function isArrayConfig<TConfig extends BaseItemConfig>(
  config: BaseItemConfig,
): config is BaseArrayConfig<TConfig> & TConfig {
  return isGroupConfig<TConfig>(config) && (config as any).array;
}

export function isFieldControl<
  TValue = unknown,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
>(control: BaseControl): control is FieldControl<TValue, THints, TExtras> {
  return control instanceof FieldControl;
}
export function isGroupControl<
  TValue = unknown,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
>(control: BaseControl): control is GroupControl<TValue, any, THints, TExtras> {
  return control instanceof GroupControl;
}
