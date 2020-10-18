import { array as AR, nonEmptyArray as NEA, readonlyArray as RAR } from "fp-ts";
import { BehaviorSubject, combineLatest, from, isObservable, Observable, of, Subject, Subscription } from "rxjs";
import { catchError, filter, first, map, switchMap, take, tap } from "rxjs/operators";
import { isPromise, notNullish } from "./utils";

export interface Messages {
  [key: string]: {
    message: string;
    [key: string]: unknown;
  };
}

export interface Validator<TValue, TFlags extends AbstractFlags = AbstractFlags> {
  (control: FieldControl<TValue, TFlags>): Messages | null | Promise<Messages | null> | Observable<Messages | null>;
}

function findControl<TValue, TFlags extends AbstractFlags = AbstractFlags>(
  control: FieldControl<TValue, TFlags>,
  path: (string | number)[] | string,
  delimiter = ".",
) {
  if (path == null) return null;

  if (!Array.isArray(path)) {
    path = path.split(delimiter);
  }
  if (Array.isArray(path) && path.length === 0) return null;
  let found: FieldControl<TValue, TFlags> | null = control;
  path.forEach((name: string | number) => {
    if (found instanceof GroupControl) {
      found = found.controls.hasOwnProperty(name) ? found.controls[name] : null;
    } else if (found instanceof ArrayControl) {
      found = found.at(<number>name) ?? null;
    } else {
      found = null;
    }
  });
  return found;
}

export interface ItemControlOptions<TFlags extends AbstractFlags = AbstractFlags> {
  status?: Partial<AbstractStatus>;
  flags?: Partial<TFlags>;
  flagExecutors?: Observable<[keyof TFlags, boolean]>[];
  messages?: Messages;
  messageExecutors?: Observable<Messages | null>[];
}

export interface FieldControlOptions<TValue, TFlags extends AbstractFlags = AbstractFlags>
  extends ItemControlOptions<TFlags> {
  validators?: Validator<TValue, TFlags>[];
  disabled?: boolean;
  disableExecutors?: Observable<boolean>[];
}

function reduceControls<TValue, TFlags extends AbstractFlags = AbstractFlags>(
  controls: FieldControlMap<TValue, TFlags>,
  disabled: boolean,
) {
  return reduceChildren<TValue, TValue, TFlags>(
    controls,
    {} as TValue,
    (acc: TValue, control: FieldControl<TValue[keyof TValue], TFlags>, name: keyof TValue) => {
      if (!control.status.disabled || disabled) {
        acc[name] = control.value;
      }
      return acc;
    },
  );
}

function reduceChildren<T, TValue, TFlags extends AbstractFlags = AbstractFlags>(
  controls: FieldControlMap<TValue, TFlags>,
  initValue: T,
  predicate: Function,
) {
  let res = initValue;
  forEachChild<TValue, TFlags>(controls, (control, name) => {
    res = predicate(res, control, name);
  });
  return res;
}

function forEachChild<TValue, TFlags extends AbstractFlags = AbstractFlags>(
  controls: FieldControlMap<TValue, TFlags>,
  predicate: (v: FieldControl<TValue[keyof TValue], TFlags>, k: keyof TValue) => void,
) {
  Object.keys(controls).forEach(k => {
    const key = k as keyof TValue;
    predicate(controls[key], key);
  });
}

export interface AbstractStatus {
  valid: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
  disabled: boolean;
}

export interface AbstractFlags {
  hidden: boolean;
  [key: string]: boolean;
}

export abstract class BaseControl {
  protected _parent: BaseControl | null = null;

  get parent() {
    return this._parent;
  }

  setParent(parent: BaseControl) {
    this._parent = parent;
  }

  abstract update(): void;
  abstract dispose(): void;

  toJSON() {
    return {
      parent: this.parent,
      name: "BaseControl",
    };
  }
}

export class ItemControl<TFlags extends AbstractFlags = AbstractFlags> extends BaseControl {
  protected _flagExecutors$ = new BehaviorSubject<Observable<[keyof TFlags, boolean]>[]>([
    new BehaviorSubject<[keyof TFlags, boolean]>(["hidden", false]),
  ]);
  protected _messageExecutors$ = new BehaviorSubject<Observable<Messages | null>[]>([]);
  protected _children: ItemControl<TFlags>[];

  flags$: Observable<TFlags> = this._flagExecutors$.pipe(
    switchMap(obs => (obs.length ? combineLatest(obs) : of([]))),
    map(
      AR.reduce({} as TFlags, (acc, [k, v]) => {
        acc[k] = (!!acc[k] || v) as TFlags[typeof k];
        return acc;
      }),
    ),
  );

  messages$: Observable<Messages | null> = this._messageExecutors$.pipe(
    switchMap(obs => (obs.length ? combineLatest(obs) : of([]))),
    map(AR.filter(notNullish)),
    map(msgs => {
      if (msgs.length) {
        return msgs.reduce((acc, m) => ({ ...acc, ...m }), {});
      }
      return null;
    }),
  );

  get children() {
    return this._children;
  }

  constructor(children: ItemControl<TFlags>[] = [], opts: ItemControlOptions<TFlags> = {}) {
    super();
    this._children = children;

    if (opts.flagExecutors) {
      this.setFlagExecutors(opts.flagExecutors);
    } else if (opts.flags) {
      this.setFlags(opts.flags);
    }
    if (opts.messageExecutors) {
      this.setMessageExecutors(opts.messageExecutors);
    } else if (opts.messages) {
      this.setMessages(opts.messages);
    }
  }

  update() {
    this.parent?.update();
  }

  setFlags = (flags: Partial<TFlags>) => {
    this.setFlagExecutors(
      Object.keys(flags).map(
        k => new BehaviorSubject<[keyof TFlags, boolean]>([k, !!flags[k]]),
      ),
    );
  };

  setMessages = (messages: Messages | null) => {
    this.setMessageExecutors(messages ? [new BehaviorSubject(messages)] : []);
  };

  setFlagExecutors(observables: Observable<[keyof TFlags, boolean]>[]) {
    this._flagExecutors$.next([new BehaviorSubject<[keyof TFlags, boolean]>(["hidden", false]), ...observables]);
  }

  setMessageExecutors(observables: Observable<Messages | null>[]) {
    this._messageExecutors$.next(observables);
  }

  dispose() {
    // noop
  }

  toJSON() {
    return {
      ...super.toJSON(),
      name: "ItemControl",
    };
  }
}

export class FieldControl<TValue, TFlags extends AbstractFlags = AbstractFlags> extends ItemControl<TFlags> {
  value: TValue;
  initialValue: TValue;
  status: AbstractStatus;
  errors: Messages | null;

  protected _value$: BehaviorSubject<TValue>;
  protected _status$: BehaviorSubject<AbstractStatus>;
  protected _errors$: BehaviorSubject<Messages | null>;
  protected _disabledExecutors$: BehaviorSubject<Observable<boolean>[]>;
  protected _initialized$: BehaviorSubject<boolean>;

  protected validators: Validator<TValue, TFlags>[];
  protected validationSub?: Subscription;

  get value$() {
    return this._value$.asObservable();
  }
  get status$() {
    return this._status$.asObservable();
  }
  get errors$() {
    return this._errors$.asObservable();
  }
  protected get initialized() {
    return this._initialized$.getValue();
  }

  constructor(value: TValue, opts: FieldControlOptions<TValue, TFlags> = {}) {
    super([], opts);
    this.value = value;
    this.initialValue = value;
    this.status = {
      valid: true,
      disabled: false,
      pending: false,
      dirty: false,
      touched: false,
    };
    this.errors = <Messages | null>null;

    this.validators = opts.validators ?? [];

    this._value$ = new BehaviorSubject(this.value);
    this._status$ = new BehaviorSubject(this.status);
    this._errors$ = new BehaviorSubject(this.errors);
    this._disabledExecutors$ = new BehaviorSubject<Observable<boolean>[]>([]);
    this._initialized$ = new BehaviorSubject<boolean>(false);

    if (opts.disableExecutors) {
      this.setDisableExecutors(opts.disableExecutors);
    } else if (opts.disabled !== undefined) {
      this.setDisabled(opts.disabled);
    }

    this.validate();
    this.fieldReady();
  }

  setValidators = (validators: Validator<TValue, TFlags>[]) => {
    this.validators = validators;
    this.validate();
  };

  setDisabled(disabled: boolean) {
    this.setDisableExecutors([new BehaviorSubject(disabled)]);
  }

  setDisableExecutors(observables: Observable<boolean>[]) {
    this._disabledExecutors$.next(observables);
  }

  validate() {
    const sources = this.validators.length
      ? combineLatest(
          this.validators.map(v => {
            const result = v(this);
            if (isPromise(result) || isObservable(result)) {
              return from(result).pipe(first());
            }
            return of(result);
          }),
        ).pipe(map(AR.filter(notNullish)))
      : of([]);

    if (this.validationSub) {
      this.validationSub.unsubscribe();
    }
    this.validationSub = combineLatest([this._initialized$.pipe(filter(Boolean)), sources])
      .pipe(
        map(([, v]) => v),
        map(results => (results.length ? results.reduce((acc, r) => ({ ...acc, ...r }), {}) : null)),
        first(),
      )
      .subscribe(errors => {
        this.errors = errors;
        this.setStatus({ valid: !!errors });
      });
  }

  setStatus = (status: Partial<AbstractStatus>) => {
    const updated = { ...this.status, ...status } as AbstractStatus;
    this.status = updated;
    this.update();
  };

  setValue = (value: TValue) => {
    this.value = value;
    this.setStatus({ dirty: true, touched: true });
  };

  patchValue = (value: TValue) => {
    this.setValue(value);
  };

  reset = () => {
    this.value = this.initialValue;
    this.setStatus({ dirty: false, touched: false });
  };

  get(path: Array<string | number> | string): FieldControl<TValue, TFlags> | null {
    return findControl(this, path, ".");
  }

  getError(errorCode: string, path?: Array<string | number> | string): any {
    const control = path ? this.get(path) : this;
    return control && control.errors ? control.errors[errorCode] : null;
  }

  update() {
    if (!this.initialized) {
      return;
    }

    this.status = this.childFields.reduce(
      (acc, c) => ({
        valid: acc.valid || c.status.valid,
        disabled: acc.disabled || c.status.disabled,
        pending: acc.pending || c.status.pending,
        dirty: acc.dirty || c.status.dirty,
        touched: acc.touched || c.status.touched,
      }),
      this.status,
    );
    this._value$.next(this.value);
    this._status$.next(this.status);
    this._errors$.next(this.errors);
    super.update();
  }

  get root() {
    let x = this as FieldControl<unknown, TFlags>;

    while (x._parent) {
      x = x._parent as FieldControl<unknown, TFlags>;
    }

    return x;
  }

  get childFields() {
    return <FieldControl<unknown, TFlags>[]>[];
  }

  dispose() {
    this._value$.complete();
    this._errors$.complete();
    super.dispose();
  }

  protected fieldReady() {
    this._initialized$.next(true);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      name: "FieldControl",
    };
  }
}

export type FieldControlMap<TValue, TFlags extends AbstractFlags = AbstractFlags> = {
  [key in keyof TValue]: FieldControl<TValue[key], TFlags>;
};

export class GroupControl<
  TValue extends { [key in keyof TControls]: TControls[key]["value"] },
  TControls extends FieldControlMap<TValue, TFlags>,
  TFlags extends AbstractFlags = AbstractFlags
> extends FieldControl<TValue, TFlags> {
  controls: TControls;
  protected _children: ItemControl<TFlags>[];

  get children() {
    return this._children;
  }

  constructor(
    controls: TControls,
    children: ItemControl<TFlags>[] = [],
    opts: FieldControlOptions<TValue, TFlags> = {},
  ) {
    super(reduceControls<TValue, TFlags>(controls, opts.status?.disabled ?? false), opts);
    this.controls = controls;
    this._children = children;
    this.childFields.forEach(control => this.registerControl(control));

    this.setValue = (value: TValue) => {
      Object.keys(value).forEach(name => {
        this.controls[name as keyof TValue].setValue(value[name as keyof TValue] as any);
      });
    };
    this.patchValue = (value: Partial<TValue>) => {
      Object.keys(value).forEach(k => {
        const key = k as keyof TValue;
        if (this.controls[key]) {
          this.controls[key].patchValue((value[key] as TValue[keyof TValue]) as any);
        }
      });
    };
    this.reset = () => this.childFields.forEach(control => control.reset());
    this.groupReady();
  }

  get childFields() {
    return Object.keys(this.controls).map(k => {
      const key = k as keyof TControls;
      return this.controls[key] as FieldControl<unknown, TFlags>;
    });
  }

  contains(controlName: string) {
    const key = controlName as keyof TValue;
    return this.controls.hasOwnProperty(key) && !this.controls[key].status.disabled;
  }

  setValue: (value: TValue) => void;
  patchValue: (value: Partial<TValue>) => void;
  reset: () => void;

  getRawValue() {
    return reduceChildren(
      this.controls,
      {},
      (
        acc: FieldControlMap<TValue, TFlags>,
        control: FieldControl<TValue[keyof TValue], TFlags>,
        name: keyof TValue,
      ) => {
        acc[name] = control instanceof FieldControl ? control.value : (<any>control).getRawValue();
        return acc;
      },
    );
  }

  update() {
    if (!this.initialized) {
      return;
    }

    const value = reduceControls<TValue, TFlags>(this.controls, this.status.disabled);
    this.value = value;
    this._value$.next(value);
    super.update();
  }

  protected registerControl(control: ItemControl<TFlags>) {
    control.setParent(this);
  }

  protected fieldReady() {}
  protected groupReady() {
    this._initialized$.next(true);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      name: "GroupControl",
    };
  }
}

export class ArrayControl<
  TValue extends { [key in keyof TControls]: TControls[key]["value"] },
  TItem extends GroupControl<TValue, TControls, TFlags>,
  TControls extends FieldControlMap<TValue, TFlags>,
  TFlags extends AbstractFlags = AbstractFlags
> extends FieldControl<TValue[], TFlags> {
  controls: TItem[];

  constructor(
    protected itemFactory: (value: TValue | null) => TItem,
    value: TValue[] = [],
    opts: FieldControlOptions<TValue[], TFlags> = {},
  ) {
    super(value, opts);
    this.controls = value.map(v => itemFactory(v));
    this.children.forEach(control => this.registerControl(control));
    this.arrayReady();
  }

  get children() {
    return this.controls;
  }

  get length() {
    return this.controls.length;
  }

  at(index: number) {
    return this.controls[index];
  }

  push(...items: TItem[]) {
    this.controls.push(...items);
    items.map(control => this.registerControl(control));
  }

  insert(index: number, item: TItem) {
    this.controls.splice(index, 0, item);
    this.registerControl(item);
  }

  removeAt(index: number) {
    this.controls.splice(index, 1);
  }

  setValue = (value: TValue[]) => {
    this.resize(value.length);
    value.forEach((newValue, index) => {
      const control = this.at(index);
      if (control && control instanceof FieldControl) {
        control.setValue(newValue);
      }
    });
  };

  patchValue = (value: Partial<TValue>[]) => {
    this.resize(value.length);

    value.forEach((v, index) => {
      const control = this.at(index);
      control?.patchValue(v);
    });
  };

  reset = () => {
    this.resize(this.initialValue.length);
    this.children.forEach(control => control.reset());
  };

  getRawValue(): TValue[] {
    return this.controls.map(control => {
      return control instanceof FieldControl ? control.value : (<any>control).getRawValue();
    });
  }

  clear() {
    this.controls.splice(0);
    this.setStatus({ dirty: true, touched: true });
  }

  update() {
    if (!this.initialized) {
      return;
    }

    const value = this.controls.map(control => control.value);
    this.value = value;
    this._value$.next(value);
    super.update();
  }

  protected resize(length: number) {
    this.clear();
    const controls = RAR.range(0, length - 1).map((_, i) => this.itemFactory(this.value[i] ?? null));
    this.push(...controls);
  }

  protected registerControl(control: ItemControl<TFlags>) {
    control.setParent(this);
  }

  protected fieldReady() {}
  protected arrayReady() {
    this._initialized$.next(true);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      name: "ArrayControl",
    };
  }
}
