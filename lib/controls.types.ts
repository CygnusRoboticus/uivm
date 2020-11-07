import { Observable } from "rxjs";
import { BaseControl, FieldControl, ItemControl } from "./controls";

export interface Messages {
  [key: string]: {
    message: string;
    [key: string]: unknown;
  };
}

export type AbstractHints = Record<string, boolean>;

export type Observableish<TValue> = TValue | Promise<TValue> | Observable<TValue>;
export type Executor<TControl extends BaseControl, TValue> = (control: TControl) => Observableish<TValue>;
export type ObservableExecutor<TControl extends BaseControl, TValue> = (control: TControl) => Observable<TValue>;

export type Validator<TControl extends BaseControl> = Executor<TControl, Messages | null>;
export type Trigger<TControl extends BaseControl> = Executor<TControl, void>;
export type Hinter<TControl extends BaseControl, THints extends AbstractHints = AbstractHints> = ObservableExecutor<
  TControl,
  [keyof THints, boolean]
>;
export type Disabler<TControl extends BaseControl> = ObservableExecutor<TControl, boolean>;

export interface ItemControlOptions<THints extends AbstractHints = AbstractHints> {
  hinters?: Hinter<ItemControl<THints>, THints>[];
  messagers?: Validator<ItemControl<THints>>[];
}

export interface FieldControlOptions<TValue, THints extends AbstractHints> extends ItemControlOptions<THints> {
  dirty?: boolean;
  touched?: boolean;
  disabled?: boolean;

  triggers?: Trigger<FieldControl<TValue, THints>>[];
  disablers?: Disabler<FieldControl<TValue, THints>>[];
  validators?: Validator<FieldControl<TValue, THints>>[];
}

export interface ItemControlState<THints extends AbstractHints> {
  hints: THints;
  messages: Messages | null;
}

export interface FieldControlState<TValue, THints extends AbstractHints> extends ItemControlState<THints> {
  value: TValue;
  errors: Messages | null;
  disabled: boolean;
  valid: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
}
