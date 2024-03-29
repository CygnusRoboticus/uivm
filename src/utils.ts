import { from, isObservable, Observable, of } from "rxjs";
import {
  AbstractExtras,
  AbstractHints,
  IArrayControl,
  IFieldControl,
  IGroupControl,
  IItemControl,
  KeyControlsValue,
  KeyValueControls,
} from "./controls.types";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";

export function notNullish<T>(value: T | null | undefined): value is T {
  return !!value;
}

export function isPromise<T>(value: unknown): value is Promise<T> {
  return !!value && (value instanceof Promise || typeof (value as any).then === "function");
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
  return !!config && !!(config as any).name;
}
export function isGroupConfig<TConfig extends BaseItemConfig>(
  config: BaseItemConfig,
): config is BaseGroupConfig<TConfig> & TConfig {
  return !!config && Array.isArray((config as any).fields);
}
export function isArrayConfig<TConfig extends BaseItemConfig>(
  config: BaseItemConfig,
): config is BaseArrayConfig<TConfig> & TConfig {
  return isFieldConfig<TConfig>(config) && isGroupConfig<TConfig>((config as any).fields);
}

export function isItemControl<THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras>(
  control: unknown,
): control is IItemControl<THints, TExtras> {
  return (control as IItemControl<THints, TExtras>)?.isItemControl === true;
}
export function isFieldControl<
  TValue = unknown,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
>(control: unknown): control is IFieldControl<TValue, THints, TExtras> {
  return (control as IFieldControl<TValue, THints, TExtras>)?.isFieldControl === true;
}
export function isGroupControl<
  TValue extends KeyControlsValue<TControls> = any,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TControls extends KeyValueControls<TValue, THints, TExtras> = KeyValueControls<TValue, THints, TExtras>,
>(control: unknown): control is IGroupControl<TValue, THints, TExtras, TControls> {
  return (control as IGroupControl<TValue, THints, TExtras, TControls>)?.isGroupControl === true;
}
export function isArrayControl<
  TValue extends KeyControlsValue<TControls> = any,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TControls extends KeyValueControls<TValue, THints, TExtras> = KeyValueControls<TValue, THints, TExtras>,
>(control: unknown): control is IArrayControl<TValue, THints, TExtras, TControls> {
  return (control as IArrayControl<TValue, THints, TExtras, TControls>)?.isArrayControl === true;
}
