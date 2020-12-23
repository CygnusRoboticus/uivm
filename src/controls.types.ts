import { Observable } from "rxjs";
import { BaseControl, FieldControl, ItemControl } from "./controls";

export interface Messages {
  [key: string]: {
    message: string;
    [key: string]: unknown;
  };
}

export interface Obj {
  [key: string]: any;
}
export type ArrayType<T> = T extends Array<infer R> ? R : never;

export type KeyValueControls<TValue extends Obj, THints extends AbstractHints, TExtras> = {
  [k in keyof TValue]: FieldControl<TValue[k], THints, TExtras>;
};

export type KeyControlsValue<TControls extends Obj> = {
  [k in keyof TControls]: TControls[k]["value"];
};

export type AbstractHints = Record<string, boolean | undefined>;
export type AbstractExtras = Record<string, unknown | undefined>;

export type Observableish<TValue> = TValue | Promise<TValue> | Observable<TValue>;
export type Executor<TControl extends BaseControl, TValue> = (control: TControl) => Observableish<TValue>;

export type Validator<TControl extends BaseControl> = Executor<TControl, Messages | null>;
export type Trigger<TControl extends BaseControl> = Executor<TControl, void>;
export type Hinter<TControl extends BaseControl, THints = AbstractHints> = Executor<TControl, [keyof THints, boolean]>;
export type Disabler<TControl extends BaseControl> = Executor<TControl, boolean>;
export type Extraer<TControl extends BaseControl, TExtras = AbstractExtras> = Executor<TControl, Partial<TExtras>>;

export interface ItemControlOptions<THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras> {
  hints?: Hinter<ItemControl<THints, TExtras>, THints>[];
  extras?: Extraer<ItemControl<THints, TExtras>, TExtras>;
  messages?: Validator<ItemControl<THints, TExtras>>[];
}

export interface FieldControlOptions<TValue, THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras>
  extends ItemControlOptions<THints, TExtras> {
  dirty?: boolean;
  touched?: boolean;
  disabled?: boolean;

  triggers?: Trigger<FieldControl<TValue, THints, TExtras>>[];
  disablers?: Disabler<FieldControl<TValue, THints, TExtras>>[];
  validators?: Validator<FieldControl<TValue, THints, TExtras>>[];
}

export interface ItemControlState<THints = AbstractHints, TExtras = AbstractExtras> {
  hints: Partial<THints>;
  extras: Partial<TExtras>;
  messages: Messages | null;
}

export interface FieldControlState<TValue, THints = AbstractHints, TExtras = AbstractExtras>
  extends ItemControlState<THints, TExtras> {
  value: TValue;
  errors: Messages | null;
  disabled: boolean;
  valid: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
}
