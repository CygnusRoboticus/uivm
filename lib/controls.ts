import { array as AR } from "fp-ts";
import { groupBy } from "fp-ts/lib/NonEmptyArray";
import { range } from "fp-ts/lib/ReadonlyArray";
import { BehaviorSubject, combineLatest, from, Observable, of, Subject, Subscription } from "rxjs";
import { map, switchMap, take } from "rxjs/operators";

export type ValidationErrors = {
  [key: string]: { message: string; [k: string]: unknown };
};

export interface ValidatorFn<TValue, TFlags extends AbstractFlags> {
  (control: FieldControl<TValue, TFlags>): ValidationErrors | null;
}

export interface AsyncValidatorFn<TValue, TFlags extends AbstractFlags> {
  (control: FieldControl<TValue, TFlags>): Promise<ValidationErrors | null> | Observable<ValidationErrors | null>;
}

function findControl<TValue, TFlags extends AbstractFlags>(
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

export interface ItemControlOptions<TFlags extends AbstractFlags> {
  status?: Partial<TFlags>;
  flags?: Partial<TFlags>;
  flagExecutors?: Observable<[keyof TFlags, boolean]>[];
}

export interface FieldControlOptions<TValue, TFlags extends AbstractFlags> extends ItemControlOptions<TFlags> {
  validators?: ValidatorFn<TValue, TFlags>[] | null;
  asyncValidators?: AsyncValidatorFn<TValue, TFlags>[] | null;
}

export function vectorize<T>(value: T | T[] | null | undefined) {
  return value === null || value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function reduceControls<TValue, TFlags extends AbstractFlags>(
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

function reduceChildren<T, TValue, TFlags extends AbstractFlags>(
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

function forEachChild<TValue, TFlags extends AbstractFlags>(
  controls: FieldControlMap<TValue, TFlags>,
  predicate: (v: FieldControl<TValue[keyof TValue], TFlags>, k: keyof TValue) => void,
) {
  Object.keys(controls).forEach(k => {
    const key = k as keyof TValue;
    predicate(controls[key], key);
  });
}

function notNullish<T>(value: T | null | undefined): value is T {
  return !!value;
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

export class ItemControl<TFlags extends AbstractFlags> {
  protected _flagExecutors$ = new BehaviorSubject<Observable<[keyof TFlags, boolean]>[]>([]);
  flags$: Observable<TFlags> = this._flagExecutors$.pipe(
    switchMap(obs => combineLatest(obs)),
    map(groupBy(([k]) => k as string)),
    map<{}, [keyof TFlags, TFlags[keyof TFlags]][]>(Object.entries),
    map(
      AR.reduce({} as TFlags, (acc, [k, v]) => {
        acc[k] = acc[k] && v;
        return acc;
      }),
    ),
  );
  protected _parent: ItemControl<TFlags> | null = null;

  get parent() {
    return this._parent;
  }

  get children() {
    return <ItemControl<TFlags>[]>[];
  }

  constructor(opts: ItemControlOptions<TFlags> = { flags: {} }) {
    if (opts.flagExecutors) {
      this.setFlagExecutors([new BehaviorSubject<[keyof TFlags, boolean]>(["hidden", true]), ...opts.flagExecutors]);
    } else if (opts.flags) {
      this.setFlags({ hidden: true, ...opts.flags } as TFlags);
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
    this.update();
  };

  setFlagExecutors(observables: Observable<[keyof TFlags, boolean]>[]) {
    this._flagExecutors$.next(observables);
  }

  setParent(parent: ItemControl<TFlags>) {
    this._parent = parent;
  }

  dispose() {
    // noop
  }
}

export class FieldControl<TValue, TFlags extends AbstractFlags> extends ItemControl<TFlags> {
  value: TValue;
  initialValue: TValue;
  status: AbstractStatus;
  errors: ValidationErrors | null;

  protected _value$: BehaviorSubject<TValue>;
  protected _status$: BehaviorSubject<AbstractStatus>;
  protected _errors$: BehaviorSubject<ValidationErrors | null>;

  protected validators: ValidatorFn<TValue, TFlags>[];
  protected asyncValidators: AsyncValidatorFn<TValue, TFlags>[];
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

  constructor(value: TValue, opts: FieldControlOptions<TValue, TFlags> = {}) {
    super(opts);
    this.value = value;
    this.initialValue = value;
    this.status = {
      valid: true,
      disabled: false,
      pending: false,
      dirty: false,
      touched: false,
    };
    this.errors = <ValidationErrors | null>null;

    this.validators = opts.validators ?? [];
    this.asyncValidators = opts.asyncValidators ?? [];

    this._value$ = new BehaviorSubject(this.value);
    this._status$ = new BehaviorSubject(this.status);
    this._errors$ = new BehaviorSubject(this.errors);
  }

  setValidators = (validators: ValidatorFn<TValue, TFlags>[]) => {
    this.validators = validators;
    this.validate();
  };

  setAsyncValidators = (validators: AsyncValidatorFn<TValue, TFlags>[]) => {
    this.asyncValidators = validators;
    this.validate();
  };

  validate() {
    const results = this.validators.map(v => v(this)).filter(notNullish);
    const asyncObs = combineLatest(this.asyncValidators.map(v => from(v(this)).pipe(take(1)))).pipe(
      map(results => results.filter(notNullish)),
    );
    if (this.validationSub) {
      this.validationSub.unsubscribe();
    }
    this.validationSub = combineLatest([of(results), asyncObs])
      .pipe(
        map(([results, asyncResults]) => [...results, ...asyncResults]),
        map(results => (results.length ? results.reduce((acc, r) => ({ ...acc, ...r }), {}) : null)),
        take(1),
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
    this.status = this.children.reduce(
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

  get children() {
    return <FieldControl<unknown, TFlags>[]>[];
  }

  dispose() {
    this._value$.complete();
    this._errors$.complete();
    super.dispose();
  }
}

type FieldControlMap<TValue, TFlags extends AbstractFlags> = {
  [key in keyof TValue]: FieldControl<TValue[key], TFlags>;
};

type GroupValue<TValue, TFlags extends AbstractFlags, TControls extends FieldControlMap<TValue, TFlags>> = {
  [key in keyof TControls]: TControls[key]["value"];
};

export class GroupControl<
  TValue extends GroupValue<TValue, TFlags, TControls>,
  TFlags extends AbstractFlags,
  TControls extends FieldControlMap<TValue, TFlags>
> extends FieldControl<TValue, TFlags> {
  public controls: TControls;

  constructor(controls: TControls, opts: FieldControlOptions<TValue, TFlags> = {}) {
    super(reduceControls<TValue, TFlags>(controls, opts.status?.disabled ?? false), opts);
    this.controls = controls;
    this.children.forEach(control => this.registerControl(control));

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
    this.reset = () => {
      this.children.forEach(control => control.reset());
    };
  }

  get children() {
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
    const value = reduceControls<TValue, TFlags>(this.controls, this.status.disabled);
    this.value = value;
    this._value$.next(value);
    super.update();
  }

  protected registerControl(control: ItemControl<TFlags>) {
    control.setParent(this);
  }
}

export class ArrayControl<
  TValue extends GroupValue<TValue, TFlags, TControls>,
  TItem extends GroupControl<TValue, TFlags, TControls>,
  TFlags extends AbstractFlags,
  TControls extends FieldControlMap<TValue, TFlags>
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
  }

  get children() {
    return this.controls as FieldControl<unknown, TFlags>[];
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
    const value = this.controls.map(control => control.value);
    this.value = value;
    this._value$.next(value);
    super.update();
  }

  protected resize(length: number) {
    this.clear();
    const controls = range(0, length).map((_, i) => this.itemFactory(this.value[i] ?? null));
    this.push(...controls);
  }

  protected registerControl(control: ItemControl<TFlags>) {
    control.setParent(this);
  }
}
