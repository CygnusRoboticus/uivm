import { Observable } from "rxjs";
import { BaseControl, FieldControl, ItemControl } from "./controls";

export interface Messages {
  [key: string]: {
    message: string;
    [key: string]: unknown;
  };
}

export type AbstractHints = Record<string, boolean | undefined>;
export type AbstractExtras = Record<string, unknown | undefined>;

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
export type Extraer<TControl extends BaseControl, TExtras extends AbstractExtras = AbstractExtras> = ObservableExecutor<
  TControl,
  Partial<TExtras>
>;

export interface ItemControlOptions<
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> {
  hinters?: Hinter<ItemControl<THints, TExtras>, THints>[];
  extraers?: Extraer<ItemControl<THints, TExtras>, TExtras>;
  messagers?: Validator<ItemControl<THints, TExtras>>[];
}

export interface FieldControlOptions<
  TValue,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> extends ItemControlOptions<THints, TExtras> {
  dirty?: boolean;
  touched?: boolean;
  disabled?: boolean;

  triggers?: Trigger<FieldControl<TValue, THints, TExtras>>[];
  disablers?: Disabler<FieldControl<TValue, THints, TExtras>>[];
  validators?: Validator<FieldControl<TValue, THints, TExtras>>[];
}

export interface ItemControlState<
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> {
  hints: Partial<THints>;
  extras: Partial<TExtras>;
  messages: Messages | null;
}

export interface FieldControlState<
  TValue,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> extends ItemControlState<THints, TExtras> {
  value: TValue;
  errors: Messages | null;
  disabled: boolean;
  valid: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
}
