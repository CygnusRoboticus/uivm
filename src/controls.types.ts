import { Observable } from "rxjs";
import { IFieldControl, IItemControl } from "./controls";

export interface Messages {
  [key: string]: {
    message: string;
    [key: string]: unknown;
  };
}

export interface Obj {
  [key: string]: any;
}
export type KeyValueControls<TValue extends Obj, THints extends AbstractHints, TExtras> = {
  [k in keyof TValue]: IFieldControl<TValue[k], THints, TExtras>;
};

export type KeyControlsValue<TControls extends Obj> = {
  [k in keyof TControls]: TControls[k]["value"];
};

export type AbstractHints = Record<string, boolean | undefined>;
export type AbstractExtras = Record<string, unknown | undefined>;

export type Observableish<TValue> = TValue | Promise<TValue> | Observable<TValue>;
export type Executor<TControl, TValue> = (control: TControl) => Observableish<TValue>;

export type Validator<TControl> = Executor<TControl, Messages | null>;
export type Trigger<TControl> = Executor<TControl, void>;
export type Hinter<TControl, THints extends AbstractHints = AbstractHints> = Executor<
  TControl,
  [keyof THints, boolean]
>;
export type Disabler<TControl> = Executor<TControl, boolean>;
export type Extraer<TControl, TExtras = AbstractExtras> = Executor<TControl, Partial<TExtras>>;

export interface ItemControlOptions<THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras> {
  hints?: Hinter<IItemControl<THints, TExtras>, THints>[];
  extras?: Extraer<IItemControl<THints, TExtras>, TExtras>[];
  messages?: Validator<IItemControl<THints, TExtras>>[];
}

export interface FieldControlOptions<TValue, THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras>
  extends ItemControlOptions<THints, TExtras> {
  dirty?: boolean;
  touched?: boolean;
  disabled?: boolean;

  triggers?: Trigger<IFieldControl<TValue, THints, TExtras>>[];
  disablers?: Disabler<IFieldControl<TValue, THints, TExtras>>[];
  validators?: Validator<IFieldControl<TValue, THints, TExtras>>[];
}

export interface ItemControlState<THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras> {
  hints: Partial<THints>;
  extras: Partial<TExtras>;
  messages: Messages | null;
}

export interface FieldControlState<TValue, THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras>
  extends ItemControlState<THints, TExtras> {
  value: TValue;
  errors: Messages | null;
  disabled: boolean;
  valid: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
}
